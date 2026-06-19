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
  name: "Public AI",

  menu: ["Publicai"],
  case: ["publicai"],

  description: "Public AI (Gemini)",
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
    case "publicai":
      {
        if (!q) return LenwyText("☘️ *Contoh:* .publicai Apa Fungsi JavaScript");

        LenwyWait();

        try {
          const reply = await GeminiChat(q, senderJid);

          if (!reply) return LenwyText("⚠️ AI Tidak Merespon.");

          await LenwyText(`*[+] Gemini AI*\n\n${reply}`);
        } catch (error) {
          console.error("PublicAI Error:", error.message);
          return LenwyText(globalThis.mess.error);
        }
      }
      break;
  }
}
