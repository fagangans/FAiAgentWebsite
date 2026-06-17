import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/client.js";
import { resolveSite } from "../middleware/resolveSite.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getProvider } from "../providers/index.js";

export const chatRouter = Router();

const MAX_HISTORY = 10; // jumlah pesan terakhir yang dikirim sebagai context

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
    const { reply, tokensIn, tokensOut } = await provider.chat({
      systemPrompt: site.system_prompt,
      history: historyRows,
      message,
    });

    const insertMessage = db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
    );
    insertMessage.run(uuid(), conversation.id, "user", message);
    insertMessage.run(uuid(), conversation.id, "assistant", reply);

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
