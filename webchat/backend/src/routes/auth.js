import { Router } from "express";
import db from "../db/client.js";
import { verifyPassword, hashPassword } from "../auth/password.js";
import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

// Rate limit login per IP: max 10 percobaan per 15 menit (A07).
const loginHits = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_PER_WINDOW = 10;

function loginRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const hits = (loginHits.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  hits.push(now);
  loginHits.set(ip, hits);
  if (hits.length > MAX_LOGIN_PER_WINDOW) {
    console.warn(`[auth] Rate limit login terlampaui dari IP ${ip}`);
    return res.status(429).json({ error: "Terlalu banyak percobaan login, coba lagi nanti" });
  }
  next();
}

// Login bersama untuk admin & klien - dibedakan lewat kolom role di tabel users.
authRouter.post("/login", loginRateLimit, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    // Log gagal login untuk monitoring (A09) — tanpa tampilkan detail ke klien.
    console.warn(`[auth] Login gagal: username="${username}" ip=${req.ip}`);
    return res.status(401).json({ error: "Username atau password salah" });
  }

  const token = signToken({ userId: user.id, role: user.role, siteId: user.site_id });
  res.json({ token, role: user.role, siteId: user.site_id });
});

// Profil akun yang sedang login (admin maupun client) - dipakai dashboard unified
// untuk menampilkan username & role tanpa perlu decode JWT di sisi frontend.
authRouter.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, username, role, site_id FROM users WHERE id = ?")
    .get(req.user.userId);
  if (!user) return res.status(404).json({ error: "Akun tidak ditemukan" });
  res.json(user);
});

// Ganti password sendiri - berlaku untuk admin maupun client, wajib verifikasi
// password lama dulu (beda dengan reset password klien oleh admin di admin.js).
authRouter.patch("/me/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Password lama dan password baru wajib diisi" });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter` });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.userId);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Password lama salah" });
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), user.id);
  res.json({ ok: true });
});

export default authRouter;
