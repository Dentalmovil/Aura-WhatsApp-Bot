require('dotenv').config(); 
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const http = require('http');
const fs = require('fs');
const qrcode = require('qrcode-terminal'); // Librería para forzar el QR

// --- CONFIGURACIÓN ---
const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const PORT = process.env.PORT || 8081;
http.createServer((req, res) => { 
    res.write("Aura Bot: Activo"); 
    res.end(); 
}).listen(PORT);

const DB_PATH = './recordatorios.json';
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

function guardarRecordatorio(recordatorio) {
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    db.push(recordatorio);
    fs.writeFileSync(DB_PATH, JSON.stringify(db));
}

async function enviarTelegram(mensaje) {
    if (!TG_TOKEN || !TG_CHAT_ID) return;
    try {
        const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        await axios.post(url, { chat_id: TG_CHAT_ID, text: mensaje, parse_mode: 'Markdown' });
    } catch (e) { console.log("Error Telegram:", e.message); }
}

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ 
        version, 
        auth: state, 
        logger: pino({ level: "silent" }), 
        printQRInTerminal: false, // Lo manejamos nosotros manualmente abajo
        browser: ["Aura-Dentalmovilr4", "Safari", "1.0.0"] 
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // --- ESTO DIBUJARÁ EL QR EN TERMUX ---
        if (qr) {
            console.log("\n✨ [AURA] ESCANEA EL CÓDIGO QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("\n✅ Aura WhatsApp Bot: ONLINE");
            await enviarTelegram("🚀 *Aura Sistema:* Conectado con éxito.");
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
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text.includes("eth") || text.includes("ethereum")) {
            try {
                const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,cop");
                const ethUsd = res.data.ethereum.usd;
                const responseText = `💎 *Aura Ethereum Update*\n\nPrecio: *$${ethUsd} USD*`;
                await sock.sendMessage(remoteJid, { text: responseText });
                await enviarTelegram(responseText);
            } catch (e) { console.log("Error API"); }
        }

        else if (text.startsWith("recordar en")) {
            const parts = text.split(" ");
            const tiempo = parseInt(parts[2]);
            const unidad = parts[3];
            const tarea = parts.slice(4).join(" ");
            let ms = unidad.includes("min") ? tiempo * 60000 : unidad.includes("hor") ? tiempo * 3600000 : tiempo * 1000;

            if (ms > 0 && tarea) {
                const fechaEjecucion = Date.now() + ms;
                guardarRecordatorio({ jid: remoteJid, tarea, fechaEjecucion });
                await sock.sendMessage(remoteJid, { text: `✅ Guardado: *${tarea}*` });
                setTimeout(() => {
                    sock.sendMessage(remoteJid, { text: `⏰ *AVISO:* ${tarea}` });
                    enviarTelegram(`⏰ *Recordatorio:* ${tarea}`);
                }, ms);
            }
        }

        else if (text.match(/(ganaderia|maiz)/)) {
            await sock.sendMessage(remoteJid, { text: "🌽🐄 *Aura Agro:* Trazabilidad activa en el Cesar." });
        }
    });
}

connect().catch(err => console.log(err));

