const fs   = require('fs');
const path = require('path');

const readDatabase = (fileName) => {
    const filePath = path.join(__dirname, '../database', fileName);
    const fallback = (fileName !== 'usuarios.json') ? {} : [];

    if (!fs.existsSync(filePath)) return fallback;

    const data = fs.readFileSync(filePath, 'utf-8').trim();
    if (!data) return fallback;

    try {
        return JSON.parse(data);
    } catch (err) {
        console.error(`⚠️  [readDatabase] JSON corrupto en "${fileName}", reseteando a valor por defecto. Error: ${err.message}`);
        // Auto-repara sobreescribiendo con el fallback para no bloquear el bot
        try {
            fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
        } catch (writeErr) {
            console.error(`❌  [readDatabase] No se pudo reparar "${fileName}": ${writeErr.message}`);
        }
        return fallback;
    }
};

const writeDatabase = (fileName, data) => {
    const filePath = path.join(__dirname, '../database', fileName);
    // Escritura atómica: primero a un .tmp, luego rename, para evitar corrupción
    const tmpPath = filePath + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
    } catch (err) {
        console.error(`❌  [writeDatabase] Error escribiendo "${fileName}": ${err.message}`);
        // Limpieza del .tmp si quedó a medias
        if (fs.existsSync(tmpPath)) {
            try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
    }
};

const getRandom = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

module.exports = {
    readDatabase,
    writeDatabase,
    getRandom
};
