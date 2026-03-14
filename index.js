const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const http = require('http');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// Servidor para UptimeRobot y evitar que el contenedor se duerma
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.write("Aura WhatsApp Bot: Online con Memoria"); 
    res.end(); 
}).listen(PORT, () => {
    console.log(`🌐 Servidor de monitoreo activo en puerto ${PORT}`);
});

// Gestión de la base de datos de recordatorios
const DB_PATH = './recordatorios.json';
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

function guardarRecordatorio(recordatorio) {
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    db.push(recordatorio);
    fs.writeFileSync(DB_PATH, JSON.stringify(db));
}

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({ 
        version, 
        auth: state, 
        logger: pino({ level: "silent" }), 
        printQRInTerminal: false, // Lo manejamos nosotros manualmente abajo
        browser: ["Aura Bot", "Chrome", "1.0.0"] 
    });

    // --- MANEJO DE CONEXIÓN Y QR ---
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📢 ESCANEA ESTE CÓDIGO CON TU WHATSAPP:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`🔄 Conexión cerrada. Razón: ${reason}`);
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconectando...");
                connect();
            } else {
                console.log("❌ Sesión cerrada. Borra la carpeta 'auth_session' y escanea de nuevo.");
            }
        } else if (connection === "open") {
            console.log("\n✅ Aura WhatsApp Bot: ONLINE Y VINCULADO");
            
            // Revisar recordatorios pendientes al iniciar
            const db = JSON.parse(fs.readFileSync(DB_PATH));
            const ahora = Date.now();
            db.forEach((rec) => {
                const tiempoRestante = rec.fechaEjecucion - ahora;
                if (tiempoRestante > 0) {
                    setTimeout(() => {
                        sock.sendMessage(rec.jid, { text: `⏰ *MEMORIA AURA:* No se me olvidó, colega: *${rec.tarea}*` });
                    }, tiempoRestante);
                }
            });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- LÓGICA DE MENSAJES ---
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 1. RECORDATORIOS
        if (lowerText.startsWith("recordar en")) {
            const parts = lowerText.split(" ");
            const tiempo = parseInt(parts[2]);
            const unidad = parts[3];
            const tarea = parts.slice(4).join(" ");
            
            let ms = 0;
            if (unidad.includes("minuto")) ms = tiempo * 60000;
            else if (unidad.includes("hora")) ms = tiempo * 3600000;
            else ms = tiempo * 1000;

            if (ms > 0 && tarea) {
                const fechaEjecucion = Date.now() + ms;
                guardarRecordatorio({ jid: remoteJid, tarea, fechaEjecucion });
                
                await sock.sendMessage(remoteJid, { text: `✅ Guardado en mi memoria: *${tarea}*. Te aviso en ${tiempo} ${unidad}.` });
                
                setTimeout(() => {
                    sock.sendMessage(remoteJid, { text: `⏰ *AVISO:* ${tarea}` });
                }, ms);
            }
        }

        // 2. CRIPTO
        else if (lowerText.match(/(precio|btc|xrp|bnb|dolar)/)) {
            try {
                const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ripple,binancecoin&vs_currencies=usd");
                const btc = res.data.bitcoin.usd;
                const bnb = res.data.binancecoin.usd;
                const xrp = res.data.ripple.usd;
                await sock.sendMessage(remoteJid, { text: `💰 *Aura Market*\n\nBTC: $${btc}\nBNB: $${bnb}\nXRP: $${xrp}` });
            } catch (e) {
                await sock.sendMessage(remoteJid, { text: "❌ Error al consultar precios. Intenta más tarde." });
            }
        }

        // 3. LEGAL Y AGRO
        else if (lowerText.includes("constitucion")) {
            await sock.sendMessage(remoteJid, { text: "🇨🇴 *Aura Legal:* El Art. 1 dice que Colombia es un Estado social de derecho. ¿Quieres saber sobre la Ley de Tierras?" });
        }
        else if (lowerText.match(/(ganaderia|maiz)/)) {
            await sock.sendMessage(remoteJid, { text: "🌽🐄 *Aura Agro:* Monitoreando trazabilidad ICA y suelos. ¡Dale con toda, colega!" });
        }
    });
}

// Iniciar la conexión
connect().catch(err => console.log("Error en connect():", err));

