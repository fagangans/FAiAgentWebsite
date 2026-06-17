# Webchat - AI Chat Widget Multi-Website

Backend + widget chat AI yang bisa dipasang di banyak website sekaligus.
1 backend menangani banyak klien lewat `widgetKey` per website (data terisolasi per klien).

## Status

- [x] Step 1-3: Scaffold, skema DB (SQLite lokal via `better-sqlite3`), provider abstraction (Qwen/Claude/Mock)
- [x] Step 4-5: Endpoint chat + widget JS
- [x] Step 6: Test internal pakai Mock AI — **11/11 test lolos**
- [x] Export data ke CSV (self-service, klien akses sendiri pakai `exportToken`)
- [ ] Step 7: Sambungkan API key asli (Qwen via OpenRouter / Claude) — **menunggu API key dari Anda**
- [ ] Step 8: Hardening tambahan
- [ ] Step 9: Deploy

## Jalankan lokal

```bash
cd webchat/backend
npm install
cp .env.example .env
# isi ADMIN_TOKEN di .env (bebas, untuk lindungi endpoint admin)
npm start
```

## Menambahkan website klien baru (tanpa ubah kode)

```bash
curl -X POST http://localhost:3001/api/admin/sites \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ISI_ADMIN_TOKEN_DI_ENV" \
  -d '{
    "name": "Toko Si Fulan",
    "domain": "tokofulan.com",
    "systemPrompt": "Anda adalah asisten toko online Si Fulan, bantu jawab soal produk dan pengiriman.",
    "aiProvider": "qwen"
  }'
```

Respon berisi `widgetKey` (dipasang ke widget) dan `exportToken` (dikasih ke klien untuk export data sendiri).

## Pasang widget ke website manapun

Tempel 1 baris ini sebelum `</body>` di website klien (HTML, WordPress, Shopify, dll — bebas platform):

```html
<script
  src="https://YOUR_BACKEND_URL/widget/chat-widget.js"
  data-widget-key="WIDGET_KEY_DARI_LANGKAH_SEBELUMNYA"
  data-api-url="https://YOUR_BACKEND_URL/api/chat"
></script>
```

Setiap website pakai `widgetKey` masing-masing → percakapan dan riwayat antar klien tidak akan tercampur.

## Export data (self-service untuk klien)

Klien bisa download riwayat chat atau rekap pemakaian sendiri, kapan saja, tanpa minta ke Anda — cukup buka link berikut di browser:

```
https://YOUR_BACKEND_URL/api/export?siteId=SITE_ID&token=EXPORT_TOKEN&type=messages
https://YOUR_BACKEND_URL/api/export?siteId=SITE_ID&token=EXPORT_TOKEN&type=usage
```

Tambahkan `&from=2026-06-01&to=2026-06-30` untuk filter rentang tanggal. File CSV yang dihasilkan bisa langsung dibuka di Excel atau di-import ke Google Sheets (File → Import).

## Ganti model AI per klien

Kolom `ai_provider` di tabel `sites` bisa diisi `qwen` (default, murah) atau `claude` (kualitas lebih tinggi). Tidak perlu deploy ulang kode untuk ganti provider per klien.
