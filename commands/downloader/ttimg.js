const axios = require("axios");
const fs = require("fs");

module.exports = {
    command: ["ttimg", "tikimg", "ttphoto"],
    description: "Descarga imágenes de slideshows de TikTok sin marca de agua",
    category: "downloader",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const url = args[0];

            if (!url || !url.includes("tiktok.com")) {
                return await sock.sendMessage(from, {
                    text: `❌ *Uso incorrecto*\n\n💡 *Uso:* !ttimg <url>\n\n_Proporciona una URL válida de TikTok con slideshow._`
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

            const loadingPath = "./media/loading.mp4";
            await sock.sendMessage(from, {
                ...(fs.existsSync(loadingPath)
                    ? { video: fs.readFileSync(loadingPath), gifPlayback: true }
                    : { text: "⏳ *Descargando imágenes...*" }),
                caption: "⏳ *Descargando imágenes...*\n\n_Procesando slideshow, espera un momento._"
            }, { quoted: msg });

            const { data } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`);

            if (data.code !== 0 || !data.data) {
                return await sock.sendMessage(from, {
                    text: "❌ *Error al procesar*\n\n_No se pudo obtener información. Verifica la URL._"
                }, { quoted: msg });
            }

            const videoData = data.data;

            if (!videoData.images || videoData.images.length === 0) {
                return await sock.sendMessage(from, {
                    text: "❌ *Este TikTok no tiene imágenes*\n\n_Este es un video normal. Usa !tiktok para descargarlo._"
                }, { quoted: msg });
            }

            const caption = `✅ *TIKTOK SLIDESHOW*\n\n\`📝 Descripción\`: ${videoData.title || "Sin descripción"}\n\`👤 Autor\`: @${videoData.author?.unique_id || "desconocido"}\n\`❤️ Likes\`: ${(videoData.digg_count || 0).toLocaleString()}\n\`💬 Comentarios\`: ${(videoData.comment_count || 0).toLocaleString()}\n\`🔄 Compartidos\`: ${(videoData.share_count || 0).toLocaleString()}\n\`▶️ Reproducciones\`: ${(videoData.play_count || 0).toLocaleString()}\n\`📊 Total imágenes\`: ${videoData.images.length}`;

            // Descargar y enviar imágenes una por una
            for (let i = 0; i < videoData.images.length; i++) {
                try {
                    const imgRes = await axios.get(videoData.images[i], { responseType: "arraybuffer" });
                    await sock.sendMessage(from, {
                        image: Buffer.from(imgRes.data),
                        caption: i === 0 ? caption : `📸 Imagen ${i + 1}/${videoData.images.length}`
                    }, { quoted: i === 0 ? msg : undefined });
                    console.log(`✅ Imagen ${i + 1}/${videoData.images.length} enviada`);
                } catch (e) {
                    console.error(`❌ Error descargando imagen ${i + 1}:`, e.message);
                }
            }

            // Enviar audio si existe
            if (videoData.music) {
                try {
                    await new Promise(r => setTimeout(r, 2000));
                    const audioRes = await axios.get(videoData.music, { responseType: "arraybuffer" });
                    await sock.sendMessage(from, {
                        audio: Buffer.from(audioRes.data),
                        mimetype: "audio/mpeg",
                        fileName: "tiktok_audio.mp3",
                        ptt: false
                    });
                } catch {
                    console.warn("⚠️ Audio no disponible");
                }
            }

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("❌ Error en TikTok Images:", err.message);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
            await sock.sendMessage(from, {
                text: `❌ *Error al descargar*\n\n_${err.message || "Error desconocido"}_`
            }, { quoted: msg });
        }
    }
};