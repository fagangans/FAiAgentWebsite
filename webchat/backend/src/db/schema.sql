-- Skema database untuk webchat multi-tenant
-- Kompatibel SQLite (default lokal) maupun Postgres/Supabase (lihat catatan tipe data)

CREATE TABLE IF NOT EXISTS sites (
  id              TEXT PRIMARY KEY,        -- site_id, dipakai widget untuk identifikasi klien
  name            TEXT NOT NULL,
  domain          TEXT,
  widget_key      TEXT NOT NULL UNIQUE,    -- key publik yang ditempel di widget (bukan secret)
  export_token    TEXT NOT NULL UNIQUE,    -- token rahasia untuk klien akses export data sendiri
  system_prompt   TEXT DEFAULT 'Kamu adalah customer service dari bisnis ini.',
  ai_provider     TEXT DEFAULT 'ai4chat',  -- 'ai4chat' | 'gemini' | 'qwen' | 'claude'
  widget_color    TEXT DEFAULT '#c9a84c',  -- warna gelembung & header widget, diatur klien sendiri
  widget_position TEXT DEFAULT 'right',    -- 'right' | 'left'
  widget_greeting TEXT DEFAULT 'Halo! Ada yang bisa saya bantu?',
  widget_title    TEXT DEFAULT 'Chat dengan kami', -- judul di header panel chat, diatur klien sendiri
  widget_bg_color TEXT DEFAULT '#0a0a0a',  -- warna latar panel chat, diatur klien sendiri
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY,
  site_id         TEXT NOT NULL REFERENCES sites(id),
  session_id      TEXT NOT NULL,           -- id sesi dari browser pengunjung (uuid di localStorage)
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL,           -- 'user' | 'assistant'
  content         TEXT NOT NULL,
  is_important    INTEGER DEFAULT 0,       -- ditandai otomatis untuk CRM (ada kontak/minat beli/komplain)
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Akun login dashboard. role 'admin' = pemilik sistem (akses semua website).
-- role 'client' = pemilik website - bisa pegang lebih dari 1 website lewat tabel
-- user_sites di bawah. Kolom site_id di sini sudah tidak dipakai untuk otorisasi
-- (dipertahankan cuma untuk kompatibilitas data lama), akses sesungguhnya selalu
-- dicek lewat user_sites.
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL,
  site_id         TEXT REFERENCES sites(id),
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Penghubung akun klien <-> website, many-to-many: 1 akun klien bisa pegang banyak
-- website, dan (secara desain) 1 website cuma dihubungkan ke 1 akun klien - tapi
-- struktur tabel ini tidak memaksakan itu di level DB, validasinya di kode admin.js.
CREATE TABLE IF NOT EXISTS user_sites (
  user_id         TEXT NOT NULL REFERENCES users(id),
  site_id         TEXT NOT NULL REFERENCES sites(id),
  PRIMARY KEY (user_id, site_id)
);

CREATE TABLE IF NOT EXISTS usage_log (
  id              TEXT PRIMARY KEY,
  site_id         TEXT NOT NULL REFERENCES sites(id),
  tokens_in       INTEGER DEFAULT 0,
  tokens_out      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Lead CRM: dibuat otomatis saat ada pesan penting di suatu percakapan.
-- Satu percakapan maksimal punya satu lead (kontak/status digabung di sini).
CREATE TABLE IF NOT EXISTS leads (
  id              TEXT PRIMARY KEY,
  site_id         TEXT NOT NULL REFERENCES sites(id),
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id),
  contact_phone   TEXT,
  contact_email   TEXT,
  status          TEXT NOT NULL DEFAULT 'baru', -- 'baru' | 'dihubungi' | 'selesai'
  notes           TEXT,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_site ON conversations(site_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_site ON usage_log(site_id);
CREATE INDEX IF NOT EXISTS idx_users_site ON users(site_id);
CREATE INDEX IF NOT EXISTS idx_leads_site ON leads(site_id);
CREATE INDEX IF NOT EXISTS idx_user_sites_site ON user_sites(site_id);
