CREATE TABLE IF NOT EXISTS medical_terms (id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_ko TEXT, category TEXT NOT NULL, code TEXT, system TEXT, definition TEXT, source TEXT NOT NULL, source_url TEXT, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_medical_terms_name_en ON medical_terms(name_en);
CREATE INDEX IF NOT EXISTS idx_medical_terms_category ON medical_terms(category);
CREATE TABLE IF NOT EXISTS medical_search_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS medical_sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, query TEXT NOT NULL, result_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, detail TEXT, synced_at TEXT NOT NULL);
