import { Router } from "express";
import db from "../db/client.js";
import { requireClient } from "../middleware/requireClient.js";

export const clientRouter = Router();

const ALLOWED_COLORS = /^#[0-9a-fA-F]{6}$/;

clientRouter.get("/me", requireClient, (req, res) => {
  const site = db
    .prepare(
      `SELECT id, name, system_prompt, ai_provider, widget_color, widget_position, widget_greeting
       FROM sites WHERE id = ?`,
    )
    .get(req.clientSiteId);

  if (!site) return res.status(404).json({ error: "Website tidak ditemukan" });
  res.json(site);
});

clientRouter.patch("/me", requireClient, (req, res) => {
  const { systemPrompt, widgetColor, widgetPosition, widgetGreeting } = req.body;
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
    if (!["left", "right"].includes(widgetPosition)) {
      return res.status(400).json({ error: "widgetPosition harus 'left' atau 'right'" });
    }
    fields.push("widget_position = ?");
    values.push(widgetPosition);
  }
  if (widgetGreeting !== undefined) { fields.push("widget_greeting = ?"); values.push(widgetGreeting); }

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

export default clientRouter;
