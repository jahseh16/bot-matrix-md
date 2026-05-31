const settings = require('../settings');

const handleWelcome = async (sock, anu) => {
    const { id, participants, action } = anu;

    // ── BIENVENIDA ──
    if (action === 'add' && settings.features.autoWelcome) {
        for (const num of participants) {
            const tag    = num.split('@')[0];
            const nombre = `@${tag}`;

            // Foto de perfil
            let profilePic = null;
            try {
                profilePic = await sock.profilePictureUrl(num, 'image');
            } catch {}

            const texto = settings.welcomeMessage.replace('{name}', nombre);

            if (profilePic) {
                await sock.sendMessage(id, {
                    image:    { url: profilePic },
                    caption:  texto,
                    mentions: [num]
                });
            } else {
                await sock.sendMessage(id, {
                    text:     texto,
                    mentions: [num]
                });
            }
        }
    }

    // ── DESPEDIDA ──
    if (action === 'remove' && settings.features.autoGoodbye) {
        for (const num of participants) {
            const tag    = num.split('@')[0];
            const nombre = `@${tag}`;

            let profilePic = null;
            try {
                profilePic = await sock.profilePictureUrl(num, 'image');
            } catch {}

            const texto = settings.goodbyeMessage.replace('{name}', nombre);

            if (profilePic) {
                await sock.sendMessage(id, {
                    image:    { url: profilePic },
                    caption:  texto,
                    mentions: [num]
                });
            } else {
                await sock.sendMessage(id, {
                    text:     texto,
                    mentions: [num]
                });
            }
        }
    }
};

module.exports = { handleWelcome };
