import { Router } from "express";
import db from "../db/client.js";
import { verifyPassword } from "../auth/password.js";
import { signToken } from "../auth/jwt.js";

export const authRouter = Router();

// Login bersama untuk admin & klien - dibedakan lewat kolom role di tabel users.
authRouter.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Username atau password salah" });
  }

  const token = signToken({ userId: user.id, role: user.role, siteId: user.site_id });
  res.json({ token, role: user.role, siteId: user.site_id });
});

export default authRouter;
