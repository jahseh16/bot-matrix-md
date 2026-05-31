// ═══════════════════════════════════════════════════════════
// utils/devmatrixs-api.js
// Cliente centralizado para api.devmatrixs.lat
// ═══════════════════════════════════════════════════════════

const axios = require("axios");

const API_BASE = "https://api.devmatrixs.lat";
const API_KEY  = process.env.DEVMATRIX_API_KEY || "mk-695591790f0f21e807e1a15ae849328998e63bfb17dd67ec";

const headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
};

/**
 * Descarga contenido de TikTok, YouTube o Instagram.
 * GET /api/download?url=<link>
 * @param {string} url - URL del video/post
 * @returns {Object} { success, platform, title, thumbnail, author, formats[] }
 */
async function download(url) {
    const { data } = await axios.get(`${API_BASE}/api/download`, {
        params: { url },
        headers: { "x-api-key": API_KEY },
        timeout: 120000,
    });
    return data;
}

/**
 * Chat con IA.
 * POST /api/ai/chat
 * @param {Object} opts
 * @param {Array}  opts.messages - Array de { role, content }
 * @param {string} opts.model    - fast | balanced | smart | creative | reasoning
 * @returns {Object} { ok, content, model, usage }
 */
async function aiChat({ messages, model = "balanced" }) {
    const { data } = await axios.post(`${API_BASE}/api/ai/chat`, {
        messages,
        model,
        stream: false,
    }, {
        headers,
        timeout: 60000,
    });
    return data;
}

/**
 * Listar modelos de IA disponibles.
 * GET /api/ai/models
 * @returns {Object} { ok, models[], usage }
 */
async function aiModels() {
    const { data } = await axios.get(`${API_BASE}/api/ai/models`, {
        headers: { "x-api-key": API_KEY },
        timeout: 10000,
    });
    return data;
}

/**
 * Generar imagen con IA.
 * POST /api/image
 * @param {Object} opts
 * @param {string} opts.prompt - Descripción de la imagen
 * @param {number} opts.width  - Ancho (default 1024)
 * @param {number} opts.height - Alto (default 1024)
 * @param {string} opts.model  - Modelo (default 'flux')
 * @returns {Object} { ok, url, prompt, model }
 */
async function generateImage({ prompt, width = 1024, height = 1024, model = "flux" }) {
    const { data } = await axios.post(`${API_BASE}/api/image`, {
        prompt,
        width,
        height,
        model,
    }, {
        headers,
        timeout: 60000,
    });
    return data;
}

module.exports = {
    API_BASE,
    API_KEY,
    download,
    aiChat,
    aiModels,
    generateImage,
};
