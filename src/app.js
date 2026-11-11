import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

const app = express();

app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: (origin, callback) => {
      const isLocalDevOrigin =
        isDev && /^http:\/\/localhost:\d+$/.test(origin || "");
      if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin) {
        callback(null, true);
      } else {
        console.warn("Origen no permitido por CORS:", origin);
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Proceso API Etronic Iniciado");
});

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use("/apietronic/", authRoutes);
app.use("/apietronic/chat", chatRoutes);
app.use("/apietronic/admin", adminRoutes);

export default app;
