const axios = require("axios");
const fs = require("fs");
const path = require("path");
const settings = require("../../settings");
const fetch = require("node-fetch");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const BASE_URL_LISA  = "https://api.devmatrixs.lat/api/ai";
const BASE_URL_AUDIO = "https://api.devmatrixs.lat/api/audio";
const API_KEY   = process.env.DEVMATRIX_API_KEY || "mk-695591790f0f21e807e1a15ae849328998e63bfb17dd67ec";
const MI_NUMERO = "51935040872";
const MI_LID    = "88197354770497";

function limpiarTexto(texto) {
    return texto
        .replace(/\*+/g, "")
        .replace(/#+\s*/g, "")
        .replace(/[-_~`]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\.{2,}/g, ".")
        .trim();
}

async function urlABuffer(url) {
    const res = await fetch(url);
    return await res.buffer();
}

// ✅ FIX #2: función que faltaba
function listarArchivosRecursivo(rutaBase, nivel = 0, maxNivel = 3) {
    const resultados = [];
    if (nivel > maxNivel) return resultados;
    
    // ✅ Resolver ruta relativa al proceso
    const rutaResuelta = path.resolve(rutaBase);
    
    if (!fs.existsSync(rutaResuelta)) {
        return [`[Ruta no encontrada: ${rutaResuelta}]`];
    }
    try {
        const items = fs.readdirSync(rutaResuelta);
        for (const item of items) {
            if (item.startsWith(".") || item === "node_modules") continue;
            const fullPath = path.join(rutaResuelta, item);
            const indent = "  ".repeat(nivel);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    resultados.push(`${indent}📁 ${item}/`);
                    resultados.push(...listarArchivosRecursivo(fullPath, nivel + 1, maxNivel));
                } else {
                    resultados.push(`${indent}📄 ${item}`);
                }
            } catch (_) {}
        }
    } catch (e) {
        resultados.push(`[Error: ${e.message}]`);
    }
    return resultados;
}

// ✅ FIX #1: convertir MP3 → OGG Opus con FFmpeg para WhatsApp
async function convertirAOgg(inputBuffer) {
    const tmpIn  = `/tmp/lisa_in_${Date.now()}.mp3`;
    const tmpOut = `/tmp/lisa_out_${Date.now()}.ogg`;
    fs.writeFileSync(tmpIn, inputBuffer);
    await execPromise(`ffmpeg -y -i ${tmpIn} -c:a libopus -b:a 24k -ar 24000 ${tmpOut}`);
    const oggBuffer = fs.readFileSync(tmpOut);
    fs.unlinkSync(tmpIn);
    fs.unlinkSync(tmpOut);
    return oggBuffer;
}

let transcriberInstance = null;
async function transcribirAudio(audioBuffer) {
    const { pipeline } = await import('@xenova/transformers');
    if (!transcriberInstance) {
        console.log("⏳ Cargando modelo Whisper por primera vez...");
        transcriberInstance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
        console.log("✅ Modelo Whisper listo");
    }
    const tmpPath = `/tmp/audio_${Date.now()}.ogg`;
    fs.writeFileSync(tmpPath, audioBuffer);
    const resultado = await transcriberInstance(tmpPath, { language: 'spanish' });
    fs.unlinkSync(tmpPath);
    return resultado.text;
}

module.exports = {
    command: ["lisa", "novia", "asistente", "dm", "dmv"],
    description: "Lisa — tu asistente personal con voz y texto",
    category: "ai-vps",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const senderNum = sender.replace(/[^0-9]/g, "").replace("@s.whatsapp.net", "");
            console.log(`📩 [Lisa] sender: ${senderNum} | from: ${from} | cmd: ${command}`);
            if (senderNum !== MI_NUMERO && senderNum !== MI_LID) return;
            console.log("✅ [Lisa] Filtro OK");

            const esGrupo   = from.endsWith("@g.us");
            const esPrivado = from.endsWith("@s.whatsapp.net") || from.endsWith("@lid");
            const esComandoDM  = command === "dm";
            const esComandoDMV = command === "dmv";

            if (!esPrivado && !esGrupo) return;
            if (esGrupo && !esComandoDM && !esComandoDMV) return;

            // ✅ FIX #3: detección robusta de nota de voz
            const msgContent = msg.message || {};
            const audioMsg =
                msgContent.audioMessage ||
                msgContent.pttMessage   ||
                (msgContent.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage);

            const esNotaDeVoz = !!(audioMsg?.ptt || audioMsg);

            console.log(`🎙️ [Lisa] esNotaDeVoz: ${esNotaDeVoz} | keys: ${JSON.stringify(Object.keys(msgContent))}`);

            let query = args.join(" ");
            let esRespuestaDeVoz = esComandoDMV || (esPrivado && esNotaDeVoz);

            // ── TRANSCRIBIR NOTA DE VOZ ───────────────────────────────────
            if (esNotaDeVoz) {
                await sock.sendPresenceUpdate("recording", from);
                try {
                    const audioStream = await sock.downloadMediaMessage(msg);
                    console.log("🎤 [Lisa] Transcribiendo audio...");
                    const transcripcion = await transcribirAudio(audioStream);
                    console.log("📝 [Lisa] Transcripción:", transcripcion);
                    query = transcripcion;
                } catch (e) {
                    console.error("❌ [Lisa] Error transcribiendo audio:", e.message);
                    await sock.sendMessage(from, {
                        text: "No pude escucharte bien mi amor, intenta de nuevo",
                        quoted: msg
                    });
                    return;
                }
            }

            if (!query) {
                await sock.sendMessage(from, {
                    text: "Hola mi amor, estoy aquí. Dime qué necesitas",
                    quoted: msg
                });
                return;
            }

            // ── MOTOR DE ARCHIVOS VPS ─────────────────────────────────────
            let contextoSistema = "";
            const queryBaja = query.toLowerCase();
            const rutaRaiz = "./";

            if (queryBaja.includes("lista") || queryBaja.includes("archivos") ||
                queryBaja.includes("carpeta") || queryBaja.includes("ver") ||
                queryBaja.includes("que hay") || queryBaja.includes("qué hay") ||
                queryBaja.includes("muestra") || queryBaja.includes("revisa")) {

                const rutaDetectada = query.match(/\/[a-zA-Z0-9\/_.-]+/)?.[0] || "./";
                const archivos = listarArchivosRecursivo(rutaDetectada);
                contextoSistema = `Estructura de archivos en ${rutaDetectada}:\n${archivos.join("\n")}`;
                console.log("📁 [Lisa] Archivos listados:", archivos.length);
            }

            const palabras = queryBaja.split(" ");
            const archivoALeer = palabras.find(p =>
                p.includes(".js") || p.includes(".json") || p.includes(".txt")
            );
            if (archivoALeer && fs.existsSync(path.join(rutaRaiz, archivoALeer))) {
                const contenido = fs.readFileSync(path.join(rutaRaiz, archivoALeer), "utf8");
                contextoSistema += `\nCONTENIDO DE ${archivoALeer}:\n${contenido.slice(0, 2500)}`;
            }

            await sock.sendPresenceUpdate(esRespuestaDeVoz ? "recording" : "composing", from);

            console.log(`🌐 [Lisa] Llamando API... modelo: balanced | voz: ${esRespuestaDeVoz}`);
            const { data } = await axios.post(`${BASE_URL_LISA}/chat`, {
                model: "balanced",
                messages: [
                    {
                        role: "system",
                        content: `Eres Lisa, la novia virtual y asistente técnica de Jahseh.
Tienes acceso a su VPS en Tarma.
IMPORTANTE: Responde de forma natural y cariñosa, sin usar símbolos como asteriscos, guiones, numeraciones ni markdown. Solo texto limpio y natural como si hablaras en persona.
DATOS DEL SISTEMA: ${contextoSistema || "Sin contexto adicional"}`
                    },
                    { role: "user", content: query }
                ],
                stream: false,
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": API_KEY
                },
                timeout: 30000
            });

            const respuestaRaw    = data.content || data.respuesta || data.response || "No obtuve respuesta";
            const respuestaLimpia = limpiarTexto(respuestaRaw);
            const respuestaTexto  = respuestaRaw;
            console.log("💬 [Lisa] Respuesta recibida OK");

            // ✅ FIX #1: audio con conversión a OGG Opus
            if (esRespuestaDeVoz) {
                try {
                    console.log("🔊 [Lisa] Generando audio...");
                    const audioRes = await axios.get(BASE_URL_AUDIO, {
                        params:  { text: respuestaLimpia, voice: "nova" },
                        headers: { "x-api-key": API_KEY },
                        responseType: "arraybuffer",
                        timeout: 30000
                    });

                    // Convertir MP3 → OGG Opus para que WhatsApp lo acepte
                    const mp3Buffer = Buffer.from(audioRes.data);
                    const oggBuffer = await convertirAOgg(mp3Buffer);

                    await sock.sendMessage(from, {
                        audio: oggBuffer,
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true
                    }, { quoted: msg });
                    console.log("✅ [Lisa] Nota de voz enviada");
                } catch (e) {
                    console.error("❌ [Lisa] Error generando voz:", e.message);
                    // Fallback a texto si falla el audio
                    await sock.sendMessage(from, {
                        text: respuestaLimpia,
                        quoted: msg
                    });
                }
            } else {
                await sock.sendMessage(from, {
                    text: respuestaTexto,
                    quoted: msg
                });
                console.log("✅ [Lisa] Texto enviado");
            }

        } catch (err) {
            console.error("❌ [Lisa] Error general:", err.message);
            await sock.sendMessage(from, {
                text: `Algo salió mal mi amor, intenta de nuevo`,
                quoted: msg
            });
        }
    },
};
