const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const http = require('http');
const fs = require('fs');

// Servidor para UptimeRobot
http.createServer((req, res) => { res.write("Aura WhatsApp Bot: Online con Memoria"); res.end(); }).listen(8080);

// Función para gestionar la base de datos de recordatorios
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
    const sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }), browser: ["Ubuntu", "Chrome", "20.0.04"] });

    // --- REVISIÓN DE RECORDATORIOS AL INICIAR ---
    sock.ev.on("connection.update", (up) => {
        if (up.connection === "open") {
            console.log("✅ Aura WhatsApp Bot: ONLINE");
            const db = JSON.parse(fs.readFileSync(DB_PATH));
            const ahora = Date.now();
            
            db.forEach((rec, index) => {
                const tiempoRestante = rec.fechaEjecucion - ahora;
                if (tiempoRestante > 0) {
                    setTimeout(() => {
                        sock.sendMessage(rec.jid, { text: `⏰ *MEMORIA AURA:* No se me olvidó, colega: *${rec.tarea}*` });
                    }, tiempoRestante);
                }
            });
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // --- FUNCIÓN DE RECORDAR CON GUARDADO ---
        if (lowerText.startsWith("recordar en")) {
            const parts = lowerText.split(" ");
            const tiempo = parseInt(parts[2]);
            const unidad = parts[3];
            const tarea = parts.slice(4).join(" ");
            let ms = unidad.includes("minuto") ? tiempo * 60000 : unidad.includes("hora") ? tiempo * 3600000 : tiempo * 1000;

            if (ms > 0 && tarea) {
                const fechaEjecucion = Date.now() + ms;
                guardarRecordatorio({ jid: remoteJid, tarea, fechaEjecucion });
                
                await sock.sendMessage(remoteJid, { text: `✅ Guardado en mi memoria: *${tarea}*. Te aviso en ${tiempo} ${unidad}.` });
                
                setTimeout(() => {
                    sock.sendMessage(remoteJid, { text: `⏰ *AVISO:* ${tarea}` });
                }, ms);
            }
        }

        // --- CRIPTO, AGRO Y LEYES ---
        else if (lowerText.match(/(precio|btc|xrp|bnb|dolar)/)) {
            const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ripple,binancecoin&vs_currencies=usd");
            const btc = res.data.bitcoin.usd;
            const bnb = res.data.binancecoin.usd;
            const xrp = res.data.ripple.usd;
            await sock.sendMessage(remoteJid, { text: `💰 *Aura Market*\n\nBTC: $${btc}\nBNB: $${bnb}\nXRP: $${xrp}` });
        }
        else if (lowerText.includes("constitucion")) {
            await sock.sendMessage(remoteJid, { text: "🇨🇴 *Aura Legal:* El Art. 1 dice que Colombia es un Estado social de derecho. ¿Quieres saber sobre la Ley de Tierras?" });
        }
        else if (lowerText.match(/(ganaderia|maiz)/)) {
            await sock.sendMessage(remoteJid, { text: "🌽🐄 *Aura Agro:* Monitoreando trazabilidad ICA y suelos. ¡Dale con toda, colega!" });
        }
    });

    sock.ev.on("creds.update", saveCreds);
}
connect();
