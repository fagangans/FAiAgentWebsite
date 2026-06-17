import db from "../db/client.js";

// Setiap request widget wajib bawa widget_key -> dipetakan ke site_id.
// Ini yang membuat 1 backend bisa dipasang di banyak website tanpa bocor data antar klien.
export function resolveSite(req, res, next) {
  const widgetKey = req.body?.widgetKey || req.headers["x-widget-key"];

  if (!widgetKey) {
    return res.status(400).json({ error: "widgetKey wajib dikirim" });
  }

  const site = db
    .prepare("SELECT * FROM sites WHERE widget_key = ? AND is_active = 1")
    .get(widgetKey);

  if (!site) {
    return res.status(403).json({ error: "widgetKey tidak valid atau nonaktif" });
  }

  req.site = site;
  next();
}

export default resolveSite;
