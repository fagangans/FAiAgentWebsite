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

import axios from "axios";

export const info = {
  name: "WebPilot AI",

  menu: ["Webpilot"],
  case: ["wp", "webpilot"],

  description: "AI Web Search menggunakan WebPilot",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

export default async function handler(lenwy) {
  const { command, q, LenwyText, LenwyWait } = lenwy;

  switch (command) {
    case "wp":
    case "webpilot":
      {
        if (!q) return LenwyText("☘️ *Contoh:* webpilot Apa Itu Sc Bot Lenwy");

        LenwyWait();

        try {
          const encodedQuery = encodeURIComponent(q);
          const API_URL = `https://api.fromscratch.web.id/v1/api/ai/webpilot/details?query=${encodedQuery}`;

          const { data: response } = await axios.get(API_URL);

          if (response.status !== 200) {
            return LenwyText(
              `❌ Gagal mengambil data WebPilot.\nPesan: ${
                response.message || "Terjadi kesalahan API."
              }`,
            );
          }

          const result = response.data;

          let reply = `🌐 *Lenwy WebPilot (AI Search)*\n\n`;
          reply += `${result.response}`;

          await LenwyText(reply);
        } catch (error) {
          console.error("WebPilot Error:", error);
          LenwyText(globalThis.mess.error);
        }
      }
      break;
  }
}
