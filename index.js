// Servidor principal Etronic API (/apietronic)
import "dotenv/config";
import app from "./src/app.js";
import { ensureDatabaseAndAdmin } from "./src/libs/adminBootstrap.js";

const PORT = process.env.PORT || 3000;

await ensureDatabaseAndAdmin();

app.listen(PORT, () => {
  console.log("Servidor en puerto :::>>", PORT);
});
