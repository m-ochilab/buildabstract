CREATE TABLE completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  initial_run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  final_run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  rubric_version TEXT NOT NULL,
  initial_snapshot_json TEXT NOT NULL,
  final_snapshot_json TEXT NOT NULL,
  analytics_consent INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(draft_id, final_run_id)
);

CREATE INDEX completions_user_created_idx ON completions(user_id, created_at);
CREATE INDEX completions_draft_created_idx ON completions(draft_id, created_at);

CREATE TABLE section_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('input', 'adopted')),
  candidate_id TEXT,
  text_snapshot TEXT NOT NULL,
  score REAL NOT NULL,
  feedback TEXT,
  grade_json TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  analytics_consent INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX section_scores_user_created_idx ON section_scores(user_id, created_at);
CREATE INDEX section_scores_draft_field_created_idx ON section_scores(draft_id, field_name, created_at);
CREATE INDEX section_scores_run_idx ON section_scores(run_id);

-- Preserve item-level scores already present in completed section runs.
INSERT INTO section_scores(
  id,user_id,draft_id,run_id,field_name,stage,candidate_id,text_snapshot,
  score,feedback,grade_json,prompt_version,analytics_consent,created_at
)
SELECT
  r.id || ':input',r.user_id,r.draft_id,r.id,r.field_name,'input',NULL,
  json_extract(r.input_json, '$.inputs.' || r.field_name),
  json_extract(r.result_json, '$.input_grade.score'),
  json_extract(r.result_json, '$.input_grade.feedback'),
  json_extract(r.result_json, '$.input_grade'),
  r.prompt_version,r.analytics_consent,r.created_at
FROM runs r
WHERE r.kind='section'
  AND r.status='completed'
  AND json_type(r.result_json, '$.input_grade.score') IN ('integer','real');
