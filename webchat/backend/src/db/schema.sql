-- Skema database untuk webchat multi-tenant
-- Kompatibel SQLite (default lokal) maupun Postgres/Supabase (lihat catatan tipe data)

CREATE TABLE IF NOT EXISTS sites (
  id              TEXT PRIMARY KEY,        -- site_id, dipakai widget untuk identifikasi klien
  name            TEXT NOT NULL,
  domain          TEXT,
  widget_key      TEXT NOT NULL UNIQUE,    -- key publik yang ditempel di widget (bukan secret)
  system_prompt   TEXT DEFAULT 'Anda adalah asisten yang membantu.',
  ai_provider     TEXT DEFAULT 'qwen',     -- 'qwen' | 'claude' - per-klien bisa beda
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
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_log (
  id              TEXT PRIMARY KEY,
  site_id         TEXT NOT NULL REFERENCES sites(id),
  tokens_in       INTEGER DEFAULT 0,
  tokens_out      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_site ON conversations(site_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_site ON usage_log(site_id);
