import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { chatRouter } from "./routes/chat.js";
import { adminRouter } from "./routes/admin.js";
import { exportRouter } from "./routes/export.js";
import { authRouter } from "./routes/auth.js";
import { clientRouter } from "./routes/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fail fast — tanpa JWT_SECRET yang kuat, semua token bisa dipalsukan.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("[FATAL] JWT_SECRET di .env wajib diset dan minimal 32 karakter. Jalankan: openssl rand -hex 32");
  process.exit(1);
}

const app = express();

// Trust X-Forwarded-For dari Nginx supaya req.ip adalah IP klien asli, bukan 127.0.0.1.
app.set("trust proxy", 1);

// Security headers (A05) — CSP dinonaktifkan karena admin/client pages pakai inline scripts.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: "100kb" }));
app.use("/widget", express.static(path.join(__dirname, "../../widget")));
app.use("/admin", express.static(path.join(__dirname, "../../admin")));
app.use("/client", express.static(path.join(__dirname, "../../client")));
// Dashboard unified: satu pintu login di root domain, menu menyesuaikan role (admin/client).
app.use("/", express.static(path.join(__dirname, "../../dashboard")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

// CORS hanya untuk 2 endpoint widget yang dipasang di domain pihak ketiga (A05).
// Admin, client, login, export tidak perlu CORS — dashboard diakses dari origin yang sama.
const widgetCors = cors();
app.use("/api/widget-config", widgetCors);
app.use("/api/chat", widgetCors);

app.use("/api", chatRouter);
app.use("/api/admin", adminRouter);
app.use("/api/client", clientRouter);
app.use("/api", exportRouter);
app.use("/api", authRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Webchat backend jalan di http://localhost:${PORT}`);
});

export default app;
