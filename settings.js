const settings = {
    botName: "Bot-ZeroDay",
    groupName: "DevMtrix",
    prefix: ".",
    ownerNumbers: ["51935040872"],
    admins: [],

    welcomeMessage: `🎉 *¡Bienvenido/a {name}!* 🚀\n\n¡Hola! Ya formas parte de la comunidad oficial de *DevMatrixs*.\n\nAquí encontrarás actualizaciones, novedades, soporte y todo sobre nuestra IA y página.\n\n¡Estamos felices de tenerte con nosotros! 😊\n\nDisfruta del grupo y no dudes en participar 🔥`,

    goodbyeMessage: `😢 *{name}* ha salido del grupo.\n\n¡Hasta pronto! Esperamos verte de nuevo 👋`,

    features: {
        antiLink: true,
        antiSpam: true,
        antiBots: true,
        antiFlood: true,
        autoWelcome: true,
        autoGoodbye: true,
        autoGames: true,
        userRegistration: true
    },

    rules: "1. No insultar.\n2. No enviar contenido +18.\n3. Respetar a todos los miembros.",
    floodLimit: 5,
    muteTime: 10 * 60 * 1000
};

module.exports = settings;
