-- 1) Members must choose their own password after an account is created or
--    reset by the superadmin. Existing accounts are not affected (0).
ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

-- 2) Failed login attempts (used for the temporary lockout). Old rows are
--    deleted automatically. ip_hash is a scrambled code, never the real address.
CREATE TABLE IF NOT EXISTS login_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_failures_user
  ON login_failures (username, created_at);
CREATE INDEX IF NOT EXISTS idx_login_failures_ip
  ON login_failures (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_login_failures_time
  ON login_failures (created_at);

-- 3) View and download counts for each document.
ALTER TABLE documents ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;

-- One row per visitor, document, kind and day. It makes sure the same person
-- opening the same document again on the same day is counted only once.
CREATE TABLE IF NOT EXISTS document_hits (
  document_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('view', 'download')),
  visitor_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (document_id, kind, visitor_hash, day)
) WITHOUT ROWID;
