const pino = require('pino');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const settings = require('./settings');
const { readDatabase, writeDatabase } = require('./utils/funciones');
const path = require('path');

// Variables de Baileys (se cargan dinámicamente)
// Variables de Baileys (se cargan dinámicamente)
let makeWASocket, useMultiFileAuthState, DisconnectReason,
    fetchLatestBaileysVersion, makeInMemoryStore, jidDecode;

async function loadBaileys() {
    // Jalamos los componentes directo desde el build de CommonJS de Baileys
    const baileys = require('@whiskeysockets/baileys/lib/index.js');

    // Asignamos de forma directa y segura
    makeWASocket              = baileys.makeWASocket;
    useMultiFileAuthState     = baileys.useMultiFileAuthState;
    DisconnectReason          = baileys.DisconnectReason;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
    makeInMemoryStore         = baileys.makeInMemoryStore;
    jidDecode                 = baileys.jidDecode;
}

const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    } else return jid;
};

async function connectToWhatsApp() {
    await loadBaileys();

    const store = makeInMemoryStore({
        logger: pino().child({ level: 'silent', stream: 'store' })
    });

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: [settings.botName, 'Chrome', '1.0.0']
    });

    store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;
            console.log('Connection closed due to', lastDisconnect.error, ', reconnecting:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Conexión establecida con éxito');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message) return;
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
