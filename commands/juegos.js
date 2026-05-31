const { getRandom } = require('../utils/funciones');

const handle = async (sock, from, msg, command, args, sender) => {
    const verdades = [
        "¿Cuál es tu mayor secreto?",
        "¿Quién te gusta del grupo?",
        "¿Qué es lo más vergonzoso que has hecho?",
        "¿Alguna vez has mentido para salir de una cita?"
    ];
    const retos = [
        "Envía una nota de voz cantando una canción.",
        "Cambia tu foto de perfil por una graciosa durante 10 minutos.",
        "Di quién es la persona más atractiva del grupo.",
        "Envía un emoji de corazón a la persona que te guste."
    ];
    const preguntas = [
        "¿Cuál es tu hobby favorito?",
        "¿Qué comida odias?",
        "¿A dónde viajarías si el dinero no fuera problema?",
        "¿Cuál es tu película favorita?"
    ];

    switch (command) {
        case 'verdad':
            await sock.sendMessage(from, { text: `🤔 *Verdad:* ${getRandom(verdades)}` });
            break;
        case 'reto':
            await sock.sendMessage(from, { text: `🔥 *Reto:* ${getRandom(retos)}` });
            break;
        case 'dado':
            const dado = Math.floor(Math.random() * 6) + 1;
            await sock.sendMessage(from, { text: `🎲 Has sacado un: *${dado}*` });
            break;
        case 'ruleta':
            const ruleta = Math.random() > 0.5 ? "¡BANG! Has muerto 💀" : "Te has salvado... por ahora 😌";
            await sock.sendMessage(from, { text: `🔫 *Ruleta Rusa:* ${ruleta}` });
            break;
        case 'pregunta':
            await sock.sendMessage(from, { text: `❓ *Pregunta:* ${getRandom(preguntas)}` });
            break;
        case 'parejas':
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants.map(p => p.id);
            const p1 = getRandom(participants);
            const p2 = getRandom(participants.filter(p => p !== p1));
            await sock.sendMessage(from, {
                text: `💖 La pareja perfecta es: @${p1.split('@')[0]} y @${p2.split('@')[0]}`,
                mentions: [p1, p2]
            });
            break;
        case 'quien':
            const metadataQuien = await sock.groupMetadata(from);
            const participantQuien = getRandom(metadataQuien.participants.map(p => p.id));
            const accion = args.join(' ') || "sería capaz de hacer eso";
            await sock.sendMessage(from, {
                text: `🧐 Yo creo que @${participantQuien.split('@')[0]} ${accion}`,
                mentions: [participantQuien]
            });
            break;
        case 'topactivos':
            const { readDatabase } = require('../utils/funciones');
            const stats = readDatabase('stats.json');
            const top = Object.entries(stats)
                .sort(([, a], [, b]) => b.messages - a.messages)
                .slice(0, 5);
            let text = "🏆 *TOP 5 ACTIVOS* 🏆\n\n";
            top.forEach(([id, data], i) => {
                text += `${i + 1}. @${id.split('@')[0]} - ${data.messages} mensajes\n`;
            });
            await sock.sendMessage(from, { text, mentions: top.map(([id]) => id) });
            break;
    }
};

module.exports = { handle };
