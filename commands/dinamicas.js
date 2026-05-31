const { getRandom } = require('../utils/funciones');

const dinamicas = [
    "🎮 *Dinámica del día:* ¿Prefieres café o té? Responde con 1 o 2.",
    "🎮 *Dinámica del día:* ¿Cuál es tu serie favorita de todos los tiempos?",
    "🎮 *Dinámica del día:* Si pudieras tener un superpoder, ¿cuál elegirías?",
    "🎮 *Dinámica del día:* ¿Cuál es tu canción favorita en este momento?"
];

const handle = async (sock, from, msg, command, args, sender) => {
    if (command === 'dinamica') {
        await sock.sendMessage(from, { text: getRandom(dinamicas) });
    }
};

const startAutoDinamicas = (sock, from) => {
    // Send a dynamic every 4 hours
    setInterval(async () => {
        await sock.sendMessage(from, { text: getRandom(dinamicas) });
    }, 4 * 60 * 60 * 1000);
};

module.exports = { handle, startAutoDinamicas };
