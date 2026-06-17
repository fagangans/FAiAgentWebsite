import { AiProvider } from "./AiProvider.js";

// Dipakai untuk testing internal (Step 6) sebelum API key asli terpasang.
// Tidak memanggil API manapun - balasan deterministik supaya alur DB/endpoint/widget bisa dites dulu.
export class MockProvider extends AiProvider {
  async chat({ message }) {
    return {
      reply: `[MOCK] Anda bertanya: "${message}". Ini balasan simulasi, belum terhubung ke AI asli.`,
      tokensIn: message.length,
      tokensOut: 20,
    };
  }
}

export default MockProvider;
