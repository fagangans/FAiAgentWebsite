/*

  Gemini AI - Google AI Studio
  Menggunakan API key resmi dari Google (bukan endpoint scraping).
  Fitur: memory percakapan per user, isolasi antar user.

*/

import { GeminiChat, clearHistory } from "../../scrape/GeminiChat.js";

export const info = {
  name: "Gemini AI",

  menu: ["Gemini"],
  case: ["gemini", "cleargemini"],

  description: "AI Chat menggunakan Google Gemini (memory percakapan)",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

export default async function handler(leni) {
  const { command, q, LenwyText, LenwyWait, senderJid } = leni;

  switch (command) {
    case "gemini":
      {
        if (!q) return LenwyText("☘️ *Contoh:* .gemini Apa itu JavaScript?");

        LenwyWait();

        try {
          const reply = await GeminiChat(q, senderJid);

          if (!reply) return LenwyText("⚠️ AI Tidak Merespon.");

          await LenwyText(`*Gemini AI*\n\n${reply}`);
        } catch (error) {
          console.error("Gemini Error:", error.message);
          LenwyText(globalThis.mess.error);
        }
      }
      break;

    case "cleargemini":
      {
        clearHistory(senderJid);
        await LenwyText("🗑️ Riwayat percakapan Gemini kamu sudah direset.");
      }
      break;
  }
}
