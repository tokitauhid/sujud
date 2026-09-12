CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY NOT NULL,
  translated_text TEXT NOT NULL,
  arabic_text TEXT,
  collection TEXT NOT NULL,
  reference TEXT NOT NULL,
  grading TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'community-review' CHECK (status IN ('community-review', 'needs-moderation', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  relevant INTEGER NOT NULL CHECK (relevant IN (0, 1)),
  tags_json TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (candidate_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviews_candidate ON reviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_reports_candidate ON reports(candidate_id);
