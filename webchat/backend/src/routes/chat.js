import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/client.js";
import { resolveSite } from "../middleware/resolveSite.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getProvider } from "../providers/index.js";
import { isImportant } from "../utils/important.js";

export const chatRouter = Router();

const MAX_HISTORY = 10; // jumlah pesan terakhir yang dikirim sebagai context

// Dipaksakan ke semua provider supaya balasan terasa seperti manusia asli,
// bukan robot kaku, dan widget (yang render teks polos, bukan markdown) tidak
// menampilkan simbol "**" / "*" / "#" mentah-mentah ke pengunjung.
const STYLE_GUIDE = `Gaya bicara wajib: balas seperti orang Indonesia asli yang ramah dan profesional, bukan seperti robot. Jawaban singkat, padat, langsung ke inti - jangan bertele-tele. Jangan pernah pakai format markdown (tanda bintang **, underscore __, pagar #, atau bullet list dengan - atau *). Tulis dalam kalimat/paragraf biasa saja.`;

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .trim();
}

// Dipanggil widget saat dimuat di website klien, untuk ambil warna/posisi/sapaan
// yang diatur klien di dashboard-nya. Publik (sama seperti widgetKey, bukan secret).
chatRouter.get("/widget-config", (req, res) => {
  const widgetKey = req.query.widgetKey;
  if (!widgetKey) return res.status(400).json({ error: "widgetKey wajib dikirim" });

  const site = db
    .prepare(
      "SELECT widget_color, widget_position, widget_greeting FROM sites WHERE widget_key = ? AND is_active = 1",
    )
    .get(widgetKey);

  if (!site) return res.status(404).json({ error: "widgetKey tidak valid atau nonaktif" });
  res.json(site);
});

chatRouter.post("/chat", resolveSite, rateLimit, async (req, res) => {
  const { sessionId, message } = req.body;
  const site = req.site;

  if (!sessionId || !message?.trim()) {
    return res.status(400).json({ error: "sessionId dan message wajib diisi" });
  }

  try {
    let conversation = db
      .prepare("SELECT * FROM conversations WHERE site_id = ? AND session_id = ?")
      .get(site.id, sessionId);

    if (!conversation) {
      const id = uuid();
      db.prepare(
        "INSERT INTO conversations (id, site_id, session_id) VALUES (?, ?, ?)",
      ).run(id, site.id, sessionId);
      conversation = { id, site_id: site.id, session_id: sessionId };
    }

    const historyRows = db
      .prepare(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(conversation.id, MAX_HISTORY)
      .reverse();

    const provider = getProvider(site.ai_provider);
    const { reply: rawReply, tokensIn, tokensOut } = await provider.chat({
      systemPrompt: `${site.system_prompt}\n\n${STYLE_GUIDE}`,
      history: historyRows,
      message,
    });
    const reply = stripMarkdown(rawReply);

    const insertMessage = db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, is_important) VALUES (?, ?, ?, ?, ?)",
    );
    insertMessage.run(uuid(), conversation.id, "user", message, isImportant(message) ? 1 : 0);
    insertMessage.run(uuid(), conversation.id, "assistant", reply, 0);

    db.prepare(
      "INSERT INTO usage_log (id, site_id, tokens_in, tokens_out) VALUES (?, ?, ?, ?)",
    ).run(uuid(), site.id, tokensIn, tokensOut);

    res.json({ reply });
  } catch (err) {
    console.error(`[chat] site=${site.id} error:`, err.message);
    res.status(500).json({ error: "Terjadi kesalahan di server, coba lagi" });
  }
});

export default chatRouter;
