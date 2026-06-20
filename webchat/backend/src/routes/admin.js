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
  const exportToken = uuid();

  db.prepare(
    `INSERT INTO sites (id, name, domain, widget_key, export_token, system_prompt, ai_provider)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    name,
    domain || null,
    widgetKey,
    exportToken,
    systemPrompt || "Anda adalah asisten yang membantu.",
    aiProvider || "gemini",
  );

  res.json({ id, widgetKey, exportToken });
});

adminRouter.get("/sites", requireAdmin, (req, res) => {
  const sites = db
    .prepare("SELECT id, name, domain, widget_key, ai_provider, is_active, created_at FROM sites ORDER BY created_at DESC")
    .all();
  res.json(sites);
});

adminRouter.get("/sites/:id", requireAdmin, (req, res) => {
  const site = db
    .prepare("SELECT id, name, domain, widget_key, system_prompt, ai_provider, is_active, created_at FROM sites WHERE id = ?")
    .get(req.params.id);
  if (!site) return res.status(404).json({ error: "Website tidak ditemukan" });
  res.json(site);
});

adminRouter.patch("/sites/:id", requireAdmin, (req, res) => {
  const site = db.prepare("SELECT id FROM sites WHERE id = ?").get(req.params.id);
  if (!site) return res.status(404).json({ error: "Website tidak ditemukan" });

  const { name, domain, systemPrompt, aiProvider, isActive } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (domain !== undefined) { fields.push("domain = ?"); values.push(domain || null); }
  if (systemPrompt !== undefined) { fields.push("system_prompt = ?"); values.push(systemPrompt); }
  if (aiProvider !== undefined) { fields.push("ai_provider = ?"); values.push(aiProvider); }
  if (isActive !== undefined) { fields.push("is_active = ?"); values.push(isActive ? 1 : 0); }

  if (!fields.length) return res.status(400).json({ error: "Tidak ada field yang diubah" });

  db.prepare(`UPDATE sites SET ${fields.join(", ")} WHERE id = ?`).run(...values, req.params.id);

  res.json({ ok: true });
});

export default adminRouter;
