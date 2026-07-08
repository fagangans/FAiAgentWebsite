import { verifyToken } from "../auth/jwt.js";
import db from "../db/client.js";

// Dipakai untuk endpoint yang cuma butuh pastikan akun klien valid (JWT role
// 'client'), tanpa perlu tahu sedang mengelola situs yang mana - contoh: daftar
// situs yang bisa diakses akun ini (untuk dropdown pemilih situs di dashboard).
export function requireClientAny(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token && verifyToken(token);

  if (!payload || payload.role !== "client") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  req.clientUserId = payload.userId;
  next();
}

// Setiap request dashboard klien yang menyangkut data 1 situs wajib bawa JWT
// role 'client' + header X-Site-Id, lalu dicek kepemilikannya lewat user_sites -
// 1 akun klien bisa pegang beberapa situs, jadi site_id tidak lagi ditanamkan di
// JWT (bisa berubah kapan saja tanpa perlu re-login), melainkan dipilih di
// dashboard (dropdown pemilih situs) dan dikirim eksplisit tiap request.
export function requireClient(req, res, next) {
  requireClientAny(req, res, () => {
    const siteId = req.headers["x-site-id"];
    if (!siteId) return res.status(400).json({ error: "Header X-Site-Id wajib dikirim" });

    const membership = db
      .prepare("SELECT 1 FROM user_sites WHERE user_id = ? AND site_id = ?")
      .get(req.clientUserId, siteId);
    if (!membership) return res.status(403).json({ error: "Anda tidak punya akses ke situs ini" });

    req.clientSiteId = siteId;
    next();
  });
}

export default requireClient;
