import type {
  ChartEntryRecord,
  CommunicationLogRecord,
  FamilyRecord,
  InsurancePlanRecord,
  LedgerEntryRecord,
  RecallRecord,
  ScheduleBlockRecord,
  TaskRecord,
  TreatmentPlanItemRecord,
  TreatmentPlanRecord,
} from "../domain.js";
import type {
  ClinicOpsRepository,
  ListTasksFilter,
} from "./clinicOpsRepository.js";

interface CloudflareClinicOpsRepositoryConfig {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

type D1Error = { message?: string };
type D1StatementResult<Row> = {
  success?: boolean;
  error?: string;
  results?: Row[];
};
type D1Response<Row> = {
  success?: boolean;
  errors?: D1Error[];
  result?: Array<D1StatementResult<Row>>;
};

type FamilyRow = {
  id: string;
  guarantor_patient_id: string;
  members_json: string;
  created_at: string;
  updated_at: string;
};

type InsurancePlanRow = {
  id: string;
  patient_id: string;
  tier: "primary" | "secondary";
  carrier: string;
  employer: string | null;
  subscriber_name: string;
  subscriber_id: string;
  relation_to_subscriber: string;
  group_name: string | null;
  group_number: string | null;
  annual_max: number | null;
  deductible: number | null;
  benefit_percentages_json: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TreatmentPlanRow = {
  id: string;
  patient_id: string;
  heading: string;
  status: "active" | "accepted" | "completed" | "archived";
  signed: number;
  created_at: string;
  updated_at: string;
};

type TreatmentPlanItemRow = {
  id: string;
  plan_id: string;
  patient_id: string;
  tooth: string | null;
  surface: string | null;
  diagnosis: string | null;
  ada_code: string;
  description: string;
  fee: number;
  allowed_fee: number | null;
  priority: number;
  status: "proposed" | "scheduled" | "completed" | "removed";
  insurance_est_primary: number;
  insurance_est_secondary: number;
  patient_est: number;
  created_at: string;
  updated_at: string;
};

type LedgerEntryRow = {
  id: string;
  patient_id: string;
  family_id: string | null;
  type: "charge" | "payment" | "adjustment" | "claim" | "insurance-payment";
  amount: number;
  description: string;
  entry_date: string;
  related_plan_item_id: string | null;
  claim_status: string | null;
  created_by: string;
  created_at: string;
};

type ChartEntryRow = {
  id: string;
  patient_id: string;
  entry_date: string;
  tooth: string | null;
  surface: string | null;
  diagnosis: string | null;
  procedure_code: string | null;
  note: string;
  provider: string;
  created_at: string;
};

type RecallRow = {
  id: string;
  patient_id: string;
  recall_type: string;
  interval_months: number;
  last_visit_date: string | null;
  due_date: string;
  status: "due" | "scheduled" | "completed";
  created_at: string;
  updated_at: string;
};

type ScheduleBlockRow = {
  id: string;
  provider: string;
  operatory: string | null;
  start_at: string;
  end_at: string;
  block_type: "available" | "booked" | "break" | "hold";
  patient_id: string | null;
  appointment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CommunicationLogRow = {
  id: string;
  patient_id: string;
  communication_type: "text" | "email" | "phone" | "letter" | "in-person";
  direction: "inbound" | "outbound";
  note_ciphertext: string;
  created_by: string;
  created_at: string;
};

type TaskRow = {
  id: string;
  patient_id: string | null;
  title: string;
  details_ciphertext: string | null;
  assigned_to: string | null;
  due_at: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "done";
  created_by: string;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapFamily(row: FamilyRow): FamilyRecord {
  return {
    id: row.id,
    guarantorPatientId: row.guarantor_patient_id,
    members: parseJson(row.members_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInsurancePlan(row: InsurancePlanRow): InsurancePlanRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    tier: row.tier,
    carrier: row.carrier,
    employer: row.employer || undefined,
    subscriberName: row.subscriber_name,
    subscriberId: row.subscriber_id,
    relationToSubscriber: row.relation_to_subscriber,
    groupName: row.group_name || undefined,
    groupNumber: row.group_number || undefined,
    annualMax: row.annual_max ?? undefined,
    deductible: row.deductible ?? undefined,
    benefitPercentages: parseJson(row.benefit_percentages_json, {}),
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTreatmentPlan(row: TreatmentPlanRow): TreatmentPlanRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    heading: row.heading,
    status: row.status,
    signed: Boolean(row.signed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTreatmentPlanItem(row: TreatmentPlanItemRow): TreatmentPlanItemRecord {
  return {
    id: row.id,
    planId: row.plan_id,
    patientId: row.patient_id,
    tooth: row.tooth || undefined,
    surface: row.surface || undefined,
    diagnosis: row.diagnosis || undefined,
    adaCode: row.ada_code,
    description: row.description,
    fee: row.fee,
    allowedFee: row.allowed_fee ?? undefined,
    priority: row.priority,
    status: row.status,
    insuranceEstPrimary: row.insurance_est_primary,
    insuranceEstSecondary: row.insurance_est_secondary,
    patientEst: row.patient_est,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLedgerEntry(row: LedgerEntryRow): LedgerEntryRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    familyId: row.family_id || undefined,
    type: row.type,
    amount: row.amount,
    description: row.description,
    entryDate: row.entry_date,
    relatedPlanItemId: row.related_plan_item_id || undefined,
    claimStatus: row.claim_status || undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapChartEntry(row: ChartEntryRow): ChartEntryRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    entryDate: row.entry_date,
    tooth: row.tooth || undefined,
    surface: row.surface || undefined,
    diagnosis: row.diagnosis || undefined,
    procedureCode: row.procedure_code || undefined,
    note: row.note,
    provider: row.provider,
    createdAt: row.created_at,
  };
}

function mapRecall(row: RecallRow): RecallRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    recallType: row.recall_type,
    intervalMonths: row.interval_months,
    lastVisitDate: row.last_visit_date || undefined,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScheduleBlock(row: ScheduleBlockRow): ScheduleBlockRecord {
  return {
    id: row.id,
    provider: row.provider,
    operatory: row.operatory || undefined,
    startAt: row.start_at,
    endAt: row.end_at,
    blockType: row.block_type,
    patientId: row.patient_id || undefined,
    appointmentId: row.appointment_id || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCommunicationLog(row: CommunicationLogRow): CommunicationLogRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    communicationType: row.communication_type,
    direction: row.direction,
    noteCiphertext: row.note_ciphertext,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    patientId: row.patient_id || undefined,
    title: row.title,
    detailsCiphertext: row.details_ciphertext || undefined,
    assignedTo: row.assigned_to || undefined,
    dueAt: row.due_at || undefined,
    priority: row.priority,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CloudflareClinicOpsRepository implements ClinicOpsRepository {
  private readonly endpoint: string;
  private readonly apiToken: string;
  private schemaReadyPromise: Promise<void> | null = null;

  constructor(config: CloudflareClinicOpsRepositoryConfig) {
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
    this.apiToken = config.apiToken;
  }

  private async query<Row>(
    sql: string,
    params: unknown[] = []
  ): Promise<Row[]> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(
        `Cloudflare D1 request failed (${response.status}): ${response.statusText}`
      );
    }

    const payload = (await response.json()) as D1Response<Row>;
    const errors = payload.errors || [];
    if (payload.success === false || errors.length > 0) {
      const message = errors.map((error) => error.message).filter(Boolean).join("; ");
      throw new Error(`Cloudflare D1 query error: ${message || "unknown error"}`);
    }

    const statement = payload.result?.[0];
    if (statement?.success === false) {
      throw new Error(
        `Cloudflare D1 statement error: ${statement.error || "unknown error"}`
      );
    }

    return statement?.results || [];
  }

  private async exec(sql: string, params: unknown[] = []): Promise<void> {
    await this.query(sql, params);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = this.exec(`
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
      `);
    }

    return this.schemaReadyPromise;
  }

  async findFamilyById(familyId: string): Promise<FamilyRecord | null> {
    await this.ensureSchema();
    const rows = await this.query<FamilyRow>(
      `SELECT id, guarantor_patient_id, members_json, created_at, updated_at
       FROM families WHERE id = ? LIMIT 1`,
      [familyId]
    );
    return rows[0] ? mapFamily(rows[0]) : null;
  }

  async findFamilyByGuarantor(
    guarantorPatientId: string
  ): Promise<FamilyRecord | null> {
    await this.ensureSchema();
    const rows = await this.query<FamilyRow>(
      `SELECT id, guarantor_patient_id, members_json, created_at, updated_at
       FROM families WHERE guarantor_patient_id = ? LIMIT 1`,
      [guarantorPatientId]
    );
    return rows[0] ? mapFamily(rows[0]) : null;
  }

  async findFamilyByPatient(patientId: string): Promise<FamilyRecord | null> {
    await this.ensureSchema();
    const rows = await this.query<FamilyRow>(
      `SELECT id, guarantor_patient_id, members_json, created_at, updated_at
       FROM families`
    );
    const family = rows.map(mapFamily).find((item) =>
      item.members.some((member) => member.patientId === patientId)
    );
    return family || null;
  }

  async saveFamily(family: FamilyRecord): Promise<FamilyRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO families (id, guarantor_patient_id, members_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        guarantor_patient_id = excluded.guarantor_patient_id,
        members_json = excluded.members_json,
        updated_at = excluded.updated_at
      `,
      [
        family.id,
        family.guarantorPatientId,
        JSON.stringify(family.members),
        family.createdAt,
        family.updatedAt,
      ]
    );
    return family;
  }

  async getInsurancePlan(planId: string): Promise<InsurancePlanRecord | null> {
    await this.ensureSchema();
    const rows = await this.query<InsurancePlanRow>(
      `SELECT * FROM insurance_plans WHERE id = ? LIMIT 1`,
      [planId]
    );
    return rows[0] ? mapInsurancePlan(rows[0]) : null;
  }

  async saveInsurancePlan(plan: InsurancePlanRecord): Promise<InsurancePlanRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO insurance_plans (
        id, patient_id, tier, carrier, employer, subscriber_name, subscriber_id,
        relation_to_subscriber, group_name, group_number, annual_max, deductible,
        benefit_percentages_json, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        patient_id = excluded.patient_id,
        tier = excluded.tier,
        carrier = excluded.carrier,
        employer = excluded.employer,
        subscriber_name = excluded.subscriber_name,
        subscriber_id = excluded.subscriber_id,
        relation_to_subscriber = excluded.relation_to_subscriber,
        group_name = excluded.group_name,
        group_number = excluded.group_number,
        annual_max = excluded.annual_max,
        deductible = excluded.deductible,
        benefit_percentages_json = excluded.benefit_percentages_json,
        notes = excluded.notes,
        updated_at = excluded.updated_at
      `,
      [
        plan.id,
        plan.patientId,
        plan.tier,
        plan.carrier,
        plan.employer || null,
        plan.subscriberName,
        plan.subscriberId,
        plan.relationToSubscriber,
        plan.groupName || null,
        plan.groupNumber || null,
        plan.annualMax ?? null,
        plan.deductible ?? null,
        JSON.stringify(plan.benefitPercentages),
        plan.notes || null,
        plan.createdAt,
        plan.updatedAt,
      ]
    );
    return plan;
  }

  async listInsurancePlansByPatient(
    patientId: string
  ): Promise<InsurancePlanRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<InsurancePlanRow>(
      `SELECT * FROM insurance_plans WHERE patient_id = ? ORDER BY tier ASC`,
      [patientId]
    );
    return rows.map(mapInsurancePlan);
  }

  async saveTreatmentPlan(plan: TreatmentPlanRecord): Promise<TreatmentPlanRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO treatment_plans (id, patient_id, heading, status, signed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        patient_id = excluded.patient_id,
        heading = excluded.heading,
        status = excluded.status,
        signed = excluded.signed,
        updated_at = excluded.updated_at
      `,
      [
        plan.id,
        plan.patientId,
        plan.heading,
        plan.status,
        plan.signed ? 1 : 0,
        plan.createdAt,
        plan.updatedAt,
      ]
    );
    return plan;
  }

  async getTreatmentPlan(planId: string): Promise<TreatmentPlanRecord | null> {
    await this.ensureSchema();
    const rows = await this.query<TreatmentPlanRow>(
      `SELECT * FROM treatment_plans WHERE id = ? LIMIT 1`,
      [planId]
    );
    return rows[0] ? mapTreatmentPlan(rows[0]) : null;
  }

  async listTreatmentPlansByPatient(
    patientId: string
  ): Promise<TreatmentPlanRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<TreatmentPlanRow>(
      `SELECT * FROM treatment_plans WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
    return rows.map(mapTreatmentPlan);
  }

  async saveTreatmentPlanItem(
    item: TreatmentPlanItemRecord
  ): Promise<TreatmentPlanItemRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO treatment_plan_items (
        id, plan_id, patient_id, tooth, surface, diagnosis, ada_code, description,
        fee, allowed_fee, priority, status, insurance_est_primary,
        insurance_est_secondary, patient_est, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        plan_id = excluded.plan_id,
        patient_id = excluded.patient_id,
        tooth = excluded.tooth,
        surface = excluded.surface,
        diagnosis = excluded.diagnosis,
        ada_code = excluded.ada_code,
        description = excluded.description,
        fee = excluded.fee,
        allowed_fee = excluded.allowed_fee,
        priority = excluded.priority,
        status = excluded.status,
        insurance_est_primary = excluded.insurance_est_primary,
        insurance_est_secondary = excluded.insurance_est_secondary,
        patient_est = excluded.patient_est,
        updated_at = excluded.updated_at
      `,
      [
        item.id,
        item.planId,
        item.patientId,
        item.tooth || null,
        item.surface || null,
        item.diagnosis || null,
        item.adaCode,
        item.description,
        item.fee,
        item.allowedFee ?? null,
        item.priority,
        item.status,
        item.insuranceEstPrimary,
        item.insuranceEstSecondary,
        item.patientEst,
        item.createdAt,
        item.updatedAt,
      ]
    );
    return item;
  }

  async listTreatmentPlanItemsByPlan(
    planId: string
  ): Promise<TreatmentPlanItemRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<TreatmentPlanItemRow>(
      `SELECT * FROM treatment_plan_items WHERE plan_id = ? ORDER BY priority ASC`,
      [planId]
    );
    return rows.map(mapTreatmentPlanItem);
  }

  async saveLedgerEntry(entry: LedgerEntryRecord): Promise<LedgerEntryRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO ledger_entries (
        id, patient_id, family_id, type, amount, description, entry_date,
        related_plan_item_id, claim_status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        patient_id = excluded.patient_id,
        family_id = excluded.family_id,
        type = excluded.type,
        amount = excluded.amount,
        description = excluded.description,
        entry_date = excluded.entry_date,
        related_plan_item_id = excluded.related_plan_item_id,
        claim_status = excluded.claim_status,
        created_by = excluded.created_by,
        created_at = excluded.created_at
      `,
      [
        entry.id,
        entry.patientId,
        entry.familyId || null,
        entry.type,
        entry.amount,
        entry.description,
        entry.entryDate,
        entry.relatedPlanItemId || null,
        entry.claimStatus || null,
        entry.createdBy,
        entry.createdAt,
      ]
    );
    return entry;
  }

  async listLedgerEntriesByPatient(patientId: string): Promise<LedgerEntryRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<LedgerEntryRow>(
      `SELECT * FROM ledger_entries WHERE patient_id = ? ORDER BY entry_date ASC`,
      [patientId]
    );
    return rows.map(mapLedgerEntry);
  }

  async saveChartEntry(entry: ChartEntryRecord): Promise<ChartEntryRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO chart_entries (
        id, patient_id, entry_date, tooth, surface, diagnosis,
        procedure_code, note, provider, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        patient_id = excluded.patient_id,
        entry_date = excluded.entry_date,
        tooth = excluded.tooth,
        surface = excluded.surface,
        diagnosis = excluded.diagnosis,
        procedure_code = excluded.procedure_code,
        note = excluded.note,
        provider = excluded.provider,
        created_at = excluded.created_at
      `,
      [
        entry.id,
        entry.patientId,
        entry.entryDate,
        entry.tooth || null,
        entry.surface || null,
        entry.diagnosis || null,
        entry.procedureCode || null,
        entry.note,
        entry.provider,
        entry.createdAt,
      ]
    );
    return entry;
  }

  async listChartEntriesByPatient(patientId: string): Promise<ChartEntryRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<ChartEntryRow>(
      `SELECT * FROM chart_entries WHERE patient_id = ? ORDER BY entry_date DESC`,
      [patientId]
    );
    return rows.map(mapChartEntry);
  }

  async saveRecall(recall: RecallRecord): Promise<RecallRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO recalls (
        id, patient_id, recall_type, interval_months, last_visit_date,
        due_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        patient_id = excluded.patient_id,
        recall_type = excluded.recall_type,
        interval_months = excluded.interval_months,
        last_visit_date = excluded.last_visit_date,
        due_date = excluded.due_date,
        status = excluded.status,
        updated_at = excluded.updated_at
      `,
      [
        recall.id,
        recall.patientId,
        recall.recallType,
        recall.intervalMonths,
        recall.lastVisitDate || null,
        recall.dueDate,
        recall.status,
        recall.createdAt,
        recall.updatedAt,
      ]
    );
    return recall;
  }

  async listRecallsDue(fromIso: string, toIso: string): Promise<RecallRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<RecallRow>(
      `SELECT * FROM recalls WHERE due_date >= ? AND due_date <= ? ORDER BY due_date ASC`,
      [fromIso, toIso]
    );
    return rows.map(mapRecall);
  }

  async saveScheduleBlock(block: ScheduleBlockRecord): Promise<ScheduleBlockRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO schedule_blocks (
        id, provider, operatory, start_at, end_at, block_type,
        patient_id, appointment_id, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        operatory = excluded.operatory,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        block_type = excluded.block_type,
        patient_id = excluded.patient_id,
        appointment_id = excluded.appointment_id,
        notes = excluded.notes,
        updated_at = excluded.updated_at
      `,
      [
        block.id,
        block.provider,
        block.operatory || null,
        block.startAt,
        block.endAt,
        block.blockType,
        block.patientId || null,
        block.appointmentId || null,
        block.notes || null,
        block.createdAt,
        block.updatedAt,
      ]
    );
    return block;
  }

  async listScheduleBlocksByProviderInRange(
    provider: string,
    startIso: string,
    endIso: string
  ): Promise<ScheduleBlockRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<ScheduleBlockRow>(
      `
      SELECT * FROM schedule_blocks
      WHERE provider = ? AND start_at < ? AND end_at > ?
      ORDER BY start_at ASC
      `,
      [provider, endIso, startIso]
    );
    return rows.map(mapScheduleBlock);
  }

  async saveCommunicationLog(
    log: CommunicationLogRecord
  ): Promise<CommunicationLogRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO communication_logs (
        id, patient_id, communication_type, direction,
        note_ciphertext, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        patient_id = excluded.patient_id,
        communication_type = excluded.communication_type,
        direction = excluded.direction,
        note_ciphertext = excluded.note_ciphertext,
        created_by = excluded.created_by,
        created_at = excluded.created_at
      `,
      [
        log.id,
        log.patientId,
        log.communicationType,
        log.direction,
        log.noteCiphertext,
        log.createdBy,
        log.createdAt,
      ]
    );
    return log;
  }

  async listCommunicationLogsByPatient(
    patientId: string
  ): Promise<CommunicationLogRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<CommunicationLogRow>(
      `SELECT * FROM communication_logs WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
    return rows.map(mapCommunicationLog);
  }

  async getTask(taskId: string): Promise<TaskRecord | null> {
    await this.ensureSchema();
    const rows = await this.query<TaskRow>(
      `SELECT * FROM tasks WHERE id = ? LIMIT 1`,
      [taskId]
    );
    return rows[0] ? mapTask(rows[0]) : null;
  }

  async saveTask(task: TaskRecord): Promise<TaskRecord> {
    await this.ensureSchema();
    await this.exec(
      `
      INSERT INTO tasks (
        id, patient_id, title, details_ciphertext, assigned_to,
        due_at, priority, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        patient_id = excluded.patient_id,
        title = excluded.title,
        details_ciphertext = excluded.details_ciphertext,
        assigned_to = excluded.assigned_to,
        due_at = excluded.due_at,
        priority = excluded.priority,
        status = excluded.status,
        created_by = excluded.created_by,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
      `,
      [
        task.id,
        task.patientId || null,
        task.title,
        task.detailsCiphertext || null,
        task.assignedTo || null,
        task.dueAt || null,
        task.priority,
        task.status,
        task.createdBy,
        task.createdAt,
        task.updatedAt,
      ]
    );
    return task;
  }

  async listTasks(filter: ListTasksFilter): Promise<TaskRecord[]> {
    await this.ensureSchema();

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }

    if (filter.assignedTo) {
      clauses.push("assigned_to = ?");
      params.push(filter.assignedTo);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = await this.query<TaskRow>(
      `
      SELECT * FROM tasks
      ${whereSql}
      ORDER BY updated_at DESC
      LIMIT ?
      `,
      [...params, filter.limit]
    );

    return rows.map(mapTask);
  }
}
