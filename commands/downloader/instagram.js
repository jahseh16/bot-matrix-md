'use strict';
const axios  = require('axios');
const path   = require('path');
const fs     = require('fs');

const API          = 'http://161.97.184.119:4000';
const ZERO_TWO_PFP = 'https://i.pinimg.com/736x/e0/a8/90/e0a890b788b4bcc06fc2dc8c2e5c2b46.jpg';

// ── Estilo Zero Two ──────────────────────────────────────────────────────────
const fakeContact = {
    key: { fromMe: false, participant: '0@s.whatsapp.net' },
    message: {
        contactMessage: {
            displayName: '🌸 Zero Two | DARLING',
            vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:;Zero Two;;;\nFN:Zero Two\nORG:DARLING in the FranXX\nTITLE:Piloto Clase S\nitem1.TEL;waid=0:+0\nitem1.X-ABLabel:WhatsApp\nEND:VCARD'
        }
    }
};

function box(lines) {
    return [
        '```',
        '╔══════════════════════════════╗',
        ...lines.map(l => `║  ${l.padEnd(28)}║`),
        '╚══════════════════════════════╝',
        '```'
    ].join('\n');
}

async function send(sock, msg, content, options = {}) {
    try {
        const jid = msg.key?.remoteJid || msg.chat || null;
        if (!jid) return;
        await sock.sendMessage(jid, content, options);
    } catch (err) { console.error('❌ [ig] send:', err.message); }
}

// ── Sesión pendiente: guarda la URL mientras el usuario elige formato ─────────
// Clave: sender JID  →  { url, type, title, uploader, thumb }
const pendingSessions = new Map();

// ── Módulo principal ─────────────────────────────────────────────────────────
module.exports = {
    command: ['ig', 'instagram', 'insta', 'igmp3', 'ighd'],
    description: 'Descarga video/imagen/carrusel de Instagram — Zero Two Edition',
    category: 'downloader',

    handle: async (sock, from, msg, command, args, sender) => {
        try {

            // ── CALLBACK: usuario tocó botón ─────────────────────────────────
            if (command === 'igmp3' || command === 'ighd') {
                const session = pendingSessions.get(sender);
                if (!session) {
                    return send(sock, msg, {
                        text: box([
                            '🌸 Zero Two aquí~',
                            '❌ No tengo ningún enlace',
                            '   pendiente tuyo, Darling.',
                            '   Envía .ig <url> primero.'
                        ])
                    }, { quoted: fakeContact });
                }

                pendingSessions.delete(sender);
                const { url, title, uploader, thumb } = session;

                await send(sock, msg, { react: { text: '🌸', key: msg.key } });

                // ── Audio (igmp3) ─────────────────────────────────────────────
                if (command === 'igmp3') {
                    await send(sock, msg, {
                        text: box([
                            '🌸 Zero Two — IG AUDIO',
                            '──────────────────────────',
                            '[📡] Extrayendo audio...',
                            '[⏳] Procesando MP3...'
                        ])
                    }, { quoted: fakeContact });

                    const { data } = await axios.get(`${API}/instagram`, {
                        params: { url },
                        timeout: 120000
                    });
                    if (!data.success) throw new Error(data.error || 'Error de API');

                    const fileTarget = data.type === 'carousel' ? data.files[0] : data;
                    const fileResp   = await axios.get(`${API}${fileTarget.file}`, {
                        responseType: 'arraybuffer',
                        timeout: 120000
                    });

                    await send(sock, msg, {
                        audio: Buffer.from(fileResp.data),
                        mimetype: 'audio/mpeg',
                        ptt: false,
                        fileName: `${title || 'ig_audio'}.mp3`
                    }, { quoted: fakeContact });

                    return send(sock, msg, {
                        text: box([
                            '🌸 Zero Two — IG MP3',
                            '──────────────────────────',
                            '✅ AUDIO ENVIADO',
                            '',
                            `🎵 ${(title || 'Instagram').slice(0, 24)}`,
                            `👤 ${(uploader || '').slice(0, 24)}`,
                            '',
                            '💀 darling ~ devmatrixs.lat'
                        ])
                    }, { quoted: fakeContact });
                }

                // ── Video HD (ighd) ───────────────────────────────────────────
                await send(sock, msg, {
                    text: box([
                        '🌸 Zero Two — IG VIDEO HD',
                        '──────────────────────────',
                        '[📡] Descargando video...',
                        '[⏳] Procesando HD...'
                    ])
                }, { quoted: fakeContact });

                const { data: igData } = await axios.get(`${API}/instagram`, {
                    params: { url },
                    timeout: 120000
                });
                if (!igData.success) throw new Error(igData.error || 'Error de API');

                // Carrusel
                if (igData.type === 'carousel') {
                    await send(sock, msg, {
                        text: box([
                            `📸 Carrusel: ${igData.count} archivos`,
                            '   Enviando uno a uno...'
                        ])
                    }, { quoted: fakeContact });

                    for (const item of igData.files) {
                        const r = await axios.get(`${API}${item.file}`, { responseType: 'arraybuffer', timeout: 120000 });
                        const buf = Buffer.from(r.data);
                        if (item.type === 'video') {
                            await send(sock, msg, { video: buf, mimetype: 'video/mp4' }, { quoted: fakeContact });
                        } else {
                            await send(sock, msg, { image: buf }, { quoted: fakeContact });
                        }
                    }
                    return send(sock, msg, { react: { text: '✅', key: msg.key } });
                }

                // Video o imagen individual
                const fileResp = await axios.get(`${API}${igData.file}`, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                const buf = Buffer.from(fileResp.data);

                if (igData.type === 'video') {
                    await send(sock, msg, {
                        video: buf,
                        mimetype: 'video/mp4',
                        caption: box([
                            '🌸 Zero Two — IG HD',
                            '──────────────────────────',
                            '✅ VIDEO ENVIADO',
                            '',
                            `🎬 ${(title || 'Instagram').slice(0, 24)}`,
                            `👤 ${(uploader || '').slice(0, 24)}`,
                            '',
                            '💀 darling ~ devmatrixs.lat'
                        ])
                    }, { quoted: fakeContact });
                } else {
                    await send(sock, msg, {
                        image: buf,
                        caption: box([
                            '🌸 Zero Two — IG IMAGEN',
                            '──────────────────────────',
                            '✅ IMAGEN ENVIADA',
                            `📸 ${(title || 'Instagram').slice(0, 24)}`,
                            `👤 ${(uploader || '').slice(0, 24)}`,
                        ])
                    }, { quoted: fakeContact });
                }

                return send(sock, msg, { react: { text: '✅', key: msg.key } });
            }

            // ── COMANDO PRINCIPAL: .ig <url> ─────────────────────────────────
            const url = args.join(' ').trim();
            if (!url || !url.includes('instagram.com')) {
                return send(sock, msg, {
                    text: box([
                        '🌸 Zero Two — INSTAGRAM',
                        '──────────────────────────',
                        '[!] Uso correcto:',
                        `   .ig <url de instagram>`,
                        '',
                        '[~] Ejemplo:',
                        '   .ig https://instagram.com/p/...',
                        '',
                        '💀 darling ~ devmatrixs.lat'
                    ])
                }, { quoted: fakeContact });
            }

            await send(sock, msg, { react: { text: '🌸', key: msg.key } });
            await send(sock, msg, {
                text: box([
                    '🌸 Zero Two — IG SCANNER',
                    '──────────────────────────',
                    '[📡] Conectando a Instagram...',
                    '[🔍] Analizando post...'
                ])
            }, { quoted: fakeContact });

            // Obtiene solo los metadatos primero (skipDownload implícito vía dumpSingleJson)
            const { data: info } = await axios.get(`${API}/instagram`, {
                params: { url },
                timeout: 60000
            });

            if (!info.success) throw new Error(info.error || 'No se pudo analizar el enlace');

            const title    = info.title    || 'Instagram';
            const uploader = info.uploader || '';
            const thumb    = info.thumb    || ZERO_TWO_PFP;
            const mediaType = info.type === 'carousel'
                ? `📸 Carrusel (${info.count} archivos)`
                : info.type === 'video' ? '🎬 Video' : '📷 Imagen';

            // Guarda sesión pendiente
            const prefix = require('../../settings').prefix || '.';
            pendingSessions.set(sender, { url, title, uploader, thumb });
            // Expira en 5 minutos
            setTimeout(() => pendingSessions.delete(sender), 5 * 60 * 1000);

            // Muestra info + botones para elegir formato
            await send(sock, msg, {
                image: { url: thumb },
                caption: box([
                    '🌸 Zero Two — IG INFO',
                    '──────────────────────────',
                    `📌 ${title.slice(0, 24)}`,
                    `👤 ${uploader.slice(0, 24)}`,
                    `📦 Tipo  : ${mediaType.slice(0, 22)}`,
                    '',
                    '[ elige tu formato, Darling ]',
                    '',
                    '💀 darling ~ devmatrixs.lat'
                ]),
                footer: '🌸 devmatrixs.lat — El control.',
                templateButtons: [
                    {
                        index: 1,
                        quickReplyButton: {
                            displayText: '🎵 MP3 / Audio',
                            id: `${prefix}igmp3`
                        }
                    },
                    {
                        index: 2,
                        quickReplyButton: {
                            displayText: '📹 Video HD',
                            id: `${prefix}ighd`
                        }
                    }
                ]
            }, { quoted: fakeContact });

        } catch (err) {
            console.error('❌ [instagram]', err.message);
            await send(sock, msg, { react: { text: '❌', key: msg.key } });
            await send(sock, msg, {
                text: box([
                    '⚠️  FALLO — Zero Two',
                    '──────────────────────────',
                    err.message.slice(0, 55),
                ])
            }, { quoted: fakeContact });
        }
    }
};
