// Deteksi sederhana untuk CRM: tandai pesan pengunjung yang kemungkinan butuh
// perhatian klien (ada kontak, minat beli, atau komplain), tanpa perlu panggil AI lagi.
const PHONE_PATTERN = /\b(08|\+?62)[\d\- ]{8,13}\b/;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const KEYWORD_PATTERN = /\b(pesan|order|harga|beli|booking|reservasi|komplain|keluhan|tertarik|minat)\b/i;

const PATTERNS = [PHONE_PATTERN, EMAIL_PATTERN, KEYWORD_PATTERN];

export function isImportant(text) {
  return PATTERNS.some((pattern) => pattern.test(text));
}

// Ambil nomor HP/email dari pesan kalau ada, dipakai untuk isi data kontak lead CRM otomatis.
export function extractContact(text) {
  const phoneMatch = text.match(PHONE_PATTERN);
  const emailMatch = text.match(EMAIL_PATTERN);
  return {
    phone: phoneMatch ? phoneMatch[0].trim() : null,
    email: emailMatch ? emailMatch[0] : null,
  };
}

export default isImportant;
