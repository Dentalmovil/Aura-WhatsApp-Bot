require('dotenv').config(); 
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const http = require('http');
const fs = require('fs');

// --- CONFIGURACIÓN DE SECRETOS (Desde GitHub Secrets) ---
const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MI_NUMERO = "+573157176984"; // Tu número configurado

// Servidor de monitoreo (Para Uptime)
const PORT = process.env.PORT || 8081;
http.createServer((req, res) => { 
    res.write("Aura Bot: Activo en GitHub Actions"); 
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
        printQRInTerminal: false, // Desactivamos QR para usar código
        browser: ["Aura-Cesar", "Chrome", "110.0.0"] 
    });

    // --- LÓGICA DE VINCULACIÓN POR CÓDIGO (Para ver en Actions) ---
    if (!sock.authState.creds.registered) {
        console.log("⏳ Generando código de vinculación para: " + MI_NUMERO);
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(MI_NUMERO);
                console.log(`\n\n🚀 TU CÓDIGO DE VINCULACIÓN ES: ${code}\n\n`);
            } catch (err) {
                console.log("Error al generar código:", err);
            }
        }, 5000);
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("\n✅ Aura WhatsApp Bot: ONLINE");
            await enviarTelegram("🚀 *Aura Sistema:* Conectado desde GitHub Actions.");
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

        // 1. COMANDO ETHEREUM
        if (text.includes("eth") || text.includes("ethereum")) {
            try {
                const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,cop");
                const ethUsd = res.data.ethereum.usd;
                const responseText = `💎 *Aura Ethereum Update*\n\nPrecio: *$${ethUsd} USD*`;
                await sock.sendMessage(remoteJid, { text: responseText });
                await enviarTelegram(responseText);
            } catch (e) { console.log("Error API"); }
        }

        // 2. RECORDATORIOS
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
        
        // 3. AGRO
        else if (text.match(/(ganaderia|maiz)/)) {
            await sock.sendMessage(remoteJid, { text: "🌽🐄 *Aura Agro:* Trazabilidad activa en el Cesar." });
        }
    });
}

connect().catch(err => console.log(err));
