import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";
import { adminRouter } from "./routes/admin.js";
import { exportRouter } from "./routes/export.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors()); // widget dipasang di domain berbeda-beda, jadi CORS dibuka untuk endpoint publik
app.use(express.json({ limit: "100kb" }));
app.use("/widget", express.static(path.join(__dirname, "../../widget")));
app.use("/admin", express.static(path.join(__dirname, "../../admin")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", chatRouter);
app.use("/api/admin", adminRouter);
app.use("/api", exportRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Webchat backend jalan di http://localhost:${PORT}`);
});

export default app;
