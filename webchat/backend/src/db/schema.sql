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

-- Akun login dashboard. role 'admin' = pemilik sistem (akses semua website),
-- role 'client' = pemilik 1 website (site_id wajib diisi, hanya lihat data sendiri).
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL,
  site_id         TEXT REFERENCES sites(id),
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
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
