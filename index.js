require('dotenv').config(); 
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const http = require('http');
const fs = require('fs');

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const miNumero = "573157176984";

// --- SERVIDOR WEB + AUTO-PING ---
const PORT = process.env.PORT || 8081;
const server = http.createServer((req, res) => { 
    res.write("Aura Bot: Activo y Despierto"); 
    res.end(); 
});

server.listen(PORT, () => {
    console.log(`📡 Servidor escuchando en puerto ${PORT}`);
    // Auto-ping cada 5 minutos para evitar que el servidor se duerma
    setInterval(() => {
        http.get(`http://localhost:${PORT}`, (res) => {
            console.log("💓 Auto-ping enviado para mantener vivo el proceso.");
        });
    }, 300000); 
});

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
        printQRInTerminal: false, 
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        keepAliveIntervalMs: 30000 // Mantiene la conexión de WhatsApp activa
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(miNumero);
                await enviarTelegram(`🔑 *Aura New Code:* \`${code}\``);
            } catch (err) { console.log("Error Pairing:", err); }
        }, 5000); 
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("✅ Aura Online");
            await enviarTelegram("🚀 *Aura:* Sistema reiniciado y conectado.");
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log("❌ Conexión cerrada. Razón:", reason);
            // Si no es un cierre voluntario, intenta reconectar inmediatamente
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reintentando conexión...");
                connect();
            }
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const remoteJid = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text.includes("eth")) {
            const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
            await sock.sendMessage(remoteJid, { text: `💎 ETH: $${res.data.ethereum.usd} USD` });
        }
        else if (text.match(/(ganaderia|maiz)/)) {
            await sock.sendMessage(remoteJid, { text: "🌽🐄 *Aura Agro:* Trazabilidad activa." });
        }
    });
}

connect().catch(err => console.log("Error fatal:", err));

