const lastMessages = {};

const checkSpam = (userId, message) => {
    if (!lastMessages[userId]) {
        lastMessages[userId] = {
            text: message,
            count: 1
        };
        return false;
    }

    if (lastMessages[userId].text === message) {
        lastMessages[userId].count++;
    } else {
        lastMessages[userId].text = message;
        lastMessages[userId].count = 1;
    }

    if (lastMessages[userId].count > 3) { // More than 3 repeated messages
        lastMessages[userId].count = 0; // Reset
        return true;
    }

    return false;
};

module.exports = { checkSpam };
