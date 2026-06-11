'use strict';
const axios = require('axios');

const API          = 'http://161.97.184.119:4000';
const ZERO_TWO_PFP = 'https://i.pinimg.com/736x/e0/a8/90/e0a890b788b4bcc06fc2dc8c2e5c2b46.jpg';

// ── Fake Contact estilo Meta Verificado ───────────────────────────────────────
const fakeContact = {
    key: { fromMe: false, participant: '0@s.whatsapp.net' },
    message: {
        contactMessage: {
            displayName: '🌸 ZΞRØ T𝕎Ø — IG SℂAℕℕEℝ 🌸',
            vcard: [
                'BEGIN:VCARD',
                'VERSION:3.0',
                'N:;ZΞRØ T𝕎Ø;;;',
                'FN:ZΞRØ T𝕎Ø — IG SℂAℕℕEℝ',
                'ORG:devmatrixs.lat',
                'TITLE:Meta Verified ✓',
                'item1.TEL;waid=0:+0',
                'item1.X-ABLabel:WhatsApp',
                'END:VCARD'
            ].join('\n')
        }
    }
};

// ── Bloque visual estilizado ──────────────────────────────────────────────────
function header(subtitle) {
    return [
        '🌸 *ZΞRØ T𝕎Ø — IG SℂAℕℕEℝ* 🌸',
        '┠─────────────────────',
        subtitle,
        '┠─────────────────────'
    ].join('\n');
}

function infoBlock(lines) {
    return lines.map(l => `┃  ${l}`).join('\n');
}

// ── Envío seguro ──────────────────────────────────────────────────────────────
async function send(sock, msg, content, options = {}) {
    try {
        const jid = msg.key?.remoteJid || msg.chat || null;
        if (!jid) return;
        await sock.sendMessage(jid, content, options);
    } catch (err) { console.error('❌ [ig] send:', err.message); }
}

// ── Descarga un archivo vía /download?f=&tmp= y devuelve Buffer ───────────────
async function downloadFile(f, tmp) {
    const resp = await axios.get(`${API}/download`, {
        params: { f, tmp },
        responseType: 'arraybuffer',
        timeout: 180000
    });
    return Buffer.from(resp.data);
}

// ── Módulo principal ──────────────────────────────────────────────────────────
module.exports = {
    command: ['ig', 'instagram', 'insta'],
    description: 'Descarga video/imagen/carrusel de Instagram — ZΞRØ T𝕎Ø Edition',
    category: 'downloader',

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const url = args.join(' ').trim();

            if (!url || !url.includes('instagram.com')) {
                return send(sock, msg, {
                    text: [
                        header('_📋 USO DEL COMANDO_'),
                        infoBlock([
                            '📌 *.ig <url de instagram>*',
                            '',
                            '📎 Ejemplo:',
                            '   .ig https://instagram.com/p/...',
                            '',
                            '💀 _darling ~ devmatrixs.lat_'
                        ])
                    ].join('\n')
                }, { quoted: fakeContact });
            }

            // ── React + mensaje de escaneo ────────────────────────────────────
            await send(sock, msg, { react: { text: '🌸', key: msg.key } });
            await send(sock, msg, {
                text: [
                    header(
                        '📡 _[Conectando a Instagram...]_\n🔍 _[Analizando post...]_'
                    ),
                    infoBlock(['⏳ _Espera un momento, Darling..._'])
                ].join('\n')
            }, { quoted: fakeContact });

            // ── Llamada al endpoint /instagram ────────────────────────────────
            const { data: info } = await axios.get(`${API}/instagram`, {
                params: { url },
                timeout: 90000
            });

            if (!info.success) throw new Error(info.error || 'La API no pudo procesar el enlace');

            const title    = info.title    || 'Instagram';
            const uploader = info.uploader || 'Desconocido';
            const thumb    = info.thumb    || ZERO_TWO_PFP;

            // ── Carrusel ──────────────────────────────────────────────────────
            if (info.type === 'carousel') {
                await send(sock, msg, {
                    text: [
                        header(`_📸 Carrusel detectado — ${info.count} archivos_`),
                        infoBlock([
                            `📌 ${title.slice(0, 30)}`,
                            `👤 @${uploader.slice(0, 28)}`,
                            '',
                            '📦 _Enviando archivo a archivo..._'
                        ])
                    ].join('\n')
                }, { quoted: fakeContact });

                for (let i = 0; i < info.files.length; i++) {
                    const item = info.files[i];
                    // item debe tener { f, tmp, type }
                    const buf = await downloadFile(item.f, item.tmp);
                    if (item.type === 'video') {
                        await send(sock, msg, { video: buf, mimetype: 'video/mp4' }, { quoted: fakeContact });
                    } else {
                        await send(sock, msg, { image: buf }, { quoted: fakeContact });
                    }
                }

                await send(sock, msg, { react: { text: '✅', key: msg.key } });
                return send(sock, msg, {
                    text: [
                        header('_✅ CARRUSEL COMPLETADO_'),
                        infoBlock([
                            `🗂  ${info.count} archivos enviados`,
                            `👤 @${uploader.slice(0, 28)}`,
                            '',
                            '💀 _darling ~ devmatrixs.lat_'
                        ])
                    ].join('\n')
                }, { quoted: fakeContact });
            }

            // ── Video individual ──────────────────────────────────────────────
            if (info.type === 'video') {
                await send(sock, msg, {
                    text: [
                        header('_🎬 Video encontrado — descargando..._'),
                        infoBlock([
                            `📌 ${title.slice(0, 30)}`,
                            `👤 @${uploader.slice(0, 28)}`,
                            '',
                            '📡 _[Procesando stream HD...]_'
                        ])
                    ].join('\n')
                }, { quoted: fakeContact });

                const buf = await downloadFile(info.f, info.tmp);
                await send(sock, msg, {
                    video: buf,
                    mimetype: 'video/mp4',
                    caption: [
                        header('_✅ VIDEO ENVIADO_'),
                        infoBlock([
                            `🎬 ${title.slice(0, 30)}`,
                            `👤 @${uploader.slice(0, 28)}`,
                            '',
                            '💀 _darling ~ devmatrixs.lat_'
                        ])
                    ].join('\n')
                }, { quoted: fakeContact });

                return send(sock, msg, { react: { text: '✅', key: msg.key } });
            }

            // ── Imagen individual ─────────────────────────────────────────────
            await send(sock, msg, {
                text: [
                    header('_📷 Imagen encontrada — descargando..._'),
                    infoBlock([
                        `📌 ${title.slice(0, 30)}`,
                        `👤 @${uploader.slice(0, 28)}`,
                        '',
                        '📡 _[Procesando imagen...]_'
                    ])
                ].join('\n')
            }, { quoted: fakeContact });

            const buf = await downloadFile(info.f, info.tmp);
            await send(sock, msg, {
                image: buf,
                caption: [
                    header('_✅ IMAGEN ENVIADA_'),
                    infoBlock([
                        `📸 ${title.slice(0, 30)}`,
                        `👤 @${uploader.slice(0, 28)}`,
                        '',
                        '💀 _darling ~ devmatrixs.lat_'
                    ])
                ].join('\n')
            }, { quoted: fakeContact });

            return send(sock, msg, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ [instagram]', err.message);
            await send(sock, msg, { react: { text: '❌', key: msg.key } });
            await send(sock, msg, {
                text: [
                    header('_⚠️ ERROR — Zero Two reporta fallo_'),
                    infoBlock([
                        `🔴 ${err.message.slice(0, 60)}`,
                        '',
                        '💀 _darling ~ devmatrixs.lat_'
                    ])
                ].join('\n')
            }, { quoted: fakeContact });
        }
    }
};
