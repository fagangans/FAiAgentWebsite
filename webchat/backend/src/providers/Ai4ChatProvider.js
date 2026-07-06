import fetch from "node-fetch";
import { AiProvider } from "./AiProvider.js";
import { GeminiProvider } from "./GeminiProvider.js";

// ai4chat: layanan AI gratis, tidak butuh API key.
// Karena API-nya hanya menerima satu teks tunggal (tidak mendukung system prompt
// atau history terpisah), kita susun semuanya menjadi satu prompt terstruktur.
// Jika ai4chat gagal (timeout, error, respons kosong), otomatis fallback ke Gemini.

const AI4CHAT_URL =
  "https://yw85opafq6.execute-api.us-east-1.amazonaws.com/default/boss_mode_15aug";
const TIMEOUT_MS = 15000;

export class Ai4ChatProvider extends AiProvider {
  buildPrompt({ systemPrompt, history, message }) {
    const parts = [];

    if (systemPrompt?.trim()) {
      parts.push(systemPrompt.trim());
      parts.push("");
    }

    if (history.length > 0) {
      parts.push("Riwayat percakapan sebelumnya:");
      history.forEach((h) => {
        const label = h.role === "user" ? "Pengunjung" : "CS";
        parts.push(`${label}: ${h.content}`);
      });
      parts.push("");
    }

    parts.push(`Pengunjung: ${message}`);
    parts.push("CS:");

    return parts.join("\n");
  }

  async chat(input) {
    const prompt = this.buildPrompt(input);

    try {
      const url = new URL(AI4CHAT_URL);
      url.search = new URLSearchParams({
        text: prompt,
        country: "Asia",
        user_id: "webchat_cs",
      }).toString();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let res;
      try {
        res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 11; Infinix)",
            Referer: "https://www.ai4chat.co/pages/riddle-generator",
          },
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const reply = (await res.text()).trim();
      if (!reply) throw new Error("Respons kosong");

      // ai4chat tidak melaporkan token usage — estimasi dari panjang teks
      return {
        reply,
        tokensIn: Math.ceil(prompt.length / 4),
        tokensOut: Math.ceil(reply.length / 4),
      };
    } catch (err) {
      // Fallback otomatis ke Gemini jika ai4chat tidak merespons
      console.warn(`[ai4chat] Gagal (${err.message}), beralih ke Gemini`);
      return new GeminiProvider().chat(input);
    }
  }
}

export default Ai4ChatProvider;
