// ═══════════════════════════════════════════════════════════
// commands/IA/imagine.js
// Generación de imágenes con IA usando api.devmatrixs.lat/api/image
// ═══════════════════════════════════════════════════════════

const axios = require("axios");
const { generateImage } = require("../../utils/devmatrixs-api");

const fakeContact = {
    key: { fromMe: false, participant: "0@s.whatsapp.net" },
    message: {
        contactMessage: {
            displayName: "🎨 Matrix Art",
            vcard: "BEGIN:VCARD\nVERSION:3.0\nN:;Matrix Art;;;\nFN:Matrix Art\nORG:DevMatrixs\nTITLE:Generador IA\nitem1.TEL;waid=0:+0\nitem1.X-ABLabel:WhatsApp\nEND:VCARD"
        }
    }
};

module.exports = {
    command: ["imagine", "imagen", "img", "draw", "dibujar", "generar"],
    description: "Genera imágenes con IA — DevMatrixs (Pollinations/Flux)",
    category: "IA",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            let prompt = args.join(" ");

            // ── Parsear dimensiones opcionales ──
            let width  = 1024;
            let height = 1024;

            // Detectar --size WxH o -s WxH
            const sizeMatch = prompt.match(/(?:--size|-s)\s+(\d+)x(\d+)/i);
            if (sizeMatch) {
                width  = Math.min(parseInt(sizeMatch[1]), 2048);
                height = Math.min(parseInt(sizeMatch[2]), 2048);
                prompt = prompt.replace(/(?:--size|-s)\s+\d+x\d+/i, "").trim();
            }

            if (!prompt) {
                return await sock.sendMessage(from, {
                    text: [
                        "```",
                        "╔══════════════════════════════╗",
                        "║  🎨  GENERADOR DE IMÁGENES   ║",
                        "╚══════════════════════════════╝",
                        "```",
                        "",
                        "💡 *Uso:*",
                        "  `.imagine <descripción>`",
                        "",
                        "📐 *Tamaño personalizado:*",
                        "  `.imagine -s 512x512 un gato`",
                        "",
                        "📝 *Ejemplos:*",
                        "  `.imagine un dragón cyberpunk`",
                        "  `.imagine paisaje anime al atardecer`",
                        "  `.img retrato realista de un samurái`",
                        "",
                        "🖼️ *Resolución por defecto:* 1024x1024",
                        "",
                        "_Powered by api.devmatrixs.lat_",
                    ].join("\n")
                }, { quoted: fakeContact });
            }

            await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });
            await sock.sendMessage(from, {
                text: `🎨 *Generando imagen...*\n\n📝 _"${prompt.length > 80 ? prompt.slice(0, 77) + "..." : prompt}"_\n📐 _${width}x${height}_\n\n⏳ _Esto puede tardar 10-30 segundos..._`
            }, { quoted: fakeContact });

            // ── Llamar API ──
            const result = await generateImage({ prompt, width, height });

            if (!result?.ok || !result?.url) {
                throw new Error(result?.error || "No se pudo generar la imagen.");
            }

            // ── Descargar imagen y enviar ──
            const imgRes = await axios.get(result.url, {
                responseType: "arraybuffer",
                timeout: 30000,
            });

            const caption = [
                "```",
                "╔══════════════════════════════╗",
                "║  🎨  IMAGEN GENERADA CON IA  ║",
                "║  ──────────────────────────  ║",
                "║  ✅  GENERACIÓN COMPLETA     ║",
                "╚══════════════════════════════╝",
                "```",
                "",
                `📝 *Prompt:* ${prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt}`,
                `📐 *Resolución:* ${width}x${height}`,
                `🖌️ *Modelo:* ${result.model || "flux"}`,
                "",
                "💀 _DevMatrixs — api.devmatrixs.lat_",
            ].join("\n");

            await sock.sendMessage(from, {
                image: Buffer.from(imgRes.data),
                caption,
            }, { quoted: fakeContact });

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("❌ [Imagine] Error:", err.message);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });

            let errorMsg = "❌ Error al generar la imagen.";
            if (err.response?.status === 401)
                errorMsg = "🔑 API Key inválida.";
            else if (err.response?.status === 429)
                errorMsg = "⚠️ Límite diario alcanzado. Intenta mañana.";
            else if (err.response?.status === 400)
                errorMsg = `❌ ${err.response?.data?.error || "Prompt inválido."}`;
            else if (err.code === "ECONNABORTED")
                errorMsg = "⏱️ Timeout — el servidor tardó demasiado.";

            await sock.sendMessage(from, {
                text: `${errorMsg}\n\n🔍 *Detalle:* ${err.message}`
            }, { quoted: msg });
        }
    }
};
