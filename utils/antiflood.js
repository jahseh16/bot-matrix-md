const userMessages = {};
const settings = require('../settings');

const checkFlood = (userId) => {
    if (!userMessages[userId]) {
        userMessages[userId] = {
            count: 1,
            lastMessageTime: Date.now()
        };
        return false;
    }

    const now = Date.now();
    const diff = now - userMessages[userId].lastMessageTime;

    if (diff < 2000) { // If less than 2 seconds between messages
        userMessages[userId].count++;
    } else {
        userMessages[userId].count = 1;
    }

    userMessages[userId].lastMessageTime = now;

    if (userMessages[userId].count > settings.floodLimit) {
        userMessages[userId].count = 0; // Reset after warning/action
        return true;
    }

    return false;
};

module.exports = { checkFlood };
