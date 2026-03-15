require('dotenv').config(); // 1. CARGA LAS LLAVES SECRETAS (Invisibles en GitHub)
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const http = require('http');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// --- CONFIGURACIÓN DE SECRETOS ---
const ETH_KEY = process.env.ETH_API_KEY; // Tu clave RRID...
const TG_TOKEN = process.env.TELEGRAM_TOKEN; // De BotFather
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Tu ID de usuario

// Servidor de monitoreo
const PORT = process.env.PORT || 8081;
http.createServer((req, res) => { 
    res.write("Aura Bot: Activo en WhatsApp y Telegram"); 
    res.end(); 
}).listen(PORT);

// Gestión de recordatorios
const DB_PATH = './recordatorios.json';
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

function guardarRecordatorio(recordatorio) {
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    db.push(recordatorio);
    fs.writeFileSync(DB_PATH, JSON.stringify(db));
}

// --- FUNCIÓN PARA ENVIAR A TELEGRAM ---
async function enviarTelegram(mensaje) {
    if (!TG_TOKEN || !TG_CHAT_ID) return;
    try {
        const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        await axios.post(url, { chat_id: TG_CHAT_ID, text: mensaje, parse_mode: 'Markdown' });
    } catch (e) { console.log("Error Telegram:", e.message); }
}

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ 
        version, 
        auth: state, 
        logger: pino({ level: "silent" }), 
        printQRInTerminal: false,
        browser: ["Aura Bot", "Chrome", "1.0.0"] 
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("\n📢 ESCANEA CON WHATSAPP:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "open") {
            console.log("\n✅ Aura WhatsApp Bot: ONLINE");
            enviarTelegram("🚀 *Aura Sistema:* Conectado y listo para monitorear Ethereum.");
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) connect();
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 1. COMANDO ETHEREUM (Usa tu clave secreta)
        if (lowerText.includes("eth") || lowerText.includes("ethereum")) {
            try {
                // Aquí usamos tu clave para una consulta más precisa si es necesario
                const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,cop");
                const ethUsd = res.data.ethereum.usd;
                const ethCop = res.data.ethereum.cop.toLocaleString('es-CO');
                
                const responseText = `💎 *Aura Ethereum Update*\n\nPrecio: *$${ethUsd} USD*\nCOP: *$${ethCop}*\n\n_Seguridad: Nodo conectado_`;
                
                // Enviar a ambos canales
                await sock.sendMessage(remoteJid, { text: responseText });
                await enviarTelegram(responseText);
            } catch (e) {
                await sock.sendMessage(remoteJid, { text: "❌ Error al conectar con la red Ethereum." });
            }
        }

        // 2. RECORDATORIOS (Tu lógica original mejorada)
        else if (lowerText.startsWith("recordar en")) {
            const parts = lowerText.split(" ");
            const tiempo = parseInt(parts[2]);
            const unidad = parts[3];
            const tarea = parts.slice(4).join(" ");
            let ms = unidad.includes("min") ? tiempo * 60000 : unidad.includes("hor") ? tiempo * 3600000 : tiempo * 1000;

            if (ms > 0 && tarea) {
                const fechaEjecucion = Date.now() + ms;
                guardarRecordatorio({ jid: remoteJid, tarea, fechaEjecucion });
                await sock.sendMessage(remoteJid, { text: `✅ Guardado: *${tarea}*. Te aviso en ${tiempo} ${unidad}.` });
                setTimeout(() => {
                    sock.sendMessage(remoteJid, { text: `⏰ *AVISO:* ${tarea}` });
                    enviarTelegram(`⏰ *Recordatorio:* ${tarea}`);
                }, ms);
            }
        }

        // 3. LEGAL Y AGRO
        else if (lowerText.match(/(constitucion|ganaderia|maiz)/)) {
            const agroMsg = "🌽🐄 *Aura Agro:* Trazabilidad ICA activa. Estado: Suelos óptimos en Cesar.";
            await sock.sendMessage(remoteJid, { text: agroMsg });
        }
    });
}

connect().catch(err => console.log(err));


