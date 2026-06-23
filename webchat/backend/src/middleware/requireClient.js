import { verifyToken } from "../auth/jwt.js";

// Setiap request dashboard klien wajib bawa JWT dengan role 'client' -> dibatasi
// otomatis ke site_id miliknya sendiri, tidak bisa lihat data klien lain.
export function requireClient(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token && verifyToken(token);

  if (!payload || payload.role !== "client" || !payload.siteId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  req.clientSiteId = payload.siteId;
  next();
}

export default requireClient;
