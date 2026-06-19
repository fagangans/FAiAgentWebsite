# Webchat - AI Chat Widget Multi-Website

Backend + widget chat AI yang bisa dipasang di banyak website sekaligus.
1 backend menangani banyak klien lewat `widgetKey` per website (data terisolasi per klien).

## Status

- [x] Step 1-3: Scaffold, skema DB (SQLite lokal via `better-sqlite3`), provider abstraction (Gemini/Qwen/Claude/Mock)
- [x] Step 4-5: Endpoint chat + widget JS
- [x] Step 6: Test internal pakai Mock AI — **11/11 test lolos**
- [x] Export data ke CSV (self-service, klien akses sendiri pakai `exportToken`)
- [x] Insight AI: rekap topik pertanyaan paling sering ditanyakan (FAQ otomatis)
- [x] Step 7: Sambungkan API key asli — **Gemini terpasang dan teruji end-to-end (chat + insight) pakai API key sungguhan**
- [x] Step 8: Hardening tambahan (rate limit, error handling, security headers via Nginx)
- [x] Step 9: Deploy — **skrip setup VPS, PM2, Nginx, SSL, backup DB siap pakai**

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
    "aiProvider": "gemini"
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

## Insight AI - rekap pertanyaan paling sering (FAQ otomatis)

Selain CSV, ada endpoint yang minta AI mengelompokkan dan merangking pertanyaan pengunjung dalam periode tertentu - jadi klien bisa tahu "apa yang paling sering ditanyakan bulan ini" tanpa baca satu-satu:

```
https://YOUR_BACKEND_URL/api/export?siteId=SITE_ID&token=EXPORT_TOKEN&type=insights&from=2026-06-01&to=2026-06-30
```

Responnya JSON, bukan CSV:

```json
{ "topics": [{ "topic": "Tanya ongkos kirim", "count": 34 }, { "topic": "Tanya stok produk", "count": 21 }], "totalQuestions": 120 }
```

Fitur ini memanggil AI provider yang sama dengan chat (`ai_provider` milik site tersebut). Sudah diuji end-to-end pakai Gemini sungguhan: 8 pertanyaan acak berhasil dikelompokkan AI jadi 4 topik (ongkir, stok, COD, pembayaran) dengan count yang benar. Kalau masih pakai `USE_MOCK_AI=true`, endpoint ini akan balas error 502 karena balasan mock bukan format JSON yang valid (ini sengaja, bukan bug).

## Ganti model AI per klien

Kolom `ai_provider` di tabel `sites` bisa diisi:

| Provider | Kapan dipakai |
|----------|---------------|
| `gemini` (default) | Model Google AI Studio, paling hemat token, dipakai untuk website Anda sendiri |
| `qwen` | Via OpenRouter, alternatif murah |
| `claude` | Kualitas tertinggi, biaya lebih mahal |

Tidak perlu deploy ulang kode untuk ganti provider per klien — cukup ubah kolom `ai_provider` saat registrasi atau lewat update langsung ke tabel `sites`.

## Provider Gemini - setup & biaya

Default model: **`gemini-2.5-flash-lite`** (model paling hemat token yang masih stabil/GA per Juni 2026 — `gemini-2.0-flash-lite` sudah di-deprecate Google per 1 Juni 2026, jadi sengaja tidak dipakai). Bisa dioverride lewat env `GEMINI_MODEL` kalau butuh kualitas lebih tinggi.

Dapatkan API key gratis di [Google AI Studio](https://aistudio.google.com/apikey), isi `GEMINI_API_KEY` di `.env`.

Perbandingan biaya per 1 juta token (harga tier berbayar; ada tier gratis harian untuk testing/trafik kecil sebelum kena biaya ini):

| Model | Input / 1M token | Output / 1M token | Catatan |
|-------|-------------------|---------------------|---------|
| **`gemini-2.5-flash-lite`** (default) | $0.10 | $0.40 | Paling hemat, cocok untuk chat customer support volume tinggi |
| `gemini-2.5-flash` | $0.30 | $2.50 | Lebih pintar, ~3x lebih mahal di input, ~6x di output |
| `gemini-2.5-pro` / `gemini-3.1-pro` | jauh lebih mahal | jauh lebih mahal | hanya untuk kasus yang butuh reasoning berat |

Biaya aktual per percakapan sangat kecil — 1 balasan chat singkat biasanya hanya puluhan-ratusan token, jadi 1 juta token bisa untuk ribuan percakapan.

## Deploy ke VPS

Semua file deploy ada di `webchat/deploy/`. Tinggal jalankan satu skrip untuk setup VPS baru:

```bash
# Di VPS (Ubuntu/Debian), jalankan sebagai root:
chmod +x webchat/deploy/setup-vps.sh
sudo ./webchat/deploy/setup-vps.sh
```

Skrip ini akan install Node.js 22, PM2, Nginx, Certbot, dan SQLite3. Setelah selesai, ikuti instruksi yang ditampilkan di layar.

### Ringkasan langkah setelah setup-vps.sh:

1. `git clone` repo, `npm install --production`
2. Buat `.env` (copy dari `.env.example`, isi `GEMINI_API_KEY` dan `ADMIN_TOKEN`)
3. `pm2 start ecosystem.config.cjs` lalu `pm2 save && pm2 startup`
4. Copy `deploy/nginx-webchat.conf` ke `/etc/nginx/sites-available/`, ganti domain, reload Nginx
5. `certbot --nginx -d api.DOMAIN_ANDA.com` untuk SSL gratis
6. Setup backup DB: `crontab -e` → `0 3 * * * /path/to/deploy/backup-db.sh`

### File deploy yang tersedia:

| File | Fungsi |
|------|--------|
| `deploy/setup-vps.sh` | Install semua dependensi sistem di VPS baru |
| `deploy/nginx-webchat.conf` | Konfigurasi Nginx reverse proxy + security headers |
| `deploy/backup-db.sh` | Backup SQLite harian, simpan 30 hari, hapus yang lama |
| `backend/ecosystem.config.cjs` | Konfigurasi PM2: auto-restart, memory limit, logging |
