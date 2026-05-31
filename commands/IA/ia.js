// ═══════════════════════════════════════════════════════════
// commands/IA/ia.js
// Chat con IA usando api.devmatrixs.lat/api/ai/chat
// Modelos: fast | balanced | smart | creative | reasoning
// ═══════════════════════════════════════════════════════════

const { aiChat, aiModels } = require("../../utils/devmatrixs-api");

const fakeContact = {
    key: { fromMe: false, participant: "0@s.whatsapp.net" },
    message: {
        contactMessage: {
            displayName: "🤖 Matrix AI",
            vcard: "BEGIN:VCARD\nVERSION:3.0\nN:;Matrix AI;;;\nFN:Matrix AI\nORG:DevMatrixs\nTITLE:IA\nitem1.TEL;waid=0:+0\nitem1.X-ABLabel:WhatsApp\nEND:VCARD"
        }
    }
};

// Historial de conversación por usuario (máximo 10 mensajes)
const userHistory = new Map();
const MAX_HISTORY = 10;

/**
 * Mapea nombres amigables a IDs de modelo de la API
 */
const MODEL_ALIASES = {
    fast:      "fast",
    rapido:    "fast",
    rápido:    "fast",
    balanced:  "balanced",
    normal:    "balanced",
    smart:     "smart",
    inteligente: "smart",
    creative:  "creative",
    creativo:  "creative",
    reasoning: "reasoning",
    pensar:    "reasoning",
    razonar:   "reasoning",
};

const MODEL_DESCRIPTIONS = {
    fast:      "⚡ Llama3 — Respuestas rápidas",
    balanced:  "⚖️ DeepSeek V3 — Equilibrado",
    smart:     "🧠 DeepSeek V3+ — Más potente",
    creative:  "🎨 Mixtral — Creativo",
    reasoning: "💡 DeepSeek R1 — Razonamiento",
};

module.exports = {
    command: ["ia", "ai", "chat", "gpt", "ask", "pregunta", "modelos"],
    description: "Chat con IA — DevMatrixs (múltiples modelos)",
    category: "IA",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            // ── Listar modelos ──
            if (command === "modelos") {
                let text = "```\n";
                text += "╔══════════════════════════════╗\n";
                text += "║  🤖  MODELOS DE IA DISPONIBLES ║\n";
                text += "╚══════════════════════════════╝\n";
                text += "```\n\n";

                for (const [key, desc] of Object.entries(MODEL_DESCRIPTIONS)) {
                    text += `${desc}\n   → \`.ia -m ${key} <pregunta>\`\n\n`;
                }

                text += "━━━━━━━━━━━━━━━━━━━━━\n";
                text += "💡 *Por defecto:* balanced\n";
                text += "🔄 *Borrar historial:* `.ia reset`\n\n";
                text += "_Powered by api.devmatrixs.lat_";

                return await sock.sendMessage(from, { text }, { quoted: fakeContact });
            }

            // ── Parsear argumentos ──
            let model = "balanced";
            let query = args.join(" ");

            // Detectar -m <modelo>
            const modelFlagIdx = args.indexOf("-m");
            if (modelFlagIdx !== -1 && args[modelFlagIdx + 1]) {
                const rawModel = args[modelFlagIdx + 1].toLowerCase();
                model = MODEL_ALIASES[rawModel] || "balanced";
                // Remover -m <modelo> de la query
                const newArgs = [...args];
                newArgs.splice(modelFlagIdx, 2);
                query = newArgs.join(" ");
            }

            // ── Reset historial ──
            if (query.toLowerCase() === "reset" || query.toLowerCase() === "borrar") {
                userHistory.delete(sender);
                return await sock.sendMessage(from, {
                    text: "🗑️ *Historial borrado.*\n\n_Tu próxima conversación empezará desde cero._"
                }, { quoted: msg });
            }

            // ── Sin query ──
            if (!query.trim()) {
                return await sock.sendMessage(from, {
                    text: [
                        "```",
                        "╔══════════════════════════════╗",
                        "║  🤖  MATRIX AI               ║",
                        "╚══════════════════════════════╝",
                        "```",
                        "",
                        "💡 *Uso:*",
                        "  `.ia <pregunta>`",
                        "  `.ia -m smart <pregunta>`",
                        "",
                        "📋 *Ver modelos:* `.modelos`",
                        "🔄 *Borrar historial:* `.ia reset`",
                        "",
                        "_Powered by api.devmatrixs.lat_",
                    ].join("\n")
                }, { quoted: fakeContact });
            }

            // ── Preparar historial ──
            if (!userHistory.has(sender)) {
                userHistory.set(sender, []);
            }
            const history = userHistory.get(sender);

            // Agregar mensaje del usuario
            history.push({ role: "user", content: query });

            // Limitar historial
            while (history.length > MAX_HISTORY) {
                history.shift();
            }

            // System prompt
            const messages = [
                {
                    role: "system",
                    content: "Eres Matrix AI, un asistente inteligente creado por DevMatrixs. Responde de forma clara, concisa y útil. Puedes responder en cualquier idioma según el usuario."
                },
                ...history,
            ];

            await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });
            await sock.sendPresenceUpdate("composing", from);

            // ── Llamar API ──
            const result = await aiChat({ messages, model });

            if (!result?.ok) {
                throw new Error(result?.error || "Error en la respuesta de IA");
            }

            const response = result.content || "Sin respuesta.";
            const usage    = result.usage   || {};

            // Guardar respuesta en historial
            history.push({ role: "assistant", content: response });

            // ── Enviar respuesta ──
            const modelDesc = MODEL_DESCRIPTIONS[model] || model;
            const footer = `\n\n━━━━━━━━━━━━━\n🤖 *Modelo:* ${modelDesc}\n📊 *Tokens:* ${usage.total_tokens || "N/A"}`;

            await sock.sendMessage(from, {
                text: response + footer,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("❌ [MatrixAI] Error:", err.message);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });

            let errorMsg = "❌ Error al procesar tu consulta.";
            if (err.response?.status === 401)
                errorMsg = "🔑 API Key inválida.";
            else if (err.response?.status === 429)
                errorMsg = "⚠️ Límite diario alcanzado. Intenta mañana.";
            else if (err.code === "ECONNABORTED")
                errorMsg = "⏱️ Timeout — el servidor tardó demasiado.";

            await sock.sendMessage(from, {
                text: `${errorMsg}\n\n🔍 *Detalle:* ${err.message}`
            }, { quoted: msg });
        }
    }
};
