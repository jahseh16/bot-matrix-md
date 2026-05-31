'use strict';

const pino = require('pino');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const settings = require('./settings');
const { readDatabase, writeDatabase } = require('./utils/funciones');

// Variables de Baileys — se cargan una sola vez vía loadBaileys()
let makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    jidDecode;

async function loadBaileys() {
    // En v6, el entry point del paquete expone todos los exports correctamente.
    // NO apuntes a lib/index.js — eso acopla el código a la estructura interna.
    const baileys = require('@whiskeysockets/baileys');

    // Destructuring explícito: si algún export no existe, lo sabrás de inmediato
    ({
        makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
        makeInMemoryStore,
        jidDecode
    } = baileys);

    // Validación en tiempo de carga — detecta el problema antes de usarlos
    const required = {
        makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
        makeInMemoryStore,
        jidDecode
    };

    for (const [name, fn] of Object.entries(required)) {
        if (typeof fn === 'undefined') {
            throw new Error(
                `[loadBaileys] ERROR: "${name}" no fue encontrado en @whiskeysockets/baileys. ` +
                `Verifica que tienes instalada la versión 6.x (pnpm add @whiskeysockets/baileys@6.7.16)`
            );
        }
    }

    console.log('✅ Baileys cargado correctamente.');
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
    // Carga y valida Baileys antes de usarlo
    await loadBaileys();

    // makeInMemoryStore ahora está garantizado como función
    const store = makeInMemoryStore({
        logger: pino({ level: 'silent' }).child({ stream: 'store' })
    });

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    console.log(`🔧 Usando Baileys versión: ${version.join('.')}`);

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
