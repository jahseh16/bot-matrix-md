const isLink = (text) => {
    const linkRegex = /chat.whatsapp.com\/[a-zA-Z0-9]*/g;
    const urlRegex = /https?:\/\/[^\s]+/g;
    return linkRegex.test(text) || urlRegex.test(text);
};

module.exports = { isLink };
