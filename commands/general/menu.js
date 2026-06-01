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

// Emoji por categoria
const catEmoji = {
    'ia':         '🧠',
    'system':     '⚡',
    'buscador':   '🔍',
    'downloader': '📥',
    'general':    '⚙️',
    'juegos':     '🎮',
    'economia':   '💰',
    'moderacion': '🛡️',
    'grupo':      '👥',
    'multimedia': '🎥',
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

            // ── Agrupar comandos dinámicamente desde global.comandos ──────
            const cmds = [...global.comandos.values()];
            const categories = {};
            cmds.forEach((cmd) => {
                if (!cmd.command) return;
                const cat = (cmd.category || 'general').toLowerCase();
                if (!categories[cat]) categories[cat] = [];
                if (!categories[cat].some((c) => c.command[0] === cmd.command[0])) {
                    categories[cat].push(cmd);
                }
            });

            // ── Construir texto del menú ────────────────────────────
            let menu = `╔════════════════════════╗\n`;
            menu += `  🤖 𝗔𝗔𝗧𝗥𝗜𝗫 𝗕𝗢𝗧 — v${version}\n`;
            menu += `╚════════════════════════╝\n`;
            menu += `\n📌 ¡${ucapan}, ${pushName}! \n`;

            // Bloque de estadísticas (backticks renderizados por WhatsApp como monospace)
            menu += `\n┌── 📊 𝗘𝗦𝗧𝗔𝗗𝗜́𝗦𝗧𝗜𝗖𝗔𝗦 ──┐\n`;
            menu += `│ \`\`\`Creador: JAHSEH\`\`\`\n`;
            menu += `│ \`\`\`Motor  : wileys\`\`\`\n`;
            menu += `│ \`\`\`Web    : devmatrixs.lat\`\`\`\n`;
            menu += `│\n`;
            menu += `│ \`\`\`Nivel    : ${nivel}\`\`\`\n`;
            menu += `│ \`\`\`EXP      : ${xpActual} / ${xpSiguiente}\`\`\`\n`;
            menu += `│ \`\`\`Diamantes: ${diamantes}\`\`\`\n`;
            menu += `└───────────────────────┘\n`;

            // Bloque de comandos dinámicos
            menu += `\n┌── 📁 𝗔𝗘𝗡𝗞́ 𝗖𝗢𝗔𝗔𝗕𝗢𝗦 ──┐\n`;
            for (const [cat, cmdsArr] of Object.entries(categories)) {
                const catName = cat.toUpperCase();
                const emoji   = catEmoji[cat] || '📂';
                menu += `│\n`;
                menu += `> ${emoji} *[ ${catName} ]*\n`;
                cmdsArr.forEach((cmd) => {
                    menu += `> _${cmd.command[0]}_\n`;
                });
            }
            menu += `│\n`;
            menu += `└───────────────────────┘\n`;
            menu += `🌐 devmatrixs.lat — El control.`;

            // ── MENSAJE 1: Imagen de cabecera + menú como caption ────────────
            // Usa imageMessage nativo — compatible con TODAS las versiones de WhatsApp
            await sock.sendMessage(jid, {
                image:    { url: 'https://i.ibb.co/gLVNPHj8/922335a4-dc29-4e06-bd92-5d34bc9548de.jpg' },
                caption:  menu,
                mimetype: 'image/jpeg'
            });

            // ── MENSAJE 2: ListMessage como menú de acciones rápidas ──────────
            // ListMessage sí funciona en cuentas personales (no requiere Business API)
            const listMsg = proto.Message.ListMessage.create({
                title:       '🤖 Acciones rápidas',
                description: '¿Qué quieres hacer?',
                footerText:  '🌐 devmatrixs.lat',
                buttonText:  '📥 Ver opciones',
                listType:    1,
                sections: [
                    {
                        title: 'Acciones',
                        rows: [
                            {
                                rowId:       'minar',
                                title:       '⛏️ Minar',
                                description: 'Obtener recursos del bot'
                            },
                            {
                                rowId:       'creador',
                                title:       '👑 Ver Creador',
                                description: 'Info del desarrollador'
                            }
                        ]
                    },
                    {
                        title: 'Sitio web',
                        rows: [
                            {
                                rowId:       'web_devmatrix',
                                title:       '🌐 devmatrixs.lat',
                                description: 'Visita el sitio oficial'
                            }
                        ]
                    }
                ]
            });

            const listWaMsg = await generateWAMessageFromContent(
                jid,
                { listMessage: listMsg },
                {}
            );
            await sock.relayMessage(jid, listWaMsg.message, { messageId: listWaMsg.key.id });

            console.log('✅ [menu] Menú enviado (imagen + lista) a:', jid);

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
