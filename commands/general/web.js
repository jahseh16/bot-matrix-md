'use strict';

module.exports = {
    command: ['web', 'sitio', 'website'],
    description: 'Muestra el enlace al sitio web oficial del bot',
    category: 'general',

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            await sock.sendMessage(from, {
                text: [
                    `🌐 *Sitio Web Oficial — Matrix Bot*`,
                    ``,
                    `👉 https://devmatrixs.lat`,
                    ``,
                    `⚙️ _devmatrixs.lat — El control._`
                ].join('\n')
            }, { quoted: msg });
        } catch (err) {
            console.error('❌ [web] Error:', err);
        }
    }
};
