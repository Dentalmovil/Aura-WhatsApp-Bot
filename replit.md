# Aura WhatsApp Bot

A WhatsApp bot that provides real-time cryptocurrency prices, agricultural guidance, and reminder functionality, built by Dentalmovilr4.

## Tech Stack

- **Runtime:** Node.js >= 20
- **Package Manager:** npm
- **WhatsApp Library:** @whiskeysockets/baileys
- **HTTP Client:** axios
- **Logging:** pino
- **Environment:** dotenv
- **Process Manager (prod):** PM2

## Project Structure

- `index.js` — Main bot logic (WhatsApp connection, message handling, reminders, crypto price fetching)
- `server.js` — Simple HTTP server serving the landing page on port 5000
- `index.html` — Landing page (Tailwind CSS via CDN)
- `ecosystem.config.js` — PM2 configuration for production
- `recordatorios.json` — Auto-generated local JSON DB for reminders
- `auth_session/` — Auto-generated WhatsApp authentication session files

## Features

1. **Crypto Monitor** — Responds to WhatsApp messages asking for ETH/BTC prices via CoinGecko API
2. **Reminders** — Users can set reminders via WhatsApp (e.g., "recordar en 10 min llamar a casa")
3. **Agro Support** — Responds to keywords about cattle/maize with agricultural info
4. **Telegram Integration** — Sends status updates to a configured Telegram chat
5. **Landing Page** — Promotional page accessible via web browser

## Environment Variables

- `TELEGRAM_TOKEN` — Telegram bot token for status notifications
- `TELEGRAM_CHAT_ID` — Telegram chat ID to send notifications to
- `PORT` — Internal uptime monitor port (defaults to 8081)

## Development

```bash
npm install
npm run dev   # Runs node index.js directly
```

The landing page server (`server.js`) runs on port 5000 (host 0.0.0.0).
The bot's internal uptime server uses port 8081 by default.

## Deployment

Configured as a VM deployment (always-running) since the WhatsApp bot requires persistent state.
Run command: `node server.js`
