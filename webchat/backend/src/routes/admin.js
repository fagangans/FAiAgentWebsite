import { Router } from "express";
import { v4 as uuid } from "uuid";
import crypto from "node:crypto";
import db from "../db/client.js";
import { hashPassword } from "../auth/password.js";
import { verifyToken } from "../auth/jwt.js";

export const adminRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

// Template sistem prompt CS default — pemilik bisnis tinggal mengisi bagian Info Bisnis.
const DEFAULT_SYSTEM_PROMPT = `Kamu adalah customer service dari bisnis ini. Tugasmu membantu pengunjung dengan cepat, ramah, dan jelas.

Cara bicara: gunakan bahasa Indonesia yang santai tapi tetap sopan dan profesional, seperti orang sungguhan bukan robot. Jawab langsung ke inti pertanyaan tanpa basa-basi yang tidak perlu. Kalau pengunjung bertanya soal hal yang kamu tidak tahu, jujur saja dan tawarkan agar mereka menghubungi tim kami secara langsung. Jangan pernah mengarang informasi.

--- Info Bisnis (isi bagian ini) ---
Nama bisnis: [isi nama bisnis kamu]
Produk atau layanan: [isi daftar produk atau layanan beserta harganya]
Jam operasional: [isi jam buka dan tutup]
Kontak: [isi nomor WhatsApp atau cara menghubungi tim]
Lokasi: [isi alamat jika ada toko fisik]
Info tambahan: [isi promo aktif, syarat pembelian, kebijakan pengembalian, dll]`;

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
    systemPrompt || DEFAULT_SYSTEM_PROMPT,
    aiProvider || "ai4chat",
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

// Akun login klien - sengaja dipisah dari /sites supaya hanya admin yang bisa buat/reset/
// hubungkan, klien sendiri tidak punya endpoint untuk mengubah username/password atau
// menghubungkan akun ke situs lain. 1 akun klien bisa pegang banyak situs lewat tabel
// user_sites (many-to-many); endpoint di bawah selalu resolve akun lewat tabel itu,
// bukan lewat kolom users.site_id yang sudah lama (dipertahankan cuma untuk data lama).
adminRouter.get("/sites/:id/account", requireAdmin, (req, res) => {
  const account = db
    .prepare(
      `SELECT u.id, u.username, u.created_at,
              (SELECT COUNT(*) FROM user_sites WHERE user_id = u.id) AS site_count
       FROM users u
       JOIN user_sites us ON us.user_id = u.id
       WHERE us.site_id = ? AND u.role = 'client'`,
    )
    .get(req.params.id);
  res.json(account || null);
});

// Semua akun klien yang ada di sistem - dipakai dropdown "Hubungkan Akun yang Sudah Ada"
// di dashboard admin, supaya tidak perlu ketik manual username (rawan salah ketik).
adminRouter.get("/accounts", requireAdmin, (req, res) => {
  const accounts = db
    .prepare(
      `SELECT u.id, u.username,
              (SELECT COUNT(*) FROM user_sites WHERE user_id = u.id) AS site_count
       FROM users u WHERE u.role = 'client'
       ORDER BY u.username ASC`,
    )
    .all();
  res.json(accounts);
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
  if (usernameTaken) {
    return res.status(409).json({
      error: 'Username sudah dipakai - kalau mau tambahkan situs ini ke akun tersebut, pakai opsi "Hubungkan Akun yang Sudah Ada"',
    });
  }

  const existingLink = db.prepare("SELECT 1 FROM user_sites WHERE site_id = ?").get(site.id);
  if (existingLink) return res.status(409).json({ error: "Website ini sudah punya akun klien" });

  const id = uuid();
  db.prepare(
    "INSERT INTO users (id, username, password_hash, role, site_id) VALUES (?, ?, ?, 'client', ?)",
  ).run(id, username, hashPassword(password), site.id);
  db.prepare("INSERT INTO user_sites (user_id, site_id) VALUES (?, ?)").run(id, site.id);

  console.log(`[admin] Akun klien dibuat: username="${username}" site=${site.id}`);
  res.json({ ok: true, id, username });
});

// Hubungkan situs ini ke akun klien yang SUDAH ADA (dibuat sebelumnya untuk situs lain),
// bukan bikin akun baru - inilah yang bikin 1 akun klien bisa pegang banyak situs.
adminRouter.post("/sites/:id/link-account", requireAdmin, (req, res) => {
  const site = db.prepare("SELECT id FROM sites WHERE id = ?").get(req.params.id);
  if (!site) return res.status(404).json({ error: "Website tidak ditemukan" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Akun klien yang mau dihubungkan wajib dipilih" });

  const account = db.prepare("SELECT id, username FROM users WHERE id = ? AND role = 'client'").get(userId);
  if (!account) return res.status(404).json({ error: "Akun klien tidak ditemukan" });

  const existingLink = db.prepare("SELECT 1 FROM user_sites WHERE site_id = ?").get(site.id);
  if (existingLink) return res.status(409).json({ error: "Website ini sudah punya akun klien" });

  db.prepare("INSERT INTO user_sites (user_id, site_id) VALUES (?, ?)").run(account.id, site.id);

  console.log(`[admin] Akun klien "${account.username}" dihubungkan ke site=${site.id}`);
  res.json({ ok: true, id: account.id, username: account.username });
});

adminRouter.patch("/sites/:id/account", requireAdmin, (req, res) => {
  const account = db
    .prepare(
      `SELECT u.id FROM users u JOIN user_sites us ON us.user_id = u.id
       WHERE us.site_id = ? AND u.role = 'client'`,
    )
    .get(req.params.id);
  if (!account) return res.status(404).json({ error: "Akun klien belum dibuat" });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password baru wajib diisi" });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter` });
  }

  // Reset password berlaku untuk seluruh akun (semua situs yang dipegangnya sekaligus),
  // karena ini memang 1 kredensial login yang sama, bukan password per situs.
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), account.id);
  console.log(`[admin] Password klien direset: site=${req.params.id}`);
  res.json({ ok: true });
});

// Putuskan hubungan akun klien dari situs ini saja - akun itu sendiri baru dihapus total
// kalau ini situs terakhir yang dipegangnya (supaya tidak ada akun "menggantung" tanpa situs).
adminRouter.delete("/sites/:id/account", requireAdmin, (req, res) => {
  const account = db
    .prepare(
      `SELECT u.id FROM users u JOIN user_sites us ON us.user_id = u.id
       WHERE us.site_id = ? AND u.role = 'client'`,
    )
    .get(req.params.id);
  if (!account) return res.json({ ok: true });

  db.prepare("DELETE FROM user_sites WHERE user_id = ? AND site_id = ?").run(account.id, req.params.id);

  const remaining = db.prepare("SELECT COUNT(*) AS c FROM user_sites WHERE user_id = ?").get(account.id).c;
  if (remaining === 0) {
    db.prepare("DELETE FROM users WHERE id = ?").run(account.id);
  }

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
