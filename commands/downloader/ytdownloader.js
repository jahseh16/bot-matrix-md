const yts     = require("yt-search");
const axios   = require("axios");
const NodeID3 = require("node-id3");

const BASE    = "https://api.devmatrixs.lat";
const API_KEY = process.env.DEVMATRIX_API_KEY || "mk-695591790f0f21e807e1a15ae849328998e63bfb17dd67ec";

function fixJid(jid) {
    if (!jid) return null;
    if (jid.includes("@")) return jid;
    if (jid.includes("-")) return `${jid}@g.us`;
    return `${jid}@s.whatsapp.net`;
}
function getChatId(m) {
    return m.chat || m.key?.remoteJid || m.key?.participant || m.message?.key?.remoteJid || m.sender || null;
}
async function send(sock, msg, content, options = {}) {
    try {
        const jid = fixJid(getChatId(msg));
        if (!jid) throw new Error("jid invalido");
        await sock.sendMessage(jid, content, options);
    } catch (err) { console.error("❌ send error:", err.message); }
}

const pad  = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s).padEnd(n);
const trim = (s, n) => String(s).length > n  ? String(s).slice(0, n - 3) + "..." : String(s);

const fakeContact = {
    key: { fromMe: false, participant: "0@s.whatsapp.net" },
    message: {
        contactMessage: {
            displayName: "💀 MR. ROBOT | fsociety 💀",
            vcard: "BEGIN:VCARD\nVERSION:3.0\nN:;Mr. Robot;;;\nFN:Mr. Robot\nORG:fsociety devmatrixs.lat\nTITLE:Operativo\nitem1.TEL;waid=0:+0\nitem1.X-ABLabel:WhatsApp\nEND:VCARD"
        }
    }
};

module.exports = {
    command: ["yt", "youtube", "ytmp3", "ytaudio", "yta", "ytmp4", "ytvideo"],
    description: "YouTube downloader — Mr. Robot Edition",
    category: "downloader",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const query = args.join(" ").trim();

            if (!query) {
                return await send(sock, msg, {
                    text: [
                        "```",
                        "╔══════════════════════════════╗",
                        "║  🖥️  MR. ROBOT — SISTEMA YT  ║",
                        "╚══════════════════════════════╝",
                        "",
                        "[!] Comandos:",
                        "  !yt <busqueda>     -> info",
                        "  !ytmp3 <busqueda>  -> MP3",
                        "  !ytmp4 <busqueda>  -> MP4",
                        "",
                        "[~] Ejemplo:",
                        "  !ytmp3 bad bunny",
                        "",
                        "💀 fsociety — devmatrixs.lat",
                        "```"
                    ].join("\n")
                }, { quoted: fakeContact });
            }

            await send(sock, msg, { react: { text: "💊", key: msg.key } });
            await send(sock, msg, {
                text: "```\n[🖥️] Conectando a la matriz...\n[📡] Buscando...\n```"
            }, { quoted: fakeContact });

            const search = await yts(query);
            if (!search.videos?.length) {
                return await send(sock, msg, {
                    text: "```\n[×] Sin resultados. Prueba otro termino.\n```"
                }, { quoted: fakeContact });
            }

            const v        = search.videos[0];
            const url      = v.url;
            const title    = v.title;
            const channel  = v.author?.name || "Desconocido";
            const duration = v.timestamp    || "N/A";
            const views    = v.views ? v.views.toLocaleString() : "N/A";
            const thumb    = v.thumbnail || v.image || "";

            // ── INFO ─────────────────────────────────────────────────
            if (command === "yt" || command === "youtube") {
                await send(sock, msg, {
                    image: { url: thumb },
                    caption: [
                        "```",
                        "╔══════════════════════════════╗",
                        "║  🖥️  MR. ROBOT — YT INFO     ║",
                        "╚══════════════════════════════╝",
                        "",
                        "📌 " + trim(title, 45),
                        "",
                        "👤 Canal    : " + trim(channel, 22),
                        "⏱️  Duracion : " + duration,
                        "👁️  Vistas   : " + views,
                        "",
                        "🔗 " + url,
                        "",
                        "[~] Descargar:",
                        "  !ytmp3 " + query,
                        "  !ytmp4 " + query,
                        "",
                        "💀 fsociety — MR.ROBOT",
                        "```"
                    ].join("\n")
                }, { quoted: fakeContact });
                return await send(sock, msg, { react: { text: "✅", key: msg.key } });
            }

            // ── MP3 ──────────────────────────────────────────────────
            if (["ytmp3", "ytaudio", "yta"].includes(command)) {
                await send(sock, msg, {
                    image: { url: thumb },
                    caption: "```\n[📡] Extrayendo audio...\n[🔓] Desencriptando stream...\n[⏳] Procesando MP3...\n```"
                }, { quoted: fakeContact });

                const { data } = await axios.get(`${BASE}/api/ytmp3`, {
                    params: { url },
                    headers: { "x-api-key": API_KEY },
                    timeout: 60000,
                    validateStatus: () => true
                });

                if (!data?.success) throw new Error(data?.error || "API error");
                if (!data.file)     throw new Error("Sin enlace de descarga");

                const audioTitle = data.title    || title;
                const dur        = data.duration || duration;
                const audioUrl   = `${BASE}${data.file}`;

                const [audioBuffer, thumbBuffer] = await Promise.all([
                    axios.get(audioUrl, { responseType: "arraybuffer" }).then(r => Buffer.from(r.data)),
                    data.thumb
                        ? axios.get(data.thumb, { responseType: "arraybuffer" }).then(r => Buffer.from(r.data))
                        : Promise.resolve(null)
                ]);

                let finalBuffer = audioBuffer;
                if (thumbBuffer) {
                    const updated = NodeID3.update({
                        title: audioTitle, artist: channel, album: "Mr. Robot Downloader",
                        image: {
                            mime: "image/jpeg",
                            type: { id: 3, name: "Cover" },
                            description: "Cover",
                            imageBuffer: thumbBuffer
                        }
                    }, audioBuffer);
                    if (updated) finalBuffer = updated;
                }

                await send(sock, msg, {
                    audio: finalBuffer,
                    mimetype: "audio/mpeg",
                    ptt: false,
                    fileName: `${audioTitle}.mp3`
                }, { quoted: fakeContact });

                const t = pad(trim(audioTitle, 26), 26);
                const d = pad(dur, 14);
                await send(sock, msg, {
                    text: [
                        "```",
                        "╔══════════════════════════════╗",
                        "║  🖥️  MR. ROBOT — MP3         ║",
                        "║  ──────────────────────────  ║",
                        "║  ✅  DESCARGA COMPLETA       ║",
                        "║                              ║",
                        "║  🎵 " + t + "  ║",
                        "║  ⏱️  Duracion : " + d + "║",
                        "║  📁 Formato   : MP3 (ID3v2)  ║",
                        "║  🖼️  Caratula  : INCRUSTADA   ║",
                        "║  ──────────────────────────  ║",
                        "║       💀 fsociety 💀          ║",
                        "╚══════════════════════════════╝",
                        "```"
                    ].join("\n")
                }, { quoted: fakeContact });

                return await send(sock, msg, { react: { text: "✅", key: msg.key } });
            }

            // ── MP4 ──────────────────────────────────────────────────
            if (["ytmp4", "ytvideo"].includes(command)) {
                await send(sock, msg, {
                    image: { url: thumb },
                    caption: "```\n[📡] Extrayendo video...\n[🔓] Accediendo al stream...\n[⏳] Procesando MP4 720p...\n```"
                }, { quoted: fakeContact });

                const { data } = await axios.get(`${BASE}/api/ytmp4`, {
                    params: { url, quality: "720" },
                    headers: { "x-api-key": API_KEY },
                    timeout: 120000,
                    validateStatus: () => true
                });

                if (!data?.success) throw new Error(data?.error || "API error");
                if (!data.file)     throw new Error("Sin enlace de video");

                const videoTitle = data.title    || title;
                const qual       = data.quality  || "720p";
                const dur        = data.duration || duration;
                const videoUrl   = `${BASE}${data.file}`;

                const t = pad(trim(videoTitle, 26), 26);
                const d = pad(dur, 14);
                const q = pad(qual, 14);

                await send(sock, msg, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    fileName: `${videoTitle}.mp4`,
                    caption: [
                        "```",
                        "╔══════════════════════════════╗",
                        "║  🖥️  MR. ROBOT — MP4         ║",
                        "║  ──────────────────────────  ║",
                        "║  ✅  DESCARGA COMPLETA       ║",
                        "║                              ║",
                        "║  🎬 " + t + "  ║",
                        "║  ⏱️  Duracion : " + d + "║",
                        "║  🎞️  Calidad  : " + q + "║",
                        "║  ──────────────────────────  ║",
                        "║       💀 fsociety 💀          ║",
                        "╚══════════════════════════════╝",
                        "```"
                    ].join("\n")
                }, { quoted: fakeContact });

                return await send(sock, msg, { react: { text: "✅", key: msg.key } });
            }

        } catch (err) {
            console.error("❌ [MR.ROBOT-YT] Error:", err.message);
            await send(sock, msg, { react: { text: "❌", key: msg.key } });

            let detail = err.message;
            if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT")
                detail = "Timeout — servidor tardó demasiado.";
            else if (err.response?.status === 401) detail = "API Key invalida.";
            else if (err.response?.status === 429) detail = "Rate limit. Espera.";
            else if (err.response?.status === 404) detail = "Video no encontrado.";

            const d = pad(trim(detail, 28), 28);
            await send(sock, msg, {
                text: [
                    "```",
                    "╔══════════════════════════════╗",
                    "║  ⚠️   FALLO EN LA MATRIX     ║",
                    "║  ──────────────────────────  ║",
                    "║  " + d + "  ║",
                    "╚══════════════════════════════╝",
                    "```"
                ].join("\n")
            }, { quoted: fakeContact });
        }
    }
};
