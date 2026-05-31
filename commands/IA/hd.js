const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const SERVER    = 'https://image-upscaling.net';
const CLIENT_ID = 'ZERODAY1BOT23456789ABCDEFGHIJKLM'; // ✅ exactamente 32 chars

module.exports = {
    command: ["hd", "enhance", "mejorar", "upscale"],
    description: "Mejora la calidad de imágenes usando IA (4x)",
    category: "IA",

    handle: async (sock, from, msg, command, args, sender) => {
        let tmpFile = null;

        try {
            const { downloadContentFromMessage } = await import('@itsukichan/baileys');

            // 1) Verificar imagen propia o respondida
            const imageMessage =
                msg.message?.imageMessage ||
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
                null;

            if (!imageMessage) {
                return await sock.sendMessage(from, {
                    text: `✳️ *Uso incorrecto.*\n\n💡 Responde a una imagen con *!hd*\n\n📌 *Pasos:*\n   1. Envía o reenvía una imagen\n   2. Responde con: *!hd*\n\n✨ La imagen será mejorada 4x con IA`,
                    mentions: [sender]
                });
            }

            await sock.sendMessage(from, { react: { text: '🧪', key: msg.key } });
            await sock.sendMessage(from, {
                text: `⏳ *Mejorando imagen con IA...*\n_Puede tardar 15-30 segundos._`
            });

            // 2) Directorio temporal
            const tmpDir = path.join(__dirname, '..', '..', 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

            // 3) Descargar imagen de WhatsApp
            const stream = await downloadContentFromMessage(imageMessage, 'image');
            tmpFile = path.join(tmpDir, `${Date.now()}_hd.jpg`);
            const writeStream = fs.createWriteStream(tmpFile);
            for await (const chunk of stream) writeStream.write(chunk);
            writeStream.end();
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            // 4) Subir imagen a image-upscaling.net
            const form = new FormData();
            form.append('image', fs.createReadStream(tmpFile), {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });
            form.append('scale', '4');
            form.append('model', 'general'); // general = imágenes grandes, plus = medianas
            // form.append('fx', '');        // descomentar para mejorar rostros

            const uploadRes = await axios.post(
                `${SERVER}/upscaling_upload`,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        'Cookie': `client_id=${CLIENT_ID}`
                    },
                    timeout: 30000
                }
            );

            const originalFilename = uploadRes.data;
            console.log('📤 Upload OK:', originalFilename);

            // 5) Polling con upscaling_get_status_v2 (estructura correcta)
            let resultUrl = null;

            for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 2000));

                const statusRes = await axios.get(
                    `${SERVER}/upscaling_get_status_v2`,
                    {
                        headers: { 'Cookie': `client_id=${CLIENT_ID}` },
                        timeout: 10000
                    }
                );

                const entries = statusRes.data;
                console.log(`🔄 Check ${i + 1}:`, JSON.stringify(entries));

                // Buscar la entrada que corresponde a nuestra imagen
                for (const entry of entries) {
                    if (entry.original_filename === originalFilename && entry.completed) {
                        resultUrl = entry.image_url;
                        break;
                    }
                }

                if (resultUrl) break;

                // Si no hay nada en cola después de varios checks, falló
                if (i >= 15 && entries.length === 0) {
                    throw new Error('La API no procesó la imagen. Inténtalo de nuevo.');
                }
            }

            if (!resultUrl) throw new Error('Timeout esperando resultado de la API.');

            // 6) Descargar imagen mejorada y borrar del servidor
            const imgRes = await axios.get(resultUrl, {
                headers: { 'Cookie': `client_id=${CLIENT_ID}` },
                params: { delete_after_download: '' },
                responseType: 'arraybuffer',
                timeout: 30000
            });

            const resultBuffer = Buffer.from(imgRes.data);

            // 7) Enviar al chat
            await sock.sendMessage(from, {
                image: resultBuffer,
                caption: `✨ *Imagen mejorada 4x con éxito*\n\n🤖 _Procesado con IA De jahseh_`
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ Error en HD enhancer:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });

            let errorMsg = '❌ Error al mejorar la imagen.';
            if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')
                errorMsg = '⏱️ Timeout. Intenta con una imagen más pequeña.';
            else if (err.response?.status === 429)
                errorMsg = '⚠️ Cuota diaria agotada. Intenta mañana.';
            else if (err.message.includes('no procesó'))
                errorMsg = '❌ La API no pudo procesar la imagen. Intenta con otra.';
            else if (err.message.includes('Timeout esperando'))
                errorMsg = '⏳ El servidor tardó demasiado. Inténtalo de nuevo.';

            await sock.sendMessage(from, { text: errorMsg });

        } finally {
            try {
                if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            } catch (e) {}
        }
    }
};