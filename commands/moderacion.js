const settings = require('../settings');

const handle = async (sock, from, msg, command, args, sender) => {
    // Basic moderation commands
    switch (command) {
        case 'rules':
        case 'reglas':
            await sock.sendMessage(from, { text: `📋 *REGLAS DEL GRUPO*\n\n${settings.rules}` });
            break;
        case 'warn':
            // Implementation for warnings
            await sock.sendMessage(from, { text: "⚠️ Función de advertencia en desarrollo." });
            break;
    }
};

module.exports = { handle };
