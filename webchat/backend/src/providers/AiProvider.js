// Kontrak yang harus dipenuhi setiap provider AI.
// Setiap provider baru (Qwen, Claude, dst) wajib punya method ini.
export class AiProvider {
  /**
   * @param {{systemPrompt: string, history: {role: string, content: string}[], message: string}} input
   * @returns {Promise<{reply: string, tokensIn: number, tokensOut: number}>}
   */
  async chat(input) {
    throw new Error("chat() belum diimplementasikan");
  }
}
