-- Public project suggestions ("Let your voice be heard").
-- Every new suggestion starts as 'pending'. Only 'approved' ones are shown
-- on the public page. ip_hash is a scrambled code (never the real address),
-- used only to slow down spam from one connection.
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT 'Anonymous',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status
  ON suggestions (status, id DESC);

CREATE INDEX IF NOT EXISTS idx_suggestions_ip
  ON suggestions (ip_hash, created_at);
