const settings = require('../settings');

const handle = async (sock, from, msg, command, args, sender) => {
    const groupMetadata = await sock.groupMetadata(from);
    const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
    const isBotAdmin = admins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net') || admins.includes(sock.user.id);
    const isSenderAdmin = admins.includes(sender) || settings.ownerNumbers.includes(sender.split('@')[0]);

    if (!isSenderAdmin) {
        return sock.sendMessage(from, { text: "❌ Este comando es solo para administradores." });
    }

    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
    const userToAction = mentioned[0] || quoted || (args[0] ? args[0].replace('@', '') + '@s.whatsapp.net' : null);

    switch (command) {
        case 'kick':
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ Necesito ser admin para eliminar personas." });
            if (!userToAction) return sock.sendMessage(from, { text: "⚠️ Menciona a alguien para eliminar." });
            await sock.groupParticipantsUpdate(from, [userToAction], 'remove');
            await sock.sendMessage(from, { text: `✅ Usuario eliminado.` });
            break;
        case 'promote':
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ Necesito ser admin." });
            if (!userToAction) return sock.sendMessage(from, { text: "⚠️ Menciona a alguien." });
            await sock.groupParticipantsUpdate(from, [userToAction], 'promote');
            await sock.sendMessage(from, { text: `✅ Usuario ascendido a admin.` });
            break;
        case 'demote':
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ Necesito ser admin." });
            if (!userToAction) return sock.sendMessage(from, { text: "⚠️ Menciona a alguien." });
            await sock.groupParticipantsUpdate(from, [userToAction], 'demote');
            await sock.sendMessage(from, { text: `✅ Usuario degradado.` });
            break;
        case 'group':
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ Necesito ser admin." });
            if (args[0] === 'open') {
                await sock.groupSettingUpdate(from, 'not_announcement');
                await sock.sendMessage(from, { text: "✅ Grupo abierto." });
            } else if (args[0] === 'close') {
                await sock.groupSettingUpdate(from, 'announcement');
                await sock.sendMessage(from, { text: "✅ Grupo cerrado (solo admins)." });
            } else {
                await sock.sendMessage(from, { text: "⚠️ Usa: .group open o .group close" });
            }
            break;
    }
};

module.exports = { handle };
