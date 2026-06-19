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

import Ai4Chat from "../../scrape/Ai4Chat.js";

export const info = {
  name: "AI4Chat",

  menu: ["AI"],
  case: ["ai"],

  description: "Tanyakan Apa Saja!",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: false,
};

export default async function handler(lenwy) {
  const { command, q, LenwyText, LenwyWait } = lenwy;

  switch (command) {
    case "ai":
      {
        if (!q) return LenwyText("☘️ *Contoh:* ai Apa itu JavaScript?");

        LenwyWait();

        try {
          const lenai = await Ai4Chat(q);

          if (!lenai) return LenwyText("⚠️ AI Tidak Merespon.");

          await LenwyText(`*Lenwy AI*\n\n${lenai}`);
        } catch (error) {
          console.error("Error AI:", error);
          LenwyText(globalThis.mess.error);
        }
      }
      break;
  }
}
