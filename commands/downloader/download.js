// ═══════════════════════════════════════════════════════════
// commands/downloader/download.js
// Descarga unificada: TikTok, YouTube, Instagram
// Usa api.devmatrixs.lat/api/download
// ═══════════════════════════════════════════════════════════

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);
const { download } = require("../../utils/devmatrixs-api");

const fakeContact = {
    key: { fromMe: false, participant: "0@s.whatsapp.net" },
    message: {
        contactMessage: {
            displayName: "💀 MR. ROBOT | DevMatrixs 💀",
            vcard: "BEGIN:VCARD\nVERSION:3.0\nN:;Mr. Robot;;;\nFN:Mr. Robot\nORG:DevMatrixs\nTITLE:Operativo\nitem1.TEL;waid=0:+0\nitem1.X-ABLabel:WhatsApp\nEND:VCARD"
        }
    }
};

const pad  = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s).padEnd(n);
const trim = (s, n) => String(s).length > n  ? String(s).slice(0, n - 3) + "..." : String(s);

/**
 * Detecta la plataforma a partir de la URL
 */
function detectPlatform(url) {
    if (!url) return null;
    if (url.includes("tiktok.com") || url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) return "tiktok";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes("instagram.com")) return "instagram";
    return null;
}

/**
 * Emoji/ícono según plataforma
 */
function platformEmoji(platform) {
    const map = { tiktok: "🎵", youtube: "▶️", instagram: "📸" };
    return map[platform] || "📥";
}

/**
 * Nombre de plataforma legible
 */
function platformName(platform) {
    const map = { tiktok: "TikTok", youtube: "YouTube", instagram: "Instagram" };
    return map[platform] || platform;
}

module.exports = {
    command: ["dl", "download", "descargar", "ig", "igdl", "insta"],
    description: "Descarga videos de TikTok, YouTube e Instagram usando la API DevMatrixs",
    category: "downloader",

    handle: async (sock, from, msg, command, args, sender) => {
        let tempFiles = [];

        try {
            const url = args[0];

            if (!url) {
                return await sock.sendMessage(from, {
                    text: [
                        "```",
                        "╔══════════════════════════════╗",
                        "║  📥  DESCARGADOR UNIVERSAL   ║",
                        "╚══════════════════════════════╝",
                        "",
                        "[!] Uso:",
                        "  .dl <url>       → Auto-detecta",
                        "  .ig <url>       → Instagram",
                        "  .download <url> → Universal",
                        "",
                        "[~] Plataformas soportadas:",
                        "  • TikTok   (.tt / .tiktok)",
                        "  • YouTube  (.yt / .ytmp3)",
                        "  • Instagram (.ig / .insta)",
                        "",
                        "[~] Ejemplo:",
                        "  .dl https://vm.tiktok.com/xxx",
                        "",
                        "💀 DevMatrixs — api.devmatrixs.lat",
                        "```"
                    ].join("\n")
                }, { quoted: fakeContact });
            }

            const platform = detectPlatform(url);

            if (!platform) {
                return await sock.sendMessage(from, {
                    text: "❌ *URL no soportada*\n\n_Solo se acepta: TikTok, YouTube o Instagram._"
                }, { quoted: msg });
            }

            // Reacción de carga
            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
            await sock.sendMessage(from, {
                text: `${platformEmoji(platform)} *Procesando ${platformName(platform)}...*\n\n_Conectando con API DevMatrixs..._`
            }, { quoted: fakeContact });

            // ── Llamar a la API ──
            const result = await download(url);

            if (!result?.success) {
                throw new Error(result?.error || "La API no pudo procesar el contenido.");
            }

            const title     = result.title     || `Contenido de ${platformName(platform)}`;
            const author    = result.author    || "";
            const thumbnail = result.thumbnail || "";
            const formats   = result.formats   || [];
            const duration  = result.duration  || "";

            if (formats.length === 0) {
                throw new Error("No se encontraron formatos de descarga.");
            }

            // ── Construir caption ──
            let caption = [
                "```",
                "╔══════════════════════════════╗",
                `║  ${platformEmoji(platform)}  ${pad(platformName(platform).toUpperCase(), 26)}║`,
                "║  ──────────────────────────  ║",
                "║  ✅  DESCARGA COMPLETA       ║",
                "╚══════════════════════════════╝",
                "```",
                "",
                `📌 *${trim(title, 50)}*`,
            ];

            if (author)   caption.push(`👤 *Autor:* ${author}`);
            if (duration)  caption.push(`⏱️ *Duración:* ${duration}`);
            caption.push(`📦 *Formatos:* ${formats.length} disponible(s)`);
            caption.push("");
            caption.push("💀 _DevMatrixs — api.devmatrixs.lat_");

            const captionText = caption.join("\n");

            // ── Enviar contenido según tipo ──
            // Buscar el mejor formato de video
            const videoFormat = formats.find(f => f.type === "video");
            const audioFormat = formats.find(f => f.type === "audio");
            const imageFormats = formats.filter(f => f.type === "image");

            // Prioridad: Video > Audio > Imágenes
            if (videoFormat) {
                await sock.sendMessage(from, {
                    video: { url: videoFormat.url },
                    caption: captionText,
                    mimetype: "video/mp4",
                    fileName: videoFormat.filename || `${platform}_video.mp4`,
                }, { quoted: fakeContact });

                // Si hay audio además del video, enviarlo aparte
                if (audioFormat && platform === "tiktok") {
                    await sock.sendMessage(from, {
                        audio: { url: audioFormat.url },
                        mimetype: "audio/mpeg",
                        ptt: false,
                        fileName: audioFormat.filename || "audio.mp3",
                    });
                }

            } else if (imageFormats.length > 0) {
                // Instagram carousel u otro contenido con imágenes
                for (let i = 0; i < imageFormats.length; i++) {
                    const imgFormat = imageFormats[i];
                    try {
                        const imgRes = await axios.get(imgFormat.url, {
                            responseType: "arraybuffer",
                            timeout: 30000,
                        });
                        await sock.sendMessage(from, {
                            image: Buffer.from(imgRes.data),
                            caption: i === 0 ? captionText : `📸 ${imgFormat.label || `Imagen ${i + 1}/${imageFormats.length}`}`,
                        }, i === 0 ? { quoted: fakeContact } : undefined);
                    } catch (imgErr) {
                        console.error(`❌ Error descargando imagen ${i + 1}:`, imgErr.message);
                    }
                }

            } else if (audioFormat) {
                // Solo audio disponible
                const audioRes = await axios.get(audioFormat.url, {
                    responseType: "arraybuffer",
                    timeout: 60000,
                });

                await sock.sendMessage(from, {
                    audio: Buffer.from(audioRes.data),
                    mimetype: "audio/mpeg",
                    ptt: false,
                    fileName: audioFormat.filename || "audio.mp3",
                }, { quoted: fakeContact });

                await sock.sendMessage(from, {
                    text: captionText,
                }, { quoted: fakeContact });
            }

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("❌ [DL] Error:", err.message);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });

            let errorMsg = "❌ Error al descargar el contenido.";
            if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT")
                errorMsg = "⏱️ Timeout — el servidor tardó demasiado.";
            else if (err.response?.status === 401)
                errorMsg = "🔑 API Key inválida. Contacta al owner.";
            else if (err.response?.status === 429)
                errorMsg = "⚠️ Límite de solicitudes alcanzado. Intenta más tarde.";
            else if (err.response?.status === 400)
                errorMsg = `❌ ${err.response?.data?.error || "URL no soportada."}`;
            else if (err.message.includes("formatos"))
                errorMsg = "❌ No se encontraron archivos para descargar.";

            const d = pad(trim(errorMsg, 40), 40);
            await sock.sendMessage(from, {
                text: [
                    "```",
                    "╔══════════════════════════════════════════╗",
                    "║  ⚠️   ERROR EN LA DESCARGA               ║",
                    "║  ────────────────────────────────────    ║",
                    `║  ${d}║`,
                    "╚══════════════════════════════════════════╝",
                    "```",
                    "",
                    `🔍 *Detalle:* ${err.message}`
                ].join("\n"),
            }, { quoted: fakeContact });

        } finally {
            tempFiles.forEach(f => {
                try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
            });
        }
    }
};
