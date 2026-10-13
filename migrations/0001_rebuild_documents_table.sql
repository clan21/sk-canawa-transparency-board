DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT NOT NULL,
  category          TEXT NOT NULL
                    CHECK (category IN ('budget','expenses','projects','accomplishments')),
  description       TEXT NOT NULL DEFAULT '',
  publication_date  TEXT NOT NULL,              -- YYYY-MM-DD
  file_key          TEXT NOT NULL UNIQUE,       -- random name in R2
  original_filename TEXT NOT NULL,              -- what the admin uploaded
  mime_type         TEXT NOT NULL
                    CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  file_size         INTEGER NOT NULL,           -- bytes
  uploaded_by       INTEGER NOT NULL REFERENCES admins(id),
  updated_by        INTEGER REFERENCES admins(id),
  is_published      INTEGER NOT NULL DEFAULT 1, -- 0 = hidden draft
  is_deleted        INTEGER NOT NULL DEFAULT 0, -- soft delete
  deleted_at        TEXT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_public
  ON documents (is_deleted, is_published, publication_date DESC);
CREATE INDEX idx_documents_category ON documents (category);