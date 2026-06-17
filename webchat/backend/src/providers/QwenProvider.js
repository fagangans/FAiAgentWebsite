import fetch from "node-fetch";
import { AiProvider } from "./AiProvider.js";

// Qwen 3.5 Flash via OpenRouter. Butuh OPENROUTER_API_KEY di .env (Step 7).
export class QwenProvider extends AiProvider {
  constructor() {
    super();
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = "qwen/qwen3.5-flash-02-23";
  }

  async chat({ systemPrompt, history, message }) {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY belum diset di .env");
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, messages }),
    });

    if (!res.ok) {
      throw new Error(`Qwen API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Qwen API: respon kosong");

    return {
      reply,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
    };
  }
}

export default QwenProvider;
