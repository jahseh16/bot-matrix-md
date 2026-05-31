const fs = require('fs');
const path = require('path');

const readDatabase = (fileName) => {
    const filePath = path.join(__dirname, '../database', fileName);
    if (!fs.existsSync(filePath)) {
        return fileName.endsWith('.json') && fileName !== 'usuarios.json' ? {} : [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
};

const writeDatabase = (fileName, data) => {
    const filePath = path.join(__dirname, '../database', fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

const getRandom = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

module.exports = {
    readDatabase,
    writeDatabase,
    getRandom
};
