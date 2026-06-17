import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/client.js";

export const adminRouter = Router();

// Dilindungi ADMIN_TOKEN (Step 8 akan diperkuat). Dipakai untuk mendaftarkan website klien baru
// tanpa perlu ubah kode - inilah yang membuat backend ini bisa dipakai sebagai template multi-website.
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

adminRouter.post("/sites", requireAdmin, (req, res) => {
  const { name, domain, systemPrompt, aiProvider } = req.body;
  if (!name) return res.status(400).json({ error: "name wajib diisi" });

  const id = uuid();
  const widgetKey = uuid();

  db.prepare(
    `INSERT INTO sites (id, name, domain, widget_key, system_prompt, ai_provider)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    name,
    domain || null,
    widgetKey,
    systemPrompt || "Anda adalah asisten yang membantu.",
    aiProvider || "qwen",
  );

  res.json({ id, widgetKey });
});

adminRouter.get("/sites", requireAdmin, (req, res) => {
  const sites = db.prepare("SELECT id, name, domain, ai_provider, is_active, created_at FROM sites").all();
  res.json(sites);
});

export default adminRouter;
