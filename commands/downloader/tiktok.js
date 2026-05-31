const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);

module.exports = {
    command: ["tiktok", "tt", "ttdl"],
    description: "Descarga videos y slideshows de TikTok sin marca de agua",
    category: "downloader",

    handle: async (sock, from, msg, command, args, sender) => {
        let tempFiles = [];

        try {
            const url = args[0];

            if (!url || (!url.includes("tiktok.com") && !url.includes("vt.tiktok.com"))) {
                return await sock.sendMessage(from, {
                    text: `❌ *Envía un enlace válido de TikTok*\n\n💡 *Uso:* !tiktok <url>\n\n📝 *Ejemplo:*\n!tt https://vm.tiktok.com/XXXXXX/\n!tt https://vt.tiktok.com/XXXXX/\n\n✨ *Soporta:*\n• Videos normales\n• Slideshows (fotos + audio)\n• Sin marca de agua`
                }, { quoted: msg });
            }

            // Expandir URL corta si es necesario
            let finalUrl = url.trim();
            if (finalUrl.includes("vm.tiktok.com") || finalUrl.includes("vt.tiktok.com")) {
                try {
                    const expandRes = await axios.get(finalUrl, {
                        maxRedirects: 5,
                        timeout: 10000,
                        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
                    });
                    finalUrl = expandRes.request.res.responseUrl || finalUrl;
                } catch {
                    console.log("No se pudo expandir URL, usando original");
                }
            }

            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
            await sock.sendMessage(from, {
                text: "⏳ *Descargando contenido de TikTok...*"
            }, { quoted: msg });

            // API 1: TikWM
            let tikData = null;
            let apiUsed = "";

            try {
                const res1 = await axios.get(
                    `https://tikwm.com/api/?url=${encodeURIComponent(finalUrl)}`,
                    { timeout: 20000, headers: { "User-Agent": "Mozilla/5.0" } }
                );
                if (res1.data.code === 0 && res1.data.data) {
                    tikData = res1.data.data;
                    apiUsed = "TikWM";
                }
            } catch {
                console.log("TikWM falló, intentando alternativa...");
            }

            // API 2: TiklyDown
            if (!tikData) {
                try {
                    const res2 = await axios.get(
                        `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(finalUrl)}`,
                        { timeout: 20000, headers: { "User-Agent": "Mozilla/5.0" } }
                    );
                    if (res2.data?.video) {
                        tikData = {
                            title: res2.data.title || "TikTok Video",
                            author: { nickname: res2.data.author?.nickname || "Usuario" },
                            play: res2.data.video?.noWatermark || res2.data.video?.watermark,
                            music: res2.data.music?.play_url,
                            images: res2.data.images || null,
                            digg_count: 0, comment_count: 0, share_count: 0, play_count: 0
                        };
                        apiUsed = "TiklyDown";
                    }
                } catch {
                    console.log("TiklyDown también falló");
                }
            }

            if (!tikData) throw new Error("No se pudo obtener el contenido. El video puede ser privado.");

            const author  = tikData.author?.nickname || tikData.author?.unique_id || "Desconocido";
            const title   = tikData.title || "Contenido de TikTok";
            const caption = `✅ *TIKTOK DOWNLOADER*\n\n👤 *Autor:* ${author}\n📝 *Descripción:* ${title}\n\n📊 *Estadísticas:*\n\`❤️ Likes\`: ${(tikData.digg_count || 0).toLocaleString()}\n\`💬 Comentarios\`: ${(tikData.comment_count || 0).toLocaleString()}\n\`🔄 Compartidos\`: ${(tikData.share_count || 0).toLocaleString()}\n\`▶️ Reproducciones\`: ${(tikData.play_count || 0).toLocaleString()}`;

            // ── SLIDESHOW ──
            if (tikData.images && tikData.images.length > 0) {
                await sock.sendMessage(from, {
                    text: `📸 *Slideshow detectado (${tikData.images.length} imágenes)*\n\n🎬 Creando video con audio...`
                }, { quoted: msg });

                const tempDir = path.join(__dirname, "..", "..", "tmp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                const ts = Date.now();

                // Descargar imágenes
                for (let i = 0; i < tikData.images.length; i++) {
                    const imgPath = path.join(tempDir, `img_${ts}_${i}.jpg`);
                    const imgRes = await axios.get(tikData.images[i], { responseType: "arraybuffer", timeout: 15000 });
                    fs.writeFileSync(imgPath, imgRes.data);
                    tempFiles.push(imgPath);
                }

                // Descargar audio
                const audioUrl = tikData.music || tikData.music_info?.play;
                const audioPath = path.join(tempDir, `audio_${ts}.mp3`);
                if (audioUrl) {
                    const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 15000 });
                    fs.writeFileSync(audioPath, audioRes.data);
                    tempFiles.push(audioPath);
                }

                // Lista de imágenes para FFmpeg
                const listPath = path.join(tempDir, `list_${ts}.txt`);
                const imgFiles = tempFiles.filter(f => f.includes("img_"));
                let listContent = "";

                if (imgFiles.length === 1) {
                    listContent = `file '${imgFiles[0]}'\nduration 15\nfile '${imgFiles[0]}'`;
                } else if (imgFiles.length === 2) {
                    listContent = `file '${imgFiles[0]}'\nduration 8\nfile '${imgFiles[1]}'\nduration 8\nfile '${imgFiles[1]}'`;
                } else {
                    listContent = imgFiles.map(f => `file '${f}'\nduration 1.5`).join("\n");
                    listContent += `\nfile '${imgFiles[imgFiles.length - 1]}'`;
                }

                fs.writeFileSync(listPath, listContent);
                tempFiles.push(listPath);

                const outputVideo = path.join(tempDir, `tiktok_${ts}.mp4`);
                tempFiles.push(outputVideo);

                const vf = `scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2`;
                const ffmpegCmd = audioUrl
                    ? `ffmpeg -f concat -safe 0 -i "${listPath}" -i "${audioPath}" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 128k -shortest -pix_fmt yuv420p -vf "${vf}" -movflags +faststart "${outputVideo}" -y`
                    : `ffmpeg -f concat -safe 0 -i "${listPath}" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -vf "${vf}" -movflags +faststart "${outputVideo}" -y`;

                await execPromise(ffmpegCmd);

                if (!fs.existsSync(outputVideo)) throw new Error("No se pudo crear el video del slideshow.");

                const sizeMB = (fs.statSync(outputVideo).size / 1024 / 1024).toFixed(1);
                if (parseFloat(sizeMB) > 16) throw new Error(`El video es muy pesado (${sizeMB}MB). Máximo 16MB.`);

                await sock.sendMessage(from, {
                    video: fs.readFileSync(outputVideo),
                    caption: caption + `\n\n📦 *Tamaño:* ${sizeMB}MB`,
                    mimetype: "video/mp4"
                }, { quoted: msg });

            // ── VIDEO NORMAL ──
            } else if (tikData.play) {
                const videoUrl = tikData.hdplay || tikData.play;
                await sock.sendMessage(from, {
                    video: { url: videoUrl },
                    caption,
                    mimetype: "video/mp4"
                }, { quoted: msg });

            } else {
                throw new Error("No se encontró contenido para descargar.");
            }

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("❌ Error TikTok:", err.message);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });

            let errorMsg = "❌ Error al descargar el contenido.";
            if (err.message.includes("ffmpeg"))
                errorMsg = "🚫 FFmpeg no está instalado.\n\n*Instálalo con:*\n`sudo apt install ffmpeg`";
            else if (err.code === "ECONNABORTED")
                errorMsg = "⏱️ Timeout: La descarga tardó demasiado. Intenta de nuevo.";
            else if (err.response?.status === 404)
                errorMsg = "❌ Video no encontrado o eliminado.";
            else if (err.response?.status === 429)
                errorMsg = "⚠️ Demasiadas solicitudes. Espera un momento.";
            else if (err.message.includes("privado"))
                errorMsg = "❌ El video puede estar privado o restringido.";
            else if (err.message.includes("pesado"))
                errorMsg = `❌ ${err.message}`;

            await sock.sendMessage(from, {
                text: `${errorMsg}\n\n🔍 *Detalles:* ${err.message}`
            }, { quoted: msg });

        } finally {
            tempFiles.forEach(f => {
                try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
            });
        }
    }
};