import { Router } from "express";
import db from "../db/client.js";
import { requireClient, requireClientAny } from "../middleware/requireClient.js";

export const clientRouter = Router();

const ALLOWED_COLORS = /^#[0-9a-fA-F]{6}$/;
const LEAD_STATUSES = ["baru", "dihubungi", "selesai"];
const DAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const WIDGET_CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
const MAX_WIDGET_OFFSET = 300; // px - batas wajar supaya widget tidak bisa digeser keluar layar

// Daftar situs yang bisa diakses akun ini - dipakai dashboard untuk isi dropdown
// pemilih situs. Tidak butuh header X-Site-Id karena ini justru yang menentukannya.
clientRouter.get("/sites", requireClientAny, (req, res) => {
  const sites = db
    .prepare(
      `SELECT s.id, s.name FROM sites s
       JOIN user_sites us ON us.site_id = s.id
       WHERE us.user_id = ?
       ORDER BY s.name ASC`,
    )
    .all(req.clientUserId);
  res.json(sites);
});

clientRouter.get("/me", requireClient, (req, res) => {
  const site = db
    .prepare(
      `SELECT id, name, system_prompt, ai_provider, widget_color, widget_position, widget_offset_x,
              widget_offset_y, widget_greeting, widget_title, widget_bg_color
       FROM sites WHERE id = ?`,
    )
    .get(req.clientSiteId);

  if (!site) return res.status(404).json({ error: "Website tidak ditemukan" });
  res.json(site);
});

clientRouter.patch("/me", requireClient, (req, res) => {
  const {
    systemPrompt, widgetColor, widgetPosition, widgetOffsetX, widgetOffsetY,
    widgetGreeting, widgetTitle, widgetBgColor,
  } = req.body;
  const fields = [];
  const values = [];

  if (systemPrompt !== undefined) { fields.push("system_prompt = ?"); values.push(systemPrompt); }
  if (widgetColor !== undefined) {
    if (!ALLOWED_COLORS.test(widgetColor)) {
      return res.status(400).json({ error: "Format warna harus hex, contoh #ff5722" });
    }
    fields.push("widget_color = ?");
    values.push(widgetColor);
  }
  if (widgetPosition !== undefined) {
    if (!WIDGET_CORNERS.includes(widgetPosition)) {
      return res.status(400).json({ error: "widgetPosition harus salah satu dari: " + WIDGET_CORNERS.join(", ") });
    }
    fields.push("widget_position = ?");
    values.push(widgetPosition);
  }
  if (widgetOffsetX !== undefined) {
    const x = Number(widgetOffsetX);
    if (!Number.isInteger(x) || x < 0 || x > MAX_WIDGET_OFFSET) {
      return res.status(400).json({ error: `widgetOffsetX harus angka 0-${MAX_WIDGET_OFFSET}` });
    }
    fields.push("widget_offset_x = ?");
    values.push(x);
  }
  if (widgetOffsetY !== undefined) {
    const y = Number(widgetOffsetY);
    if (!Number.isInteger(y) || y < 0 || y > MAX_WIDGET_OFFSET) {
      return res.status(400).json({ error: `widgetOffsetY harus angka 0-${MAX_WIDGET_OFFSET}` });
    }
    fields.push("widget_offset_y = ?");
    values.push(y);
  }
  if (widgetGreeting !== undefined) { fields.push("widget_greeting = ?"); values.push(widgetGreeting); }
  if (widgetTitle !== undefined) {
    if (!widgetTitle.trim() || widgetTitle.length > 60) {
      return res.status(400).json({ error: "Judul widget wajib diisi, maksimal 60 karakter" });
    }
    fields.push("widget_title = ?");
    values.push(widgetTitle.trim());
  }
  if (widgetBgColor !== undefined) {
    if (!ALLOWED_COLORS.test(widgetBgColor)) {
      return res.status(400).json({ error: "Format warna latar harus hex, contoh #0a0a0a" });
    }
    fields.push("widget_bg_color = ?");
    values.push(widgetBgColor);
  }

  if (!fields.length) return res.status(400).json({ error: "Tidak ada field yang diubah" });

  db.prepare(`UPDATE sites SET ${fields.join(", ")} WHERE id = ?`).run(...values, req.clientSiteId);
  res.json({ ok: true });
});

clientRouter.get("/conversations", requireClient, (req, res) => {
  const conversations = db
    .prepare(
      `SELECT c.id, c.session_id, c.created_at,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_important = 1) AS important_count
       FROM conversations c
       WHERE c.site_id = ?
       ORDER BY c.created_at DESC`,
    )
    .all(req.clientSiteId);

  res.json(conversations);
});

clientRouter.get("/conversations/:id/messages", requireClient, (req, res) => {
  const conversation = db
    .prepare("SELECT id FROM conversations WHERE id = ? AND site_id = ?")
    .get(req.params.id, req.clientSiteId);

  if (!conversation) return res.status(404).json({ error: "Percakapan tidak ditemukan" });

  const messages = db
    .prepare(
      "SELECT role, content, is_important, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    )
    .all(conversation.id);

  res.json(messages);
});

// CRM: daftar lead, otomatis dibuat saat ada pesan penting (lihat upsertLead di routes/chat.js).
clientRouter.get("/leads", requireClient, (req, res) => {
  const { status } = req.query;

  let query = `SELECT l.id, l.conversation_id, l.contact_phone, l.contact_email, l.status, l.notes,
      l.created_at, l.updated_at,
      (SELECT content FROM messages m WHERE m.conversation_id = l.conversation_id ORDER BY m.created_at DESC LIMIT 1) AS last_message
    FROM leads l WHERE l.site_id = ?`;
  const params = [req.clientSiteId];

  if (status !== undefined) {
    if (!LEAD_STATUSES.includes(status)) {
      return res.status(400).json({ error: "status tidak valid" });
    }
    query += " AND l.status = ?";
    params.push(status);
  }

  query += " ORDER BY l.updated_at DESC";
  res.json(db.prepare(query).all(...params));
});

clientRouter.patch("/leads/:id", requireClient, (req, res) => {
  const lead = db.prepare("SELECT id FROM leads WHERE id = ? AND site_id = ?").get(req.params.id, req.clientSiteId);
  if (!lead) return res.status(404).json({ error: "Lead tidak ditemukan" });

  const { status, notes } = req.body;
  const fields = [];
  const values = [];

  if (status !== undefined) {
    if (!LEAD_STATUSES.includes(status)) {
      return res.status(400).json({ error: "status harus 'baru', 'dihubungi', atau 'selesai'" });
    }
    fields.push("status = ?");
    values.push(status);
  }
  if (notes !== undefined) { fields.push("notes = ?"); values.push(notes); }

  if (!fields.length) return res.status(400).json({ error: "Tidak ada field yang diubah" });
  fields.push("updated_at = CURRENT_TIMESTAMP");

  db.prepare(`UPDATE leads SET ${fields.join(", ")} WHERE id = ?`).run(...values, req.params.id);
  res.json({ ok: true });
});

// Statistik untuk dashboard klien: volume percakapan/pesan 14 hari terakhir + jam/hari tersibuk.
// Semua waktu digeser +7 jam (WIB) supaya pengelompokan tanggal/jam sesuai jam Indonesia,
// bukan UTC mentah dari CURRENT_TIMESTAMP di SQLite.
clientRouter.get("/analytics", requireClient, (req, res) => {
  const siteId = req.clientSiteId;

  const dailyRows = db
    .prepare(
      `SELECT date(datetime(m.created_at, '+7 hours')) AS day,
              COUNT(*) AS message_count,
              COUNT(DISTINCT m.conversation_id) AS conversation_count
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.site_id = ? AND m.created_at >= datetime('now', '-14 days')
       GROUP BY day`,
    )
    .all(siteId);

  const hourRows = db
    .prepare(
      `SELECT CAST(strftime('%H', datetime(m.created_at, '+7 hours')) AS INTEGER) AS hour, COUNT(*) AS count
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.site_id = ?
       GROUP BY hour`,
    )
    .all(siteId);

  const dowRows = db
    .prepare(
      `SELECT CAST(strftime('%w', datetime(m.created_at, '+7 hours')) AS INTEGER) AS dow, COUNT(*) AS count
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.site_id = ?
       GROUP BY dow`,
    )
    .all(siteId);

  const dailyMap = new Map(dailyRows.map((r) => [r.day, r]));
  const dailyVolume = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() + 7 * 60 * 60 * 1000 - i * 86400000).toISOString().slice(0, 10);
    const row = dailyMap.get(day);
    dailyVolume.push({
      day,
      messageCount: row?.message_count || 0,
      conversationCount: row?.conversation_count || 0,
    });
  }

  const hourMap = new Map(hourRows.map((r) => [r.hour, r.count]));
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap.get(h) || 0 }));

  const dowMap = new Map(dowRows.map((r) => [r.dow, r.count]));
  const days = DAY_LABELS.map((label, i) => ({ day: label, count: dowMap.get(i) || 0 }));

  res.json({ dailyVolume, hours, days });
});

export default clientRouter;
