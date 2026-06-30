import { Router } from "express";
import { v4 as uuid } from "uuid";
import crypto from "node:crypto";
import db from "../db/client.js";
import { hashPassword } from "../auth/password.js";
import { verifyToken } from "../auth/jwt.js";

export const adminRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

// Perbandingan timing-safe untuk ADMIN_TOKEN supaya tidak bisa di-timing-attack (A07).
function adminTokenValid(provided) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !provided || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

// Dilindungi ADMIN_TOKEN (cara lama, dipakai script/curl) ATAU JWT role admin (dashboard baru).
function requireAdmin(req, res, next) {
  if (adminTokenValid(req.headers["x-admin-token"])) return next();

  const authHeader = req.headers["authorization"] || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = bearer && verifyToken(bearer);
  if (payload?.role === "admin") return next();

  return res.status(403).json({ error: "Unauthorized" });
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
    .prepare(
      `SELECT id, name, domain, widget_key, system_prompt, ai_provider, widget_color, widget_position,
              widget_greeting, is_active, created_at
       FROM sites WHERE id = ?`,
    )
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

// Akun login klien - sengaja dipisah dari /sites supaya hanya admin yang bisa buat/reset,
// klien sendiri tidak punya endpoint untuk mengubah username/password-nya.
adminRouter.get("/sites/:id/account", requireAdmin, (req, res) => {
  const account = db
    .prepare("SELECT id, username, created_at FROM users WHERE site_id = ? AND role = 'client'")
    .get(req.params.id);
  res.json(account || null);
});

adminRouter.post("/sites/:id/account", requireAdmin, (req, res) => {
  const site = db.prepare("SELECT id FROM sites WHERE id = ?").get(req.params.id);
  if (!site) return res.status(404).json({ error: "Website tidak ditemukan" });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username dan password wajib diisi" });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter` });
  }

  const usernameTaken = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (usernameTaken) return res.status(409).json({ error: "Username sudah dipakai" });

  const existingAccount = db
    .prepare("SELECT id FROM users WHERE site_id = ? AND role = 'client'")
    .get(site.id);
  if (existingAccount) return res.status(409).json({ error: "Website ini sudah punya akun klien" });

  const id = uuid();
  db.prepare(
    "INSERT INTO users (id, username, password_hash, role, site_id) VALUES (?, ?, ?, 'client', ?)",
  ).run(id, username, hashPassword(password), site.id);

  console.log(`[admin] Akun klien dibuat: username="${username}" site=${site.id}`);
  res.json({ ok: true, id, username });
});

adminRouter.patch("/sites/:id/account", requireAdmin, (req, res) => {
  const account = db
    .prepare("SELECT id FROM users WHERE site_id = ? AND role = 'client'")
    .get(req.params.id);
  if (!account) return res.status(404).json({ error: "Akun klien belum dibuat" });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password baru wajib diisi" });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter` });
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), account.id);
  console.log(`[admin] Password klien direset: site=${req.params.id}`);
  res.json({ ok: true });
});

adminRouter.delete("/sites/:id/account", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM users WHERE site_id = ? AND role = 'client'").run(req.params.id);
  res.json({ ok: true });
});

// Pemakaian token AI per website + total agregat - admin saja, tanpa estimasi biaya
// karena tarif per model tidak ditrack di sistem ini (lebih baik tampil apa adanya
// daripada tampilkan angka biaya yang bisa salah).
adminRouter.get("/usage", requireAdmin, (req, res) => {
  const sites = db
    .prepare(
      `SELECT s.id, s.name, COALESCE(SUM(u.tokens_in), 0) AS tokens_in, COALESCE(SUM(u.tokens_out), 0) AS tokens_out
       FROM sites s
       LEFT JOIN usage_log u ON u.site_id = s.id
       GROUP BY s.id
       ORDER BY s.name ASC`,
    )
    .all();

  const total = sites.reduce(
    (acc, s) => ({ tokens_in: acc.tokens_in + s.tokens_in, tokens_out: acc.tokens_out + s.tokens_out }),
    { tokens_in: 0, tokens_out: 0 },
  );

  res.json({ sites, total });
});

export default adminRouter;
