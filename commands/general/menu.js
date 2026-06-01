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
            console.log('📌 [menu] ejecutado por:', sender);

            const jid = resolveJid(from, msg);
            console.log('📌 [menu] JID resuelto:', jid);
            if (!jid) {
                console.error('❌ [menu] No se pudo resolver el JID destino.');
                return;
            }

            const usedPrefix = settings.prefix || '.';
            const pushName   = msg.pushName || sender.split('@')[0];

            const hora = moment.tz('America/Lima').format('HH:mm:ss');
            const ucapan =
                hora < '05:00:00' ? 'Buenas noches' :
                hora < '11:00:00' ? 'Buen día'      :
                hora < '15:00:00' ? 'Buenas tardes' :
                hora < '19:00:00' ? 'Buenas tardes' :
                                    'Buenas noches';

            const statsData  = readDatabase('stats.json');
            const userStats  = statsData[sender] || { xp: 0, level: 1, diamantes: 0 };
            const xpActual   = userStats.xp        || 0;
            const nivel       = userStats.level     || 1;
            const diamantes   = userStats.diamantes || 0;
            const xpSiguiente = nivel * 150;

            // ── Comandos dinámicos ──────────────────────────────────────────
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

            // ── Texto del menú ─────────────────────────────────────────────
            let menu = `╔════════════════════════╗\n`;
            menu += `  🤖 𝗠𝗔𝗧𝗥𝗜𝗫 𝗕𝗢𝗧 — v${version}\n`;
            menu += `╚════════════════════════╝\n`;
            menu += `\n📌 ¡${ucapan}, ${pushName}! \n`;

            menu += `\n┌── 📊 𝗘𝗦𝗧𝗔𝗗𝗜́𝗦𝗧𝗜𝗖𝗔𝗦 ──┐\n`;
            menu += `│ \`\`\`Creador: JAHSEH\`\`\`\n`;
            menu += `│ \`\`\`Motor  : wileys\`\`\`\n`;
            menu += `│ \`\`\`Web    : devmatrixs.lat\`\`\`\n`;
            menu += `│\n`;
            menu += `│ \`\`\`Nivel    : ${nivel}\`\`\`\n`;
            menu += `│ \`\`\`EXP      : ${xpActual} / ${xpSiguiente}\`\`\`\n`;
            menu += `│ \`\`\`Diamantes: ${diamantes}\`\`\`\n`;
            menu += `└───────────────────────┘\n`;

            menu += `\n┌── 📁 𝗠𝗘𝗡𝗨́ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 ──┐\n`;
            for (const [cat, cmdsArr] of Object.entries(categories)) {
                const catName = cat.toUpperCase();
                const emoji   = catEmoji[cat] || '📂';
                menu += `│\n`;
                menu += `> ${emoji} *[ ${usedPrefix}${catName} ]*\n`;
                cmdsArr.forEach((cmd) => {
                    menu += `> _${usedPrefix}${cmd.command[0]}_\n`;
                });
            }
            menu += `│\n`;
            menu += `└───────────────────────┘\n`;
            menu += `🌐 devmatrixs.lat — El control.`;

            // ── Envío con botones mixtos ───────────────────────────────────
            // type:1 = quick_reply (flechita ↩️)
            // type:5 = urlButton   (cuadrito ↗️, abre Chrome directamente)
            await sock.sendMessage(jid, {
                image:    { url: 'https://i.ibb.co/gLVNPHj8/922335a4-dc29-4e06-bd92-5d34bc9548de.jpg' },
                caption:  menu,
                footer:   `🌐 devmatrixs.lat — El control.`,
                mimetype: 'image/jpeg',
                buttons: [
                    {
                        buttonId:   `${usedPrefix}minar`,
                        buttonText: { displayText: '⛏️ Minar' },
                        type: 1
                    },
                    {
                        buttonId:   `${usedPrefix}creador`,
                        buttonText: { displayText: '👑 Ver Creador' },
                        type: 1
                    },
                    {
                        buttonId:   'url_devmatrix',
                        buttonText: { displayText: '🌐 Sitio Web' },
                        type: 5,
                        url: 'https://devmatrixs.lat'
                    }
                ],
                headerType: 4
            });

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
