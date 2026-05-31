const fs = require("fs");
const moment = require("moment-timezone");
const settings = require("../../settings");
const { readDatabase } = require("../../utils/funciones");

let version = "1.0.0";
try {
    version = require("../../package.json").version;
} catch (err) {
    console.warn("⚠️ package.json no encontrado, usando versión por defecto");
}

function fixJid(jid) {
    if (!jid) return null;
    if (jid.includes("@")) return jid;
    if (jid.includes("-")) return `${jid}@g.us`;
    return `${jid}@s.whatsapp.net`;
}

function getChatId(m) {
    return (
        m.chat ||
        m.key?.remoteJid ||
        m.key?.participant ||
        m.message?.key?.remoteJid ||
        m.sender ||
        null
    );
}

async function enviarMensajeSeguro(sock, from, content, options = {}) {
    try {
        let jid = fixJid(from);
        if (!jid) throw new Error("jid inválido");
        await sock.sendMessage(jid, content, options);
    } catch (err) {
        console.error("❌ Error al enviar mensaje:", err.message);
    }
}

module.exports = {
    command: ["menu", "help", "ayuda"],
    description: "Muestra los comandos del bot",
    category: "general",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const cmds = [...global.comandos.values()];
            const pushName = msg.pushName || sender.split("@")[0];

            const hora = moment.tz("America/Lima").format("HH:mm:ss");
            const ucapan =
                hora < "05:00:00" ? "Buenas noches" :
                hora < "11:00:00" ? "Buen día"      :
                hora < "15:00:00" ? "Buenas tardes" :
                hora < "19:00:00" ? "Buenas tardes" :
                "Buenas noches";

            const fkontak = {
                key: { fromMe: false, participant: "0@s.whatsapp.net" },
                message: {
                    contactMessage: {
                        displayName: pushName,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${pushName};;;\nFN:${pushName}\nitem1.TEL;waid=${sender.split("@")[0]}:${sender.split("@")[0]}\nitem1.X-ABLabel:Teléfono\nEND:VCARD`,
                    },
                },
            };

            // Leer stats del usuario
            const statsData = readDatabase("stats.json");
            const userStats = statsData[sender] || { xp: 0, level: 1, diamantes: 0 };
            const xpActual = userStats.xp || 0;
            const nivel = userStats.level || 1;
            const diamantes = userStats.diamantes || 0;
            const xpSiguiente = nivel * 150;

            // Leer usuarios registrados
            const usuarios = readDatabase("usuarios.json");
            const totalUsuarios = Array.isArray(usuarios) ? usuarios.length : Object.keys(usuarios).length;

            // Agrupar comandos por categoría
            const categories = {};
            cmds.forEach((cmd) => {
                if (!cmd.command) return;
                const cat = (cmd.category || "sin categoría").toLowerCase();
                if (!categories[cat]) categories[cat] = [];
                if (!categories[cat].some((c) => c.command[0] === cmd.command[0])) {
                    categories[cat].push(cmd);
                }
            });

            // ✅ Cabecera cerrada con stats del usuario
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

            // ✅ Separador antes de comandos
            menu += `\n    ────────────────────\n`;
            menu += `         🌟 *𝑪𝑶𝑴𝑨𝑵𝑫𝑶𝑺* 🌟\n`;
            menu += `    ────────────────────\n\n`;

            // ✅ Lista de comandos por categoría
            for (const [cat, commands] of Object.entries(categories)) {
                const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
                menu += `╠═══ *${catName}*\n`;
                commands.forEach((cmd) => {
                    menu += `║  ☞ ${settings.prefix}${cmd.command[0]}\n`;
                });
                menu += `║\n`;
            }

            menu += `╚═══════════✡═══════════╝`;

            const videoPath = "./media/menu.mp4";
            const thumbPath = "./media/thumb.jpg";

            const content = {
                caption: menu,
                gifPlayback: true,
                footer: `☘️ ${settings.botName}`,
                buttons: [
                    { buttonId: `${settings.prefix}ping`,  buttonText: { displayText: "🏓 PING"  }, type: 1 },
                    { buttonId: `${settings.prefix}stats`, buttonText: { displayText: "📊 STATS" }, type: 1 },
                ],
                headerType: fs.existsSync(videoPath) ? 4 : 1,
                contextInfo: {
                    externalAdReply: {
                        title: `🪪 ${settings.botName}`,
                        body: settings.groupName || "WhatsApp Bot",
                        mediaType: 1,
                        renderLargerThumbnail: true,
                    },
                },
            };

            if (fs.existsSync(videoPath)) content.video = fs.readFileSync(videoPath);
            if (fs.existsSync(thumbPath)) content.contextInfo.externalAdReply.thumbnail = fs.readFileSync(thumbPath);

            await enviarMensajeSeguro(sock, from, content, { quoted: fkontak });

        } catch (err) {
            console.error("❌ Error en comando menú:", err);
            await sock.sendMessage(from, {
                text: `❌ Error ejecutando el comando menú.\n\n${err.message || err}`,
            });
        }
    },
};