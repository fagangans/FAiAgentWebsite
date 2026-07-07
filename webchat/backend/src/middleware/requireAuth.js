import { verifyToken } from "../auth/jwt.js";

// Dipakai untuk endpoint yang boleh diakses admin maupun client asal login,
// seperti ganti password sendiri (beda dengan requireAdmin/requireClient yang membatasi role).
export function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token && verifyToken(token);

  if (!payload) return res.status(403).json({ error: "Unauthorized" });

  req.user = payload;
  next();
}

export default requireAuth;
