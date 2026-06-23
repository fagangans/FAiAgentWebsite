// Deteksi sederhana untuk CRM: tandai pesan pengunjung yang kemungkinan butuh
// perhatian klien (ada kontak, minat beli, atau komplain), tanpa perlu panggil AI lagi.
const PATTERNS = [
  /\b(08|\+?62)[\d\- ]{8,13}\b/, // nomor HP
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // email
  /\b(pesan|order|harga|beli|booking|reservasi|komplain|keluhan|tertarik|minat)\b/i,
];

export function isImportant(text) {
  return PATTERNS.some((pattern) => pattern.test(text));
}

export default isImportant;
