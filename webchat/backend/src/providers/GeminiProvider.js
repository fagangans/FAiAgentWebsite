import fetch from "node-fetch";
import { AiProvider } from "./AiProvider.js";

// Gemini API resmi dari Google AI Studio. Default ke model paling hemat token
// (2.5 Flash-Lite). Butuh GEMINI_API_KEY di .env; model bisa dioverride lewat GEMINI_MODEL.
export class GeminiProvider extends AiProvider {
  constructor() {
    super();
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  }

  async chat({ systemPrompt, history, message }) {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY belum diset di .env");
    }

    // Gemini pakai role "model" untuk balasan AI, bukan "assistant" seperti di DB kita.
    const contents = [
      ...history.map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) throw new Error("Gemini API: respon kosong");

    return {
      reply,
      tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}

export default GeminiProvider;
