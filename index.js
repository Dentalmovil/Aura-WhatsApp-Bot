const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium',
        handleSIGINT: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ]
    }
});

// Variables para el Radar de Volatilidad dentalmovilr4
let preciosAnteriores = { bitcoin: 0, ripple: 0, solana: 0 };
const MI_NUMERO = 'tu_numero_aqui@c.us'; // Reemplaza con tu número de WhatsApp

client.on('ready', async () => {
    console.log('🤖 Aura WhatsApp Bot (dentalmovilr4) EN LÍNEA.');
    // Notificación de reinicio exitoso
    client.sendMessage(MI_NUMERO, '🔄 *Aura Trade AI:* Sistema reiniciado y vigilando el mercado.');
});

client.on('message', async msg => {
    const text = msg.body.toLowerCase();
    if (text === 'precio') {
        try {
            const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ripple,solana&vs_currencies=usd');
            const { bitcoin, ripple, solana } = res.data;
            msg.reply(`📊 *Aura Trade AI - dentalmovilr4* \n\n· BTC: $${bitcoin.usd}\n· XRP: $${ripple.usd}\n· SOL: $${solana.usd}`);
        } catch (e) {
            msg.reply('❌ Error al conectar con el mercado.');
        }
    }
});

// Función de auto-arranque si el celular cierra la app
const startBot = () => {
    client.initialize().catch(err => {
        console.log('🔄 Reintentando en 10 segundos...');
        setTimeout(startBot, 10000);
    });
};

client.on('disconnected', () => {
    console.log('⚠️ Desconectado. Reiniciando motor...');
    startBot();
});

startBot();
