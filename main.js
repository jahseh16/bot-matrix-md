'use strict';

const pino = require('pino');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const settings = require('./settings');
const { readDatabase, writeDatabase } = require('./utils/funciones');

// Variables de Baileys — apuntan a wileys via alias npm
let makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    jidDecode;

async function loadBaileys() {
    const baileys = require('@whiskeysockets/baileys');

    ({
        makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
        makeInMemoryStore,
        jidDecode
    } = baileys);

    // Validar exports críticos
    const required = {
        makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
        jidDecode
    };

    for (const [name, fn] of Object.entries(required)) {
        if (typeof fn === 'undefined') {
            throw new Error(
                `[loadBaileys] ERROR: "${name}" no fue encontrado en wileys (@whiskeysockets/baileys alias).`
            );
        }
    }

    console.log('✅ wileys cargado correctamente via alias @whiskeysockets/baileys.');
}

const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return (decode.user && decode.server)
            ? `${decode.user}@${decode.server}`
            : jid;
    }
    return jid;
};

async function connectToWhatsApp() {
    await loadBaileys();

    const store = typeof makeInMemoryStore === 'function'
        ? makeInMemoryStore({ logger: pino({ level: 'silent' }).child({ stream: 'store' }) })
        : null;

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    console.log(`🔧 Usando wileys versión: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: [settings.botName, 'Chrome', '1.0.0']
    });

    if (store) store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log(
                '⚠️  Conexión cerrada. Razón:',
                lastDisconnect?.error?.message || 'desconocida',
                '| Reconectando:', shouldReconnect
            );

            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Conexión establecida con éxito');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        const msg = m.messages[0];
        if (!msg?.message) return;
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? decodeJid(msg.key.participant) : decodeJid(from);

        require('./index').handleMessage(sock, msg, from, isGroup, sender);
    });

    sock.ev.on('group-participants.update', async (anu) => {
        require('./commands/bienvenida').handleWelcome(sock, anu);
    });

    return sock;
}

module.exports = { connectToWhatsApp };
