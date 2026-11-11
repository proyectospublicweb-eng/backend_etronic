// Punto de entrada CommonJS requerido por Phusion Passenger ("Setup Node.js App" en cPanel).
// Carga de forma asíncrona el servidor ESM (index.js) con soporte para top-level await.
import("./index.js").catch((error) => {
  console.error("Error crítico al iniciar Backend Etronic en cPanel:", error);
  process.exit(1);
});
