// Punto de entrada CommonJS requerido por Phusion Passenger ("Setup Node.js App" en cPanel).
// Carga explícitamente el archivo .env ubicado junto a loader.cjs antes de importar ESM,
// sin depender de cuál sea process.cwd() en Passenger.
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

import("./index.js").catch((error) => {
  console.error("Error crítico al iniciar Backend Etronic en cPanel:", error);
  process.exit(1);
});
