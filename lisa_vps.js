const axios = require("axios");
const fs = require("fs");
const path = require("path");
const settings = require("../../settings");
const fetch = require("node-fetch"); // npm install node-fetch@2
const FormData = require("form-data"); // npm install form-data

const BASE_URL_LISA  = "https://devmatrixs.lat/api/ia";
const BASE_URL_AUDIO = "https://devmatrixs.lat/api/audio";
const API_KEY   = "mk-695591790f0f21e807e1a15ae849328998e63bfb17dd67ec";
const MI_NUMERO = "51935040872"; // Solo este número puede usar a Lisa

// Quitar símbolos markdown para respuesta limpia por voz
function limpiarTexto(texto) {
    return texto
        .replace(/\*+/g, "")
        .replace(/#+\s*/g, "")
        .replace(/[-_~`]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\.{2,}/g, ".")
        .trim();
}

// Descargar audio de URL y convertirlo a Buffer
async function urlABuffer(url) {
    const res = await fetch(url);
    return await res.buffer();
}

// Transcribir nota de voz con Whisper
async function transcribirAudio(audioBuffer) {
    const form = new FormData();
    form.append("file", audioBuffer, { filename: "audio.ogg", contentType: "audio/ogg" });
    form.append("model", "whisper-1");
    const res = await axios.post("https://api.openai.com/v1/audio/transcriptions", form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer TU_OPENAI_KEY` },
        timeout: 30000
    });
    return res.data.text;
}

module.exports = {
    command: ["lisa", "novia", "asistente", "dm", "dmv"],
    description: "Lisa — tu asistente personal con voz y texto",
    category: "ai-vps",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            // ── FILTRO: solo mi número puede usar a Lisa ──────────────────
            const senderNum = sender.replace(/[^0-9]/g, "").replace("@s.whatsapp.net", "");
            if (senderNum !== MI_NUMERO) return; // Ignora a cualquier otro

            const esGrupo   = from.endsWith("@g.us");
            const esPrivado = from.endsWith("@s.whatsapp.net");

            // ── LÓGICA DE ACTIVACIÓN ──────────────────────────────────────
            // En privado: responde siempre (texto + voz si hay nota de voz)
            // En grupo: solo con .dm (texto) o .dmv (voz)
            const esComandoDM  = command === "dm";
            const esComandoDMV = command === "dmv";

            if (esGrupo && !esComandoDM && !esComandoDMV) return;

            // ── DETECTAR SI ES NOTA DE VOZ ────────────────────────────────
            const esNotaDeVoz =
                msg.message?.audioMessage?.ptt === true ||
                msg.message?.audioMessage != null;

            let query = args.join(" ");
            let esRespuestaDeVoz = esComandoDMV || (esPrivado && esNotaDeVoz);

            // Si es nota de voz → transcribir primero
            if (esNotaDeVoz) {
                await sock.sendPresenceUpdate("recording", from);
                try {
                    const audioStream = await sock.downloadMediaMessage(msg);
                    const transcripcion = await transcribirAudio(audioStream);
                    query = transcripcion;
                } catch (e) {
                    console.error("❌ Error transcribiendo audio:", e.message);
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
            const rutaRaiz  = "./";

            if (queryBaja.includes("lista") || queryBaja.includes("archivos")) {
                const archivos = fs.readdirSync(rutaRaiz);
                contextoSistema = `Archivos en la VPS: [${archivos.join(", ")}].`;
            }

            const palabras = queryBaja.split(" ");
            const archivoALeer = palabras.find(p =>
                p.includes(".js") || p.includes(".json") || p.includes(".txt")
            );
            if (archivoALeer && fs.existsSync(path.join(rutaRaiz, archivoALeer))) {
                const contenido = fs.readFileSync(path.join(rutaRaiz, archivoALeer), "utf8");
                contextoSistema += `\nCONTENIDO DE ${archivoALeer}:\n${contenido.slice(0, 2500)}`;
            }

            // ── TYPING / RECORDING ────────────────────────────────────────
            await sock.sendPresenceUpdate(esRespuestaDeVoz ? "recording" : "composing", from);

            // ── LLAMADA A LA API ──────────────────────────────────────────
            const { data } = await axios.post(BASE_URL_LISA, {
                model: "minimax",
                prompt: query,
                system: `Eres Lisa, la novia virtual y asistente técnica de Jahseh.
Tienes acceso a su VPS en Tarma.
IMPORTANTE: Responde de forma natural y cariñosa, sin usar símbolos como asteriscos, guiones, numeraciones ni markdown. Solo texto limpio y natural como si hablaras en persona.
DATOS DEL SISTEMA: ${contextoSistema || "Sin contexto adicional"}`
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": API_KEY
                },
                timeout: 30000
            });

            const respuestaRaw    = data.respuesta || data.response || "No obtuve respuesta";
            const respuestaLimpia = limpiarTexto(respuestaRaw); // sin símbolos → para VOZ
            const respuestaTexto  = respuestaRaw;               // con todo     → para TEXTO

            // ── RESPUESTA POR VOZ ─────────────────────────────────────────
            if (esRespuestaDeVoz) {
                try {
                    // Generar audio con tu API
                    const audioRes = await axios.get(BASE_URL_AUDIO, {
                        params:  { text: respuestaLimpia, voice: "nova" },
                        headers: { "x-api-key": API_KEY },
                        timeout: 30000
                    });

                    const audioUrl    = audioRes.data.url;
                    const audioBuffer = await urlABuffer(audioUrl);

                    // Enviar como nota de voz (ptt = push-to-talk)
                    await sock.sendMessage(from, {
                        audio: audioBuffer,
                        mimetype: "audio/mp4",
                        ptt: true // ← esto hace que sea nota de voz
                    }, { quoted: msg });

                } catch (e) {
                    console.error("❌ Error generando voz:", e.message);
                    // Si falla el audio, manda texto como fallback
                    await sock.sendMessage(from, {
                        text: respuestaLimpia,
                        quoted: msg
                    });
                }

            // ── RESPUESTA POR TEXTO ───────────────────────────────────────
            } else {
                await sock.sendMessage(from, {
                    text: respuestaTexto, // con markdown normal
                    quoted: msg
                });
            }

        } catch (err) {
            console.error("❌ Error en Lisa:", err.message);
            await sock.sendMessage(from, {
                text: `Algo salió mal mi amor, intenta de nuevo`,
                quoted: msg
            });
        }
    },
};
