'use strict';

const fs = require('fs');
const moment = require('moment-timezone');
const settings = require('../../settings');
const { readDatabase } = require('../../utils/funciones');
const { generateWAMessageFromContent, proto } = require('baileys-duplicated');

let version = '1.0.0';
try {
    version = require('../../package.json').version;
} catch (err) {
    console.warn('⚠️ package.json no encontrado, usando versión por defecto');
}

function fixJid(jid) {
    if (!jid) return null;
    if (jid.includes('@')) return jid;
    if (jid.includes('-')) return `${jid}@g.us`;
    return `${jid}@s.whatsapp.net`;
}

module.exports = {
    command: ['menu', 'help', 'ayuda'],
    description: 'Muestra los comandos del bot',
    category: 'general',

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const cmds = [...global.comandos.values()];
            const pushName = msg.pushName || sender.split('@')[0];

            const hora = moment.tz('America/Lima').format('HH:mm:ss');
            const ucapan =
                hora < '05:00:00' ? 'Buenas noches' :
                hora < '11:00:00' ? 'Buen día'      :
                hora < '15:00:00' ? 'Buenas tardes' :
                hora < '19:00:00' ? 'Buenas tardes' :
                'Buenas noches';

            // ── Contacto falso verificado (quoted) ──────────────────────────
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

            // ── Stats del usuario ───────────────────────────────────────────
            const statsData = readDatabase('stats.json');
            const userStats = statsData[sender] || { xp: 0, level: 1, diamantes: 0 };
            const xpActual   = userStats.xp        || 0;
            const nivel       = userStats.level     || 1;
            const diamantes   = userStats.diamantes || 0;
            const xpSiguiente = nivel * 150;

            const usuarios    = readDatabase('usuarios.json');
            const totalUsuarios = Array.isArray(usuarios)
                ? usuarios.length
                : Object.keys(usuarios).length;

            // ── Agrupar comandos por categoría ──────────────────────────────
            const categories = {};
            cmds.forEach((cmd) => {
                if (!cmd.command) return;
                const cat = (cmd.category || 'sin categoría').toLowerCase();
                if (!categories[cat]) categories[cat] = [];
                if (!categories[cat].some((c) => c.command[0] === cmd.command[0])) {
                    categories[cat].push(cmd);
                }
            });

            // ── Texto del menú ──────────────────────────────────────────────
            let menu = `╭──❮ 🌟 *${settings.botName}* 🌟 ❯──╮\n`;
            menu += `│\n`;
            menu += `│  ${ucapan}, *${pushName}*\n`;
            menu += `│\n`;
            menu += `│  👑 Owner      : JAHSEH\n`;
            menu += `│  ⚙️ *Versión*: v${version}\n`;
            menu += `│  🧠 *Motor*: Baileys-MD\n`;
            menu += `│\n`;
            menu += `│  🧍 *Nivel*: ${nivel}\n`;
            menu += `│  ⚡ *EXP*: ${xpActual}/${xpSiguiente}\n`;
            menu += `│  💎 *Diamantes*: ${diamantes}\n`;
            menu += `│\n`;
            menu += `│  👥 *Usuarios Registrados*: ${totalUsuarios}\n`;
            menu += `╰────────────────────────╯\n`;
            menu += `\n    ────────────────────\n`;
            menu += `         🌟 *𝑪𝑶𝑴𝑨𝑵𝑫𝑶𝑺* 🌟\n`;
            menu += `    ────────────────────\n\n`;

            for (const [cat, commands] of Object.entries(categories)) {
                const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
                menu += `╠═══ *${catName}*\n`;
                commands.forEach((cmd) => {
                    menu += `║  ☞ ${settings.prefix}${cmd.command[0]}\n`;
                });
                menu += `║\n`;
            }
            menu += `╚═══════════✡═══════════╝`;

            // ── Thumbnail opcional ──────────────────────────────────────────
            const thumbPath = './media/thumb.jpg';
            const thumbBuffer = fs.existsSync(thumbPath)
                ? fs.readFileSync(thumbPath)
                : undefined;

            // ── Construir interactiveMessage con nativeFlowMessage ──────────
            const jid = fixJid(from);

            const interactive = proto.Message.InteractiveMessage.create({
                body:   { text: menu },
                footer: { text: `☘️ ${settings.botName} v${version}` },
                header: {
                    title:              `🌟 ${settings.botName}`,
                    subtitle:           `${ucapan}, ${pushName}`,
                    hasMediaAttachment: false,
                    ...(thumbBuffer ? { jpegThumbnail: thumbBuffer } : {})
                },
                nativeFlowMessage: {
                    buttons: [
                        // ⛏️ Minar — dispara el comando como quick reply
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '⛏️ Minar',
                                id: `${settings.prefix}minar`
                            })
                        },
                        // 👑 Ver Creador — quick reply
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '👑 Ver Creador',
                                id: `${settings.prefix}creador`
                            })
                        },
                        // 🌐 Web del bot — CTA URL
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🌐 Visitar Web',
                                url: 'https://devmatrixs.lat',
                                merchant_url: 'https://devmatrixs.lat'
                            })
                        }
                    ]
                }
            });

            // ── Generar y enviar el mensaje ─────────────────────────────────
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

            await sock.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });

        } catch (err) {
            console.error('❌ Error en comando menú:', err);
            await sock.sendMessage(from, {
                text: `❌ Error ejecutando el comando menú.\n\n${err.message || err}`
            });
        }
    }
};
