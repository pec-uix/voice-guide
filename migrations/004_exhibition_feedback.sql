CREATE TABLE IF NOT EXISTS exhibition_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  language_code TEXT NOT NULL DEFAULT 'zh-TW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exhibition_feedback_exid ON exhibition_feedback(exhibition_id);
