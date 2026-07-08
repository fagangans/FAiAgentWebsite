import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import { hashPassword } from "../auth/password.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/webchat.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

// Migrasi kolom baru untuk database lama yang sudah ada (dibuat sebelum fitur ini ditambahkan).
// CREATE TABLE IF NOT EXISTS di schema.sql tidak menambah kolom ke tabel yang sudah ada,
// jadi kolom baru perlu di-ALTER manual di sini - aman dijalankan berkali-kali.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("sites", "widget_color", "TEXT DEFAULT '#c9a84c'");
ensureColumn("sites", "widget_position", "TEXT DEFAULT 'bottom-right'");
ensureColumn("sites", "widget_offset_x", "INTEGER DEFAULT 20");
ensureColumn("sites", "widget_offset_y", "INTEGER DEFAULT 20");
ensureColumn("sites", "widget_greeting", "TEXT DEFAULT 'Halo! Ada yang bisa saya bantu?'");
ensureColumn("sites", "widget_title", "TEXT DEFAULT 'Chat dengan kami'");
ensureColumn("sites", "widget_bg_color", "TEXT DEFAULT '#0a0a0a'");
ensureColumn("messages", "is_important", "INTEGER DEFAULT 0");

// Nilai widget_position lama cuma 'left'/'right' (dianggap selalu di bawah) - konversi
// ke format pojok baru supaya tampilan widget yang sudah dipasang klien tidak berubah.
db.exec(`UPDATE sites SET widget_position = 'bottom-right' WHERE widget_position = 'right'`);
db.exec(`UPDATE sites SET widget_position = 'bottom-left' WHERE widget_position = 'left'`);

// Backfill user_sites dari kolom site_id lama, supaya akun klien yang sudah ada
// (dibuat sebelum 1 akun bisa pegang banyak website) tidak kehilangan akses ke
// situs mereka. Aman dijalankan berkali-kali (INSERT OR IGNORE + primary key).
db.exec(`
  INSERT OR IGNORE INTO user_sites (user_id, site_id)
  SELECT id, site_id FROM users WHERE role = 'client' AND site_id IS NOT NULL
`);

// Buat akun admin otomatis saat pertama kali jalan, dari ADMIN_USERNAME/ADMIN_PASSWORD
// di .env (fallback ke ADMIN_TOKEN supaya deployment yang sudah ada tidak perlu langkah tambahan).
function seedAdmin() {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (existing) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN;
  if (!password) return;

  db.prepare(
    "INSERT INTO users (id, username, password_hash, role, site_id) VALUES (?, ?, ?, 'admin', NULL)",
  ).run(uuid(), username, hashPassword(password));
  console.log(`[db] Akun admin "${username}" dibuat otomatis.`);
}

seedAdmin();

export default db;
