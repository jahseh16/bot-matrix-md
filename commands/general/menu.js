'use strict';

const fs = require('fs');
const moment = require('moment-timezone');
const settings = require('../../settings');
const { readDatabase } = require('../../utils/funciones');

let version = '1.0.0';
try {
    version = require('../../package.json').version;
} catch (err) {
    console.warn('⚠️ package.json no encontrado, usando versión por defecto');
}

/**
 * Resuelve un JID al formato @s.whatsapp.net correcto.
 * Convierte @lid, @g.us (grupos), o cualquier jid raro al formato único
 * que acepta baileys-duplicated para mensajes interactivos.
 */
function resolveJid(jid, msg) {
    if (!jid) return null;

    // Grupos los dejamos como están
    if (jid.endsWith('@g.us')) return jid;

    // Si es un @lid, extraemos el número del mensaje original
    if (jid.includes('@lid')) {
        // Intento 1: usar el participant del key si existe y no es @lid
        const participant = msg?.key?.participant;
        if (participant && !participant.includes('@lid')) return participant;

        // Intento 2: extraer el número del lid (formato: numero@lid)
        const numero = jid.split('@')[0];
        if (numero && /^\d+$/.test(numero)) {
            return `${numero}@s.whatsapp.net`;
        }

        console.warn('⚠️ [menu] No se pudo resolver @lid:', jid);
        return null;
    }

    // Si ya está correcto
    if (jid.endsWith('@s.whatsapp.net')) return jid;

    // Fallback: agregar @s.whatsapp.net si es solo un número
    const numero = jid.split('@')[0];
    if (numero && /^\d+$/.test(numero)) {
        return `${numero}@s.whatsapp.net`;
    }

    return jid;
}

module.exports = {
    command: ['menu', 'help', 'ayuda'],
    description: 'Muestra los comandos del bot',
    category: 'general',

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const { generateWAMessageFromContent, proto } = require('baileys-duplicated');
            console.log('📌 [menu] handle ejecutado por:', sender);
            console.log('📌 [menu] from original:', from);

            // ── Resolver JID correcto ───────────────────────────────────────
            const jid = resolveJid(from, msg);
            console.log('📌 [menu] JID resuelto:', jid);

            if (!jid) {
                console.error('❌ [menu] No se pudo resolver el JID destino.');
                return;
            }

            const cmds = [...global.comandos.values()];
            const pushName = msg.pushName || sender.split('@')[0];

            const hora = moment.tz('America/Lima').format('HH:mm:ss');
            const ucapan =
                hora < '05:00:00' ? 'Buenas noches' :
                hora < '11:00:00' ? 'Buen día'      :
                hora < '15:00:00' ? 'Buenas tardes' :
                hora < '19:00:00' ? 'Buenas tardes' :
                'Buenas noches';

            // ── Stats del usuario ───────────────────────────────────────────
            const statsData = readDatabase('stats.json');
            const userStats = statsData[sender] || { xp: 0, level: 1, diamantes: 0 };
            const xpActual   = userStats.xp        || 0;
            const nivel       = userStats.level     || 1;
            const diamantes   = userStats.diamantes || 0;
            const xpSiguiente = nivel * 150;

            const usuarios = readDatabase('usuarios.json');
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

            // ── Construir interactiveMessage ────────────────────────────────
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
                                display_text: '🌐 Visitar Web',
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
                { userJid: sock.user.id }
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
