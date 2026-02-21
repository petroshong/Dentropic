CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  insurance_carrier TEXT,
  metadata_json TEXT,
  external_ids_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  reason TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_start
  ON appointments(patient_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_range
  ON appointments(provider, start_at, end_at);

CREATE TABLE IF NOT EXISTS dental_images (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  modality TEXT NOT NULL,
  image_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  tooth_numbers_json TEXT,
  notes TEXT,
  findings_json TEXT,
  risk_level TEXT,
  analyzed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX IF NOT EXISTS idx_dental_images_patient_captured
  ON dental_images(patient_id, captured_at);

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  guarantor_patient_id TEXT NOT NULL,
  members_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_families_guarantor
  ON families(guarantor_patient_id);

CREATE TABLE IF NOT EXISTS insurance_plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  carrier TEXT NOT NULL,
  employer TEXT,
  subscriber_name TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  relation_to_subscriber TEXT NOT NULL,
  group_name TEXT,
  group_number TEXT,
  annual_max REAL,
  deductible REAL,
  benefit_percentages_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_insurance_plans_patient
  ON insurance_plans(patient_id, tier);

CREATE TABLE IF NOT EXISTS treatment_plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  heading TEXT NOT NULL,
  status TEXT NOT NULL,
  signed INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient
  ON treatment_plans(patient_id, created_at);

CREATE TABLE IF NOT EXISTS treatment_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  tooth TEXT,
  surface TEXT,
  diagnosis TEXT,
  ada_code TEXT NOT NULL,
  description TEXT NOT NULL,
  fee REAL NOT NULL,
  allowed_fee REAL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,
  insurance_est_primary REAL NOT NULL,
  insurance_est_secondary REAL NOT NULL,
  patient_est REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_plan
  ON treatment_plan_items(plan_id, priority);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  family_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  related_plan_item_id TEXT,
  claim_status TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_patient_date
  ON ledger_entries(patient_id, entry_date);

CREATE TABLE IF NOT EXISTS chart_entries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  tooth TEXT,
  surface TEXT,
  diagnosis TEXT,
  procedure_code TEXT,
  note TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chart_entries_patient_date
  ON chart_entries(patient_id, entry_date);

CREATE TABLE IF NOT EXISTS recalls (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  recall_type TEXT NOT NULL,
  interval_months INTEGER NOT NULL,
  last_visit_date TEXT,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recalls_due
  ON recalls(due_date, status);

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  operatory TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  block_type TEXT NOT NULL,
  patient_id TEXT,
  appointment_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_provider_range
  ON schedule_blocks(provider, start_at, end_at);

CREATE TABLE IF NOT EXISTS communication_logs (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  communication_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  note_ciphertext TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_communication_logs_patient
  ON communication_logs(patient_id, created_at);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  title TEXT NOT NULL,
  details_ciphertext TEXT,
  assigned_to TEXT,
  due_at TEXT,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status_assigned
  ON tasks(status, assigned_to, updated_at);
