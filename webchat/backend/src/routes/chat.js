import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/client.js";
import { resolveSite } from "../middleware/resolveSite.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getProvider } from "../providers/index.js";
import { isImportant, extractContact } from "../utils/important.js";

export const chatRouter = Router();

const MAX_HISTORY = 10; // jumlah pesan terakhir yang dikirim sebagai context

// Dipaksakan ke semua provider supaya balasan terasa seperti manusia asli,
// bukan robot kaku, dan widget (yang render teks polos, bukan markdown) tidak
// menampilkan simbol "**" / "*" / "#" mentah-mentah ke pengunjung.
const STYLE_GUIDE = `Gaya bicara wajib: balas seperti orang Indonesia asli yang ramah dan profesional, bukan seperti robot. Jawaban singkat, padat, langsung ke inti - jangan bertele-tele. Tulis dalam kalimat atau paragraf biasa, seperti chat WhatsApp dengan pelanggan. Jangan pernah pakai format markdown (bintang **, underscore __, pagar #, bullet dengan - atau *, penomoran 1. 2. 3., tanda kutip balik \`, atau blockquote >). Jangan pakai emoji. Jangan pakai tanda baca berlebihan seperti !!! atau ???. Jangan pakai tanda kutip miring/lengkung atau tanda pisah panjang (—), pakai tanda baca biasa saja. Jangan pernah bungkus seluruh jawabanmu dengan tanda kutip di awal dan akhir. Kalau jawabanmu panjang, pecah jadi beberapa paragraf pendek (2-3 kalimat per paragraf) dengan baris kosong di antaranya, supaya enak dibaca.`;

// Lapis kedua di kode (bukan cuma andalkan AI patuh instruksi) - AI provider mana pun
// (ai4chat, Gemini, dst) kadang tetap selip format markdown/simbol aneh walau sudah
// dilarang di system prompt, jadi hasilnya dibersihkan paksa sebelum dikirim ke pengunjung.
function stripMarkdown(text) {
  return text
    // artefak escape mentah (\" \' \n \t) yang kadang ikut kebawa dari respons AI yang
    // sebenarnya berformat JSON - ini karakter backslash+huruf literal di dalam teks,
    // bukan escape sungguhan, jadi harus dibersihkan duluan sebelum aturan lain jalan.
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    // code block & inline code
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim())
    .replace(/`([^`]*)`/g, "$1")
    // link [teks](url) -> teks saja
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // bold/italic/underline, urutan dari yang paling panjang
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/___(.*?)___/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // heading
    .replace(/^#{1,6}\s+/gm, "")
    // blockquote
    .replace(/^>\s?/gm, "")
    // garis pemisah horizontal
    .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "")
    // bullet & penomoran list
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    // tanda kutip & tanda pisah "pintar" -> versi biasa
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    // emoji & simbol dekoratif (bintang, centang, panah, dingbat, dll)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    // karakter kontrol/zero-width dari copy-paste atau encoding rusak
    .replace(/[\u200b-\u200d\ufeff\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    // tanda baca berlebihan
    .replace(/([!?])\1{2,}/g, "$1$1")
    // rapikan spasi & baris kosong berlebih
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// AI kadang membungkus seluruh jawaban dengan tanda kutip (kebiasaan model tertentu),
// padahal itu bukan kutipan sungguhan - buang kalau kutip pembuka/penutup itu memang
// membungkus keseluruhan teks, bukan cuma sebagian kalimat.
function stripWrappingQuotes(text) {
  const t = text.trim();
  if (t.length > 1 && t[0] === '"' && t[t.length - 1] === '"') {
    return t.slice(1, -1).trim();
  }
  return t;
}

// Lapis ketiga: paksa jawaban panjang terpecah jadi paragraf pendek (target ~160 karakter
// per paragraf) supaya nyaman dibaca di widget, tidak menumpuk jadi satu blok teks raksasa -
// tidak bergantung pada AI mengikuti instruksi baris kosong di STYLE_GUIDE.
function formatParagraphs(text) {
  if (text.length <= 160 || text.includes("\n\n")) return text;

  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) || [text];
  const paragraphs = [];
  let current = "";

  sentences.forEach((s) => {
    if (current && current.length + s.length > 160) {
      paragraphs.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  });
  if (current.trim()) paragraphs.push(current.trim());

  return paragraphs.join("\n\n");
}

// Bikin/lengkapi lead CRM otomatis saat ada pesan penting - satu lead per percakapan,
// kontak yang sudah terisi tidak ditimpa kalau pesan berikutnya tidak membawa kontak baru.
function upsertLead(siteId, conversationId, message) {
  const { phone, email } = extractContact(message);
  const existing = db
    .prepare("SELECT id, contact_phone, contact_email FROM leads WHERE conversation_id = ?")
    .get(conversationId);

  if (existing) {
    const newPhone = existing.contact_phone || phone;
    const newEmail = existing.contact_email || email;
    if (newPhone !== existing.contact_phone || newEmail !== existing.contact_email) {
      db.prepare(
        "UPDATE leads SET contact_phone = ?, contact_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(newPhone, newEmail, existing.id);
    }
    return;
  }

  db.prepare(
    "INSERT INTO leads (id, site_id, conversation_id, contact_phone, contact_email, status) VALUES (?, ?, ?, ?, ?, 'baru')",
  ).run(uuid(), siteId, conversationId, phone, email);
}

// Dipanggil widget saat dimuat di website klien, untuk ambil warna/posisi/sapaan
// yang diatur klien di dashboard-nya. Publik (sama seperti widgetKey, bukan secret).
chatRouter.get("/widget-config", (req, res) => {
  const widgetKey = req.query.widgetKey;
  if (!widgetKey) return res.status(400).json({ error: "widgetKey wajib dikirim" });

  const site = db
    .prepare(
      `SELECT widget_color, widget_position, widget_offset_x, widget_offset_y, widget_greeting,
              widget_title, widget_bg_color
       FROM sites WHERE widget_key = ? AND is_active = 1`,
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
    const reply = formatParagraphs(stripWrappingQuotes(stripMarkdown(rawReply)));

    const important = isImportant(message);
    const insertMessage = db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, is_important) VALUES (?, ?, ?, ?, ?)",
    );
    insertMessage.run(uuid(), conversation.id, "user", message, important ? 1 : 0);
    insertMessage.run(uuid(), conversation.id, "assistant", reply, 0);

    if (important) {
      upsertLead(site.id, conversation.id, message);
    }

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
