const axios = require("axios");
const settings = require("../../settings");

const BASE_URL = "https://apiaxi.i11.eu/search/wpgrupos";

module.exports = {
    command: ["grupos", "buscargrupo", "searchgroup"],
    description: "Busca grupos de WhatsApp por categoría",
    category: "busca-grupos",

    handle: async (sock, from, msg, command, args, sender) => {
        try {
            const categoria = args[0]?.toLowerCase() || "mundo";
            const limite = parseInt(args[1]) || 10;

            if (limite < 1 || limite > 10) {
                return await sock.sendMessage(from, {
                    text: `❌ El límite debe estar entre 1 y 20.`,
                });
            }

            await sock.sendMessage(from, {
                text: `🔍 Buscando grupos de *${categoria}*...`,
            });

            const { data } = await axios.get(BASE_URL, {
                params: { categoria, limite },
                timeout: 20000,
                headers: { "Accept": "application/json" }
            });

            // ✅ Estructura correcta: data.resultado.grupos
            if (!data?.status || !data?.resultado?.grupos?.length) {
                return await sock.sendMessage(from, {
                    text: `😔 No se encontraron grupos para *${categoria}*.\n\n_Intenta con otra categoría: ${settings.prefix}grupos gaming_`,
                });
            }

            const { grupos, total, categoria: catApi } = data.resultado;

            let texto = `╭──❮ 🔍 *Grupos de WhatsApp* ❯──╮\n│\n`;
            texto += `│  🏷️ Categoría: *${catApi.toUpperCase()}*\n`;
            texto += `│  📦 Total: *${total}* grupos\n│\n`;

            grupos.forEach((grupo, i) => {
                const estado = grupo.estado === "ok" ? "✅" : "⚠️";
                texto += `│  *${i + 1}.* ${grupo.nombre}\n`;
                texto += `│  🌍 País: ${grupo.pais}\n`;
                texto += `│  ${estado} ${grupo.enlace}\n`;
                texto += `│\n`;
            });

            texto += `╰──────────────────────╯\n`;
            texto += `_Uso: ${settings.prefix}grupos [categoría] [límite]_\n`;
            texto += `_Ejemplo: ${settings.prefix}grupos gaming 5_`;

            await sock.sendMessage(from, { text: texto });

        } catch (err) {
            console.error("❌ Error en comando grupos:", err.message);

            if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
                return await sock.sendMessage(from, {
                    text: `⏳ La API tardó demasiado. Inténtalo de nuevo.`,
                });
            }
            if (err.response?.status === 404) {
                return await sock.sendMessage(from, {
                    text: `❌ Categoría no encontrada.`,
                });
            }

            await sock.sendMessage(from, {
                text: `❌ Error al buscar grupos.\n\n${err.message}`,
            });
        }
    },
};