import { Router } from "express";
import db from "../db/client.js";
import { verifyPassword } from "../auth/password.js";
import { signToken } from "../auth/jwt.js";

export const authRouter = Router();

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

export default authRouter;
