import { Router } from "express";
import db from "../db/client.js";

export const exportRouter = Router();

// Diakses klien sendiri pakai exportToken miliknya (bukan ADMIN_TOKEN) -> self-service,
// klien bisa download data kapan saja tanpa minta ke pemilik sistem setiap bulan.
function resolveSiteByExportToken(req, res, next) {
  const { siteId, token } = req.query;

  if (!siteId || !token) {
    return res.status(400).json({ error: "siteId dan token wajib diisi" });
  }

  const site = db
    .prepare("SELECT * FROM sites WHERE id = ? AND export_token = ?")
    .get(siteId, token);

  if (!site) {
    return res.status(403).json({ error: "siteId atau token tidak valid" });
  }

  req.site = site;
  next();
}

function toCsv(rows, columns) {
  const escape = (val) => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c])).join(","));
  return [header, ...lines].join("\n");
}

function inDateRange(req) {
  const { from, to } = req.query;
  let clause = "";
  const params = [];
  if (from) {
    clause += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    clause += " AND created_at <= ?";
    params.push(`${to} 23:59:59`);
  }
  return { clause, params };
}

exportRouter.get("/export", resolveSiteByExportToken, (req, res) => {
  const { type } = req.query;
  const site = req.site;
  const { clause, params } = inDateRange(req);

  if (type === "messages") {
    const rows = db
      .prepare(
        `SELECT c.session_id, m.role, m.content, m.created_at
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.site_id = ? ${clause.replace(/created_at/g, "m.created_at")}
         ORDER BY m.created_at ASC`,
      )
      .all(site.id, ...params);

    const csv = toCsv(rows, ["session_id", "role", "content", "created_at"]);
    res.header("Content-Type", "text/csv");
    res.attachment(`${site.name}-messages.csv`);
    return res.send(csv);
  }

  if (type === "usage") {
    const rows = db
      .prepare(
        `SELECT date(created_at) AS date,
                COUNT(*) AS total_messages,
                SUM(tokens_in) AS tokens_in,
                SUM(tokens_out) AS tokens_out
         FROM usage_log
         WHERE site_id = ? ${clause}
         GROUP BY date(created_at)
         ORDER BY date ASC`,
      )
      .all(site.id, ...params);

    const csv = toCsv(rows, ["date", "total_messages", "tokens_in", "tokens_out"]);
    res.header("Content-Type", "text/csv");
    res.attachment(`${site.name}-usage.csv`);
    return res.send(csv);
  }

  res.status(400).json({ error: "type wajib 'messages' atau 'usage'" });
});

export default exportRouter;
