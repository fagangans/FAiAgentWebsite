import fetch from "node-fetch";
import { AiProvider } from "./AiProvider.js";

// Opsional, untuk klien yang butuh kualitas lebih tinggi. Butuh ANTHROPIC_API_KEY di .env.
export class ClaudeProvider extends AiProvider {
  constructor() {
    super();
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = "claude-haiku-4-5-20251001";
  }

  async chat({ systemPrompt, history, message }) {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY belum diset di .env");
    }

    const messages = [...history, { role: "user", content: message }];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text?.trim();
    if (!reply) throw new Error("Claude API: respon kosong");

    return {
      reply,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
    };
  }
}

export default ClaudeProvider;
