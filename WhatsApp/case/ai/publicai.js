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
  name: "Public AI",

  menu: ["Publicai"],
  case: ["publicai"],

  description: "Public AI",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: false,
};

export default async function handler(leni) {
  const {
    command,
    q,
    LenwyText,
    LenwyWait,
  } = leni;

  switch (command) {
    case "publicai":
      {
        if (!q) return LenwyText("Contoh: .Publicai Apa Fungsi JavaScript");

        LenwyWait();

        try {
          const API_URL = `https://api.fromscratch.web.id/v1/api/ai/publicai?query=${encodeURIComponent(q)}`;

          const { data: response } = await axios.get(API_URL, {
            timeout: 15000,
          });

          if (!response || response.status !== 200 || !response.data) {
            return LenwyText("Gagal Mengambil Respon AI");
          }

          const result = response.data.response || "Tidak Ada Hasil";

          await LenwyText(`*[+] Lenwy PublicAI*\n\n${result}`);
        } catch (error) {
          console.error("PublicAI Error:", error);
          return LenwyText("Terjadi Kesalahan Pada Koneksi API");
        }
      }
      break;
  }
}
