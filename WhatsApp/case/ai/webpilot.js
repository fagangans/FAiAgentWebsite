/*  

  Made By Lenwy
  Base : Lenwy
  WhatsApp : wa.me/6283829814737
  Telegram : t.me/ilenwy
  Youtube : @Lenwy

  Channel : https://whatsapp.com/channel/0029VaGdzBSGZNCmoTgN2K0u

  Copy Code?, Recode?, Rename?, Reupload?, Reseller? Taruh Credit Ya :D

  Mohon Untuk Tidak Menghapus Watermark Di Dalam Kode Ini

*/

import { GeminiChat } from "../../scrape/GeminiChat.js";

export const info = {
  name: "WebPilot AI",

  menu: ["Webpilot"],
  case: ["wp", "webpilot"],

  description: "AI Chat menggunakan Gemini",
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
    case "wp":
    case "webpilot":
      {
        if (!q) return LenwyText("☘️ *Contoh:* .webpilot Apa itu AI?");

        LenwyWait();

        try {
          const reply = await GeminiChat(q, senderJid);

          if (!reply) return LenwyText("⚠️ AI Tidak Merespon.");

          await LenwyText(`🌐 *Gemini AI*\n\n${reply}`);
        } catch (error) {
          console.error("WebPilot Error:", error.message);
          LenwyText(globalThis.mess.error);
        }
      }
      break;
  }
}
