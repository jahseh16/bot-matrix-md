'use strict';

const moment = require('moment-timezone');
const settings = require('../../settings');
const { readDatabase } = require('../../utils/funciones');

let version = '1.0.0';
try {
    version = require('../../package.json').version;
} catch (err) {
    console.warn('⚠️ package.json no encontrado, usando versión por defecto');
}

function resolveJid(jid, msg) {
    if (!jid) return null;
    if (jid.endsWith('@g.us')) return jid;
    if (jid.includes('@lid')) {
        const participant = msg?.key?.participant;
        if (participant && !participant.includes('@lid')) return participant;
        const numero = jid.split('@')[0];
        if (numero && /^\d+$/.test(numero)) return `${numero}@s.whatsapp.net`;
        console.warn('⚠️ [menu] No se pudo resolver @lid:', jid);
        return null;
    }
    if (jid.endsWith('@s.whatsapp.net')) return jid;
    const numero = jid.split('@')[0];
    if (numero && /^\d+$/.test(numero)) return `${numero}@s.whatsapp.net`;
    return jid;
}

// Emoji por categoria para el menu dinamico
const catEmoji = {
    'ia':          '🧠',
    'system':      '⚡',
    'buscador':    '🔍',
    'downloader':  '📥',
    'general':     '⚙️',
    'juegos':      '🎮',
    'economia':    '💰',
    'moderacion':  '🛡️',
    'grupo':       '👥',
    'multimedia':  '🎥',
};

module.exports = {
    command: ['menu', 'help', 'ayuda'],
    description: 'Muestra los comandos del bot',
    category: 'general',

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
            console.log('📌 [menu] ejecutado por:', sender);

            const jid = resolveJid(from, msg);
            console.log('📌 [menu] JID resuelto:', jid);
            if (!jid) {
                console.error('❌ [menu] No se pudo resolver el JID destino.');
                return;
            }

            const pushName = msg.pushName || sender.split('@')[0];

            const hora = moment.tz('America/Lima').format('HH:mm:ss');
            const ucapan =
                hora < '05:00:00' ? 'Buenas noches' :
                hora < '11:00:00' ? 'Buen día'      :
                hora < '15:00:00' ? 'Buenas tardes' :
                hora < '19:00:00' ? 'Buenas tardes' :
                                    'Buenas noches';

            // Stats del usuario
            const statsData = readDatabase('stats.json');
            const userStats = statsData[sender] || { xp: 0, level: 1, diamantes: 0 };
            const xpActual   = userStats.xp        || 0;
            const nivel       = userStats.level     || 1;
            const diamantes   = userStats.diamantes || 0;
            const xpSiguiente = nivel * 150;

            // ── Agrupar comandos dinámicamente desde global.comandos ──────────
            const cmds = [...global.comandos.values()];
            const categories = {};
            cmds.forEach((cmd) => {
                if (!cmd.command) return;
                const cat = (cmd.category || 'general').toLowerCase();
                if (!categories[cat]) categories[cat] = [];
                // evitar duplicados
                if (!categories[cat].some((c) => c.command[0] === cmd.command[0])) {
                    categories[cat].push(cmd);
                }
            });

            // ── Cabecera fija ────────────────────────────────────────────────
            let menu = `╔════════════════════════╗\n`;
            menu += `  🤖 𝗔𝗔𝗧𝗥𝗜𝗫 𝗕𝗢𝗧 — v${version}\n`;
            menu += `╚════════════════════════╝\n`;
            menu += `\n📌 ¡${ucapan}, ${pushName}! \n`;

            // ── Bloque de estadísticas con backticks ────────────────────────
            menu += `\n┌── 📊 𝗘𝗦𝗧𝗔𝗗𝗜́𝗦𝗧𝗜𝗖𝗔𝗦 ──┐\n`;
            menu += `│ \`\`\`Creador: JAHSEH\`\`\`\n`;
            menu += `│ \`\`\`Motor  : wileys\`\`\`\n`;
            menu += `│ \`\`\`Web    : devmatrixs.lat\`\`\`\n`;
            menu += `│\n`;
            menu += `│ \`\`\`Nivel    : ${nivel}\`\`\`\n`;
            menu += `│ \`\`\`EXP      : ${xpActual} / ${xpSiguiente}\`\`\`\n`;
            menu += `│ \`\`\`Diamantes: ${diamantes}\`\`\`\n`;
            menu += `└───────────────────────┘\n`;

            // ── Sección de comandos dinámicos ────────────────────────────────
            menu += `\n┌── 📁 𝗔𝗘𝗡𝗞́ 𝗖𝗢𝗔𝗔𝗕𝗢𝗦 ──┐\n`;

            for (const [cat, cmdsArr] of Object.entries(categories)) {
                const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
                const emoji = catEmoji[cat] || '📂';
                menu += `│\n`;
                menu += `> ${emoji} *[ ${catName.toUpperCase()} ]*\n`;
                cmdsArr.forEach((cmd) => {
                    // mostrar solo el primer alias del comando
                    const nombre = cmd.command[0];
                    // si el comando tiene descripción corta la incluimos
                    const desc = cmd.description ? `: ${cmd.description}` : '';
                    menu += `> _${nombre}_${desc}\n`;
                });
            }

            menu += `│\n`;
            menu += `└───────────────────────┘\n`;
            menu += `🌐 devmatrixs.lat — El control.`;

            // ── Tarjeta de contacto verificado ───────────────────────────────
            const fkontak = {
                key: { fromMe: false, participant: '0@s.whatsapp.net' },
                message: {
                    contactMessage: {
                        displayName: `✅ ${settings.botName}`,
                        vcard: [
                            'BEGIN:VCARD',
                            'VERSION:3.0',
                            `N:;${settings.botName};;;`,
                            `FN:${settings.botName}`,
                            `item1.TEL;waid=${settings.ownerNumbers[0]}:+${settings.ownerNumbers[0]}`,
                            'item1.X-ABLabel:Teléfono',
                            'END:VCARD'
                        ].join('\n')
                    }
                }
            };

            // ── Construir interactiveMessage ─────────────────────────────────
            const interactive = proto.Message.InteractiveMessage.create({
                body:   { text: menu },
                footer: { text: `🌐 devmatrixs.lat — El control.` },
                header: {
                    title:              `🤖 ${settings.botName}`,
                    subtitle:           `${ucapan}, ${pushName}`,
                    hasMediaAttachment: true,
                    imageMessage: proto.Message.ImageMessage.create({
                        url:           'https://i.ibb.co/gLVNPHj8/922335a4-dc29-4e06-bd92-5d34bc9548de.jpg',
                        mimetype:      'image/jpeg',
                        caption:       '',
                        jpegThumbnail: Buffer.alloc(0)
                    })
                },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '⛏️ Minar',
                                id: `${settings.prefix}minar`
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '👑 Ver Creador',
                                id: `${settings.prefix}creador`
                            })
                        },
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🌐 Sitio Web',
                                url: 'https://devmatrixs.lat',
                                merchant_url: 'https://devmatrixs.lat'
                            })
                        }
                    ]
                }
            });

            console.log('📌 [menu] Generando waMsg...');

            const waMsg = await generateWAMessageFromContent(
                jid,
                {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata:        {},
                                deviceListMetadataVersion: 2
                            },
                            interactiveMessage: interactive
                        }
                    }
                },
                { userJid: sock.user.id, quoted: fkontak }
            );

            console.log('📌 [menu] Enviando relayMessage...');
            await sock.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
            console.log('✅ [menu] Menú enviado correctamente a:', jid);

        } catch (err) {
            console.error('❌ ERROR EN MENÚ:', err);
            try {
                await sock.sendMessage(from, {
                    text: `❌ Error en menú:\n\n${err.message || err}`
                });
            } catch (e) {
                console.error('❌ Tampoco pudo enviar el error:', e.message);
            }
        }
    }
};
