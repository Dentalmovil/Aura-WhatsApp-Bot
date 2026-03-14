module.exports = {
  apps : [{
    name: "aura-bot",
    script: "./index.js",
    watch: false, // Cambia a true si quieres que reinicie al detectar cambios en archivos
    max_memory_restart: '300M', // Se reinicia si consume mucha RAM (típico en Baileys)
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}
