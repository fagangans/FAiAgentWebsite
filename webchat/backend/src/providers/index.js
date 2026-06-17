import { MockProvider } from "./MockProvider.js";
import { QwenProvider } from "./QwenProvider.js";
import { ClaudeProvider } from "./ClaudeProvider.js";

// Factory: pilih provider berdasarkan kolom ai_provider di tabel sites,
// kecuali USE_MOCK_AI=true (dipakai saat testing internal, Step 6).
export function getProvider(providerName) {
  if (process.env.USE_MOCK_AI === "true") return new MockProvider();

  switch (providerName) {
    case "claude":
      return new ClaudeProvider();
    case "qwen":
    default:
      return new QwenProvider();
  }
}
