// Rate limit sederhana per site_id, in-memory (cukup untuk single-instance deployment).
const hits = new Map(); // site_id -> [timestamps]

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30; // 30 pesan/menit/site, sesuaikan saat produksi

export function rateLimit(req, res, next) {
  const siteId = req.site.id;
  const now = Date.now();

  const timestamps = (hits.get(siteId) || []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(siteId, timestamps);

  if (timestamps.length > MAX_PER_WINDOW) {
    return res.status(429).json({ error: "Terlalu banyak permintaan, coba lagi sebentar" });
  }

  next();
}

export default rateLimit;
