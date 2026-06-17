// Test internal end-to-end: DB -> admin register site -> chat endpoint -> mock AI.
// Jalankan: USE_MOCK_AI=true node src/test/run.js (server harus sudah running di PORT yang sama)
import "dotenv/config";

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "test-admin-token";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  // 1. Health check
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  assert(health.status === "ok", "server health check");

  // 2. Daftarkan site baru lewat admin endpoint
  const createRes = await fetch(`${BASE}/api/admin/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ name: "Test Website", domain: "test.example.com" }),
  });
  const created = await createRes.json();
  assert(createRes.ok && created.widgetKey, "registrasi site baru berhasil");
  assert(!!created.exportToken, "exportToken ikut dikembalikan saat registrasi");

  // 3. Kirim chat pertama (harus auto-buat conversation baru)
  const sessionId = "test-session-1";
  const chat1 = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetKey: created.widgetKey, sessionId, message: "Halo, ini tes" }),
  });
  const chat1Data = await chat1.json();
  assert(chat1.ok && chat1Data.reply, "chat pertama mendapat balasan");

  // 4. Kirim chat kedua di sesi yang sama (harus pakai conversation yang sama, ada history)
  const chat2 = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetKey: created.widgetKey, sessionId, message: "Pesan kedua" }),
  });
  assert(chat2.ok, "chat kedua di sesi sama berhasil");

  // 5. widgetKey salah harus ditolak
  const badKey = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetKey: "salah", sessionId, message: "test" }),
  });
  assert(badKey.status === 403, "widgetKey tidak valid ditolak (403)");

  // 6. Tanpa sessionId/message harus ditolak
  const badBody = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetKey: created.widgetKey }),
  });
  assert(badBody.status === 400, "request tanpa sessionId/message ditolak (400)");

  // 7. Admin endpoint tanpa token harus ditolak
  const noAdmin = await fetch(`${BASE}/api/admin/sites`, { method: "GET" });
  assert(noAdmin.status === 403, "admin endpoint tanpa token ditolak (403)");

  // 8. Export messages dengan exportToken yang benar harus berhasil dan berisi CSV
  const exportRes = await fetch(
    `${BASE}/api/export?siteId=${created.id}&token=${created.exportToken}&type=messages`,
  );
  const exportCsv = await exportRes.text();
  assert(exportRes.ok, "export messages berhasil (200)");
  assert(exportCsv.startsWith("session_id,role,content,created_at"), "header CSV messages benar");
  assert(exportCsv.includes("Halo, ini tes") || exportCsv.includes('"Halo, ini tes"'), "isi pesan ada di CSV");

  // 9. Export usage harus berhasil
  const exportUsage = await fetch(
    `${BASE}/api/export?siteId=${created.id}&token=${created.exportToken}&type=usage`,
  );
  const usageCsv = await exportUsage.text();
  assert(exportUsage.ok, "export usage berhasil (200)");
  assert(usageCsv.startsWith("date,total_messages,tokens_in,tokens_out"), "header CSV usage benar");

  // 10. Export token salah harus ditolak
  const badExport = await fetch(`${BASE}/api/export?siteId=${created.id}&token=salah&type=messages`);
  assert(badExport.status === 403, "export dengan token salah ditolak (403)");

  // 11. Export tanpa type harus ditolak
  const noType = await fetch(`${BASE}/api/export?siteId=${created.id}&token=${created.exportToken}`);
  assert(noType.status === 400, "export tanpa type ditolak (400)");

  // 12. Export insights - dengan MockProvider, balasan bukan JSON valid jadi harus 502 (bukan crash)
  // Ini cuma tes struktural; kualitas asli baru bisa dicek pakai AI sungguhan (Qwen/Claude)
  const insightsRes = await fetch(
    `${BASE}/api/export?siteId=${created.id}&token=${created.exportToken}&type=insights`,
  );
  const insightsData = await insightsRes.json();
  assert(insightsRes.status === 502, "insights dengan MockProvider mengembalikan 502 (balasan bukan JSON)");
  assert(!!insightsData.raw, "respon 502 menyertakan balasan mentah AI untuk debugging");

  // 13. Export insights tanpa data sama sekali harus balas array kosong, bukan error
  const emptySite = await fetch(`${BASE}/api/admin/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ name: "Empty Site", domain: "empty.example.com" }),
  });
  const emptySiteData = await emptySite.json();
  const emptyInsights = await fetch(
    `${BASE}/api/export?siteId=${emptySiteData.id}&token=${emptySiteData.exportToken}&type=insights`,
  );
  const emptyInsightsData = await emptyInsights.json();
  assert(emptyInsights.ok, "insights tanpa data sama sekali tidak error (200)");
  assert(Array.isArray(emptyInsightsData.topics) && emptyInsightsData.topics.length === 0, "insights tanpa data balas topics kosong");

  console.log("\nSemua test lolos.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
