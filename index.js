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

// Configuración de Aura Trade AI - dentalmovilr4
const MI_NUMERO = 'tu_numero_aqui@c.us'; // Asegúrate de que tu número esté aquí

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', async () => {
    console.log('🤖 Aura WhatsApp Bot (dentalmovilr4) EN LÍNEA con Radar + Dólar.');
    
    setTimeout(async () => {
        try {
            await client.sendMessage(MI_NUMERO, '✅ *Aura Trade AI:* Radar de Criptos y Dólar iniciado.');
        } catch (e) {
            console.log("El bot está activo (saludo inicial saltado por estabilidad).");
        }
    }, 5000);
});

client.on('message', async msg => {
    const text = msg.body.toLowerCase();
    
    if (text === 'precio') {
        try {
            // Consulta simultánea: Criptos y Dólar
            const [cryptoRes, dolarRes] = await Promise.all([
                axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ripple,solana&vs_currencies=usd'),
                axios.get('https://open.er-api.com/v6/latest/USD')
            ]);
            
            const { bitcoin, ripple, solana } = cryptoRes.data;
            const cop = dolarRes.data.rates.COP;

            msg.reply(
                `📊 *Aura Trade AI - dentalmovilr4*\n\n` +
                `💵 *Dólar:* $${cop.toLocaleString('es-CO')} COP\n` +
                `₿ *BTC:* $${bitcoin.usd} USD\n` +
                `🔹 *XRP:* $${ripple.usd} USD\n` +
                `☀️ *SOL:* $${solana.usd} USD\n\n` +
                `📍 _Datos en tiempo real_`
            );
        } catch (e) {
            msg.reply('❌ Error al conectar con los mercados. Reintenta en un momento.');
        }
    }
});

const startBot = () => {
    client.initialize().catch(err => {
        console.log('🔄 Reintentando conexión en 10 segundos...');
        setTimeout(startBot, 10000);
    });
};

client.on('disconnected', () => {
    startBot();
});

startBot();
