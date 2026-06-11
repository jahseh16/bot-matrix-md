const { connectToWhatsApp } = require('./main');
const settings = require('./settings');
const { isLink } = require('./utils/antilink');
const { checkFlood } = require('./utils/antiflood');
const { checkSpam } = require('./utils/antispam');
const { readDatabase, writeDatabase } = require('./utils/funciones');
const fs = require('fs');
const path = require('path');

let mutedUsers = {};
let dynamicsStarted = {};

// ✅ Carga automática de todos los archivos en commands/
global.comandos = new Map();

function cargarComandos(dir) {
    const archivos = fs.readdirSync(dir, { withFileTypes: true });
    for (const archivo of archivos) {
        const rutaCompleta = path.join(dir, archivo.name);
        if (archivo.isDirectory()) {
            cargarComandos(rutaCompleta);
        } else if (archivo.name.endsWith('.js')) {
            try {
                const mod = require(rutaCompleta);
                if (mod.command && Array.isArray(mod.command)) {
                    mod.command.forEach(cmd => {
                        global.comandos.set(cmd.toLowerCase(), mod);
                    });
                    console.log(`✅ Cargado: ${mod.command.join(', ')} (${mod.category || 'sin categoría'})`);
                }
            } catch (err) {
                console.error(`❌ Error cargando ${rutaCompleta}:`, err.message);
            }
        }
    }
}

cargarComandos(path.join(__dirname, 'commands'));

// Iniciar el bot
const start = async () => {
    const sock = await connectToWhatsApp();
    console.log(`🤖 ${settings.botName} está en línea.`);
};

// ─── Helper: extrae el buttonId de cualquier tipo de respuesta a botón ────────
function extractButtonId(msg) {
    const m = msg.message;
    if (!m) return null;

    // templateButtonReplyMessage  (templateButtons con quickReplyButton)
    if (m.templateButtonReplyMessage) {
        return m.templateButtonReplyMessage.selectedId ||
               m.templateButtonReplyMessage.selectedDisplayText ||
               null;
    }

    // buttonsResponseMessage  (buttons clásicos)
    if (m.buttonsResponseMessage) {
        return m.buttonsResponseMessage.selectedButtonId ||
               m.buttonsResponseMessage.selectedDisplayText ||
               null;
    }

    // interactiveResponseMessage + nativeFlowResponseMessage
    if (m.interactiveResponseMessage) {
        const raw = m.interactiveResponseMessage
                      ?.nativeFlowResponseMessage?.paramsJson;
        if (raw) {
            try {
                const p = JSON.parse(raw);
                return p.id || p.selectedId || null;
            } catch { /* nada */ }
        }
        return m.interactiveResponseMessage.selectedId || null;
    }

    // listResponseMessage
    if (m.listResponseMessage) {
        return m.listResponseMessage?.singleSelectReply?.selectedRowId ||
               m.listResponseMessage?.singleSelectReply?.id ||
               null;
    }

    return null;
}

// Manejador de mensajes
const handleMessage = async (sock, msg, from, isGroup, sender) => {
    try {
        const body = (
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            ""
        );

        // ── Handler de respuestas a botones ──────────────────────────────────
        const btnId = extractButtonId(msg);
        if (btnId) {
            const prefix  = settings.prefix || '.';
            // El id del botón trae el prefijo (.igmp3, .ighd, etc.)
            // Lo normalizamos igual que un comando de texto
            const cleanId = btnId.startsWith(prefix)
                ? btnId.slice(prefix.length).trim().toLowerCase()
                : btnId.trim().toLowerCase();

            const btnArgs = cleanId.split(/ +/);
            const btnCmd  = btnArgs.shift();
            const cmdMod  = global.comandos.get(btnCmd);

            if (cmdMod?.handle) {
                await cmdMod.handle(sock, from, msg, btnCmd, btnArgs, sender);
                return;
            }
            // Si no hay módulo registrado para ese id, cae al flujo normal
        }
        // ─────────────────────────────────────────────────────────────────────

        const args    = body.trim().split(/ +/).slice(1);
        const command = body.startsWith(settings.prefix)
            ? body.slice(settings.prefix.length).trim().split(/ +/)[0].toLowerCase()
            : null;

        // Moderación: Anti-Link
        if (isGroup && settings.features.antiLink && isLink(body) && !msg.key.fromMe) {
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(sender)) {
                await sock.sendMessage(from, { delete: msg.key });
                await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]}, los enlaces no están permitidos en este grupo.`, mentions: [sender] });
                return;
            }
        }

        // Comprobar si el usuario está silenciado
        if (isGroup && mutedUsers[sender] && mutedUsers[sender] > Date.now()) {
            await sock.sendMessage(from, { delete: msg.key });
            return;
        }

        // Moderación: Anti-Bots
        if (isGroup && settings.features.antiBots && msg.key.id.startsWith('BAE5') && !msg.key.fromMe) {
            await sock.sendMessage(from, { text: `🚫 Bot externo detectado. Eliminando mensaje.` });
            await sock.sendMessage(from, { delete: msg.key });
            return;
        }

        // Moderación: Anti-Spam
        if (isGroup && settings.features.antiSpam && checkSpam(sender, body)) {
            await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, deja de repetir el mismo mensaje.`, mentions: [sender] });
            await sock.sendMessage(from, { delete: msg.key });
            return;
        }

        // Moderación: Anti-Flood
        if (isGroup && settings.features.antiFlood && checkFlood(sender)) {
            mutedUsers[sender] = Date.now() + settings.muteTime;
            await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} ha sido silenciado por 10 minutos debido a hacer flood.`, mentions: [sender] });
            await sock.sendMessage(from, { delete: msg.key });
            return;
        }

        // Iniciar dinámicas automáticas
        if (isGroup && settings.features.autoGames && !dynamicsStarted[from]) {
            const dinamicas = global.comandos.get('dinamica');
            if (dinamicas?.startAutoDinamicas) dinamicas.startAutoDinamicas(sock, from);
            dynamicsStarted[from] = true;
        }

        // Registro de actividad y Sistema de Niveles (XP)
        if (settings.features.userRegistration) {
            let stats = readDatabase('stats.json');
            if (!stats[sender]) stats[sender] = { messages: 0, lastActive: Date.now(), xp: 0, level: 1 };
            stats[sender].messages += 1;
            stats[sender].lastActive = Date.now();
            stats[sender].xp = (stats[sender].xp || 0) + 10;

            const newLevel = Math.floor(stats[sender].xp / 100) + 1;
            if (newLevel > (stats[sender].level || 1)) {
                stats[sender].level = newLevel;
                await sock.sendMessage(from, { text: `🎉 ¡Felicidades @${sender.split('@')[0]}! Has subido al nivel *${newLevel}*`, mentions: [sender] });
            }

            let users = readDatabase('usuarios.json');
            let userIndex = users.findIndex(u => u.id === sender);
            if (userIndex !== -1 && stats[sender].messages > 50 && users[userIndex].role === 'Nuevo miembro') {
                users[userIndex].role = 'Miembro';
                writeDatabase('usuarios.json', users);
                await sock.sendMessage(from, { text: `🎖️ @${sender.split('@')[0]} ahora es un *Miembro* oficial del grupo.`, mentions: [sender] });
            }

            writeDatabase('stats.json', stats);
        }

        // Saludos automáticos
        const lowerBody = body.toLowerCase();
        if (lowerBody.includes('buenos días') || lowerBody.includes('buenos dias')) {
            await sock.sendMessage(from, { text: `🌅 ¡Buenos días @${sender.split('@')[0]}! Que tengas un excelente día en *${settings.groupName}*.`, mentions: [sender] });
        } else if (lowerBody.includes('buenas noches')) {
            await sock.sendMessage(from, { text: `🌙 ¡Buenas noches @${sender.split('@')[0]}! Descansa y sueña con los angelitos.`, mentions: [sender] });
        }

        // Sistema de presentación
        if (body.includes('Nombre:') && body.includes('Edad:') && settings.features.userRegistration) {
            let users = readDatabase('usuarios.json');
            if (!users.find(u => u.id === sender)) {
                users.push({ id: sender, presentation: body, role: 'Nuevo miembro', date: new Date().toISOString() });
                writeDatabase('usuarios.json', users);
                await sock.sendMessage(from, { text: `✅ Presentación registrada con éxito. ¡Bienvenido a la familia! @${sender.split('@')[0]}`, mentions: [sender] });
            }
        }

        if (!command) return;

        // ✅ Ejecutar comando automáticamente desde global.comandos
        const cmdMod = global.comandos.get(command);
        if (cmdMod?.handle) {
            await cmdMod.handle(sock, from, msg, command, args, sender);

        // Comandos fijos sin archivo propio
        } else if (command === 'ping') {
            await sock.sendMessage(from, { text: '🏓 Pong!' });

        } else if (command === 'stats') {
            const statsData = readDatabase('stats.json');
            const userStats = statsData[sender] || { messages: 0, xp: 0, level: 1 };
            await sock.sendMessage(from, {
                text: `📊 *ESTADÍSTICAS DE USUARIO*\n\n` +
                      `👤 Usuario: @${sender.split('@')[0]}\n` +
                      `✉️ Mensajes: ${userStats.messages}\n` +
                      `🌟 Nivel: ${userStats.level || 1}\n` +
                      `✨ XP: ${userStats.xp || 0}`,
                mentions: [sender]
            });
        }

    } catch (err) {
        console.error('Error en handleMessage:', err);
    }
};

module.exports = { handleMessage };

if (require.main === module) {
    start();
}
