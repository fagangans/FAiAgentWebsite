import { MockProvider } from "./MockProvider.js";
import { QwenProvider } from "./QwenProvider.js";
import { ClaudeProvider } from "./ClaudeProvider.js";
import { GeminiProvider } from "./GeminiProvider.js";
import { Ai4ChatProvider } from "./Ai4ChatProvider.js";

// Factory: pilih provider berdasarkan kolom ai_provider di tabel sites,
// kecuali USE_MOCK_AI=true (dipakai saat testing internal).
// Default: ai4chat (gratis, tanpa API key). Fallback ke Gemini sudah tertanam
// di dalam Ai4ChatProvider sendiri jika ai4chat tidak merespons.
export function getProvider(providerName) {
  if (process.env.USE_MOCK_AI === "true") return new MockProvider();

  switch (providerName) {
    case "claude":
      return new ClaudeProvider();
    case "qwen":
      return new QwenProvider();
    case "gemini":
      return new GeminiProvider();
    case "ai4chat":
    default:
      return new Ai4ChatProvider();
  }
}
