import type {
  AppointmentRecord,
  DentalImageRecord,
  ImageFinding,
  PatientRecord,
} from "../domain.js";
import type {
  CreateAppointmentInput,
  CreateDentalImageInput,
  DentalStore,
  SaveImageAnalysisInput,
  UpsertPatientInput,
} from "./types.js";

interface CloudflareD1StoreConfig {
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

type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string | null;
  email: string | null;
  insurance_carrier: string | null;
  metadata_json: string | null;
  external_ids_json: string | null;
  created_at: string;
  updated_at: string;
};

type AppointmentRow = {
  id: string;
  patient_id: string;
  provider: string;
  reason: string;
  start_at: string;
  end_at: string;
  status: "scheduled" | "checked-in" | "completed" | "cancelled";
  created_at: string;
};

type DentalImageRow = {
  id: string;
  patient_id: string;
  modality: "bitewing" | "periapical" | "panoramic" | "cbct" | "intraoral-photo";
  image_url: string;
  captured_at: string;
  tooth_numbers_json: string | null;
  notes: string | null;
  findings_json: string | null;
  risk_level: "low" | "moderate" | "high" | null;
  analyzed_at: string | null;
  created_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseRecord(value: string | null): Record<string, string> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseFindings(value: string | null): ImageFinding[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as ImageFinding[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class CloudflareD1Store implements DentalStore {
  private readonly endpoint: string;
  private readonly apiToken: string;
  private schemaReadyPromise: Promise<void> | null = null;

  constructor(config: CloudflareD1StoreConfig) {
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
    this.apiToken = config.apiToken;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = this.exec(`
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
      `);
    }

    return this.schemaReadyPromise;
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
      throw new Error(`Cloudflare D1 statement error: ${statement.error || "unknown error"}`);
    }

    return statement?.results || [];
  }

  private async exec(sql: string, params: unknown[] = []): Promise<void> {
    await this.query(sql, params);
  }

  private mapPatient(row: PatientRow): PatientRecord {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth,
      phone: row.phone || undefined,
      email: row.email || undefined,
      insuranceCarrier: row.insurance_carrier || undefined,
      metadata: parseRecord(row.metadata_json),
      externalIds: parseRecord(row.external_ids_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAppointment(row: AppointmentRow): AppointmentRecord {
    return {
      id: row.id,
      patientId: row.patient_id,
      provider: row.provider,
      reason: row.reason,
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  private mapImage(row: DentalImageRow): DentalImageRecord {
    return {
      id: row.id,
      patientId: row.patient_id,
      modality: row.modality,
      imageUrl: row.image_url,
      capturedAt: row.captured_at,
      toothNumbers: parseArray(row.tooth_numbers_json),
      notes: row.notes || undefined,
      findings: parseFindings(row.findings_json),
      riskLevel: row.risk_level || undefined,
      analyzedAt: row.analyzed_at || undefined,
      createdAt: row.created_at,
    };
  }

  async upsertPatient(input: UpsertPatientInput): Promise<PatientRecord> {
    await this.ensureSchema();

    const existing = input.patientId ? await this.getPatient(input.patientId) : null;
    const patientId = input.patientId || crypto.randomUUID();
    const createdAt = existing?.createdAt || nowIso();
    const updatedAt = nowIso();

    const metadata = {
      ...(existing?.metadata || {}),
      ...(input.metadata || {}),
    };

    const externalIds = {
      ...(existing?.externalIds || {}),
      ...(input.externalIds || {}),
    };

    await this.exec(
      `
      INSERT INTO patients (
        id,
        first_name,
        last_name,
        date_of_birth,
        phone,
        email,
        insurance_carrier,
        metadata_json,
        external_ids_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        date_of_birth = excluded.date_of_birth,
        phone = excluded.phone,
        email = excluded.email,
        insurance_carrier = excluded.insurance_carrier,
        metadata_json = excluded.metadata_json,
        external_ids_json = excluded.external_ids_json,
        updated_at = excluded.updated_at
      `,
      [
        patientId,
        input.firstName,
        input.lastName,
        input.dateOfBirth,
        input.phone || null,
        input.email || null,
        input.insuranceCarrier || null,
        JSON.stringify(metadata),
        JSON.stringify(externalIds),
        createdAt,
        updatedAt,
      ]
    );

    const patient = await this.getPatient(patientId);
    if (!patient) {
      throw new Error(`Failed to upsert patient ${patientId}`);
    }

    return patient;
  }

  async getPatient(patientId: string): Promise<PatientRecord | null> {
    await this.ensureSchema();

    const rows = await this.query<PatientRow>(
      `
      SELECT
        id,
        first_name,
        last_name,
        date_of_birth,
        phone,
        email,
        insurance_carrier,
        metadata_json,
        external_ids_json,
        created_at,
        updated_at
      FROM patients
      WHERE id = ?
      LIMIT 1
      `,
      [patientId]
    );

    return rows[0] ? this.mapPatient(rows[0]) : null;
  }

  async listPatients(): Promise<PatientRecord[]> {
    await this.ensureSchema();

    const rows = await this.query<PatientRow>(
      `
      SELECT
        id,
        first_name,
        last_name,
        date_of_birth,
        phone,
        email,
        insurance_carrier,
        metadata_json,
        external_ids_json,
        created_at,
        updated_at
      FROM patients
      ORDER BY last_name ASC, first_name ASC
      `
    );

    return rows.map((row) => this.mapPatient(row));
  }

  async createAppointment(
    input: CreateAppointmentInput
  ): Promise<AppointmentRecord> {
    await this.ensureSchema();

    const appointmentId = crypto.randomUUID();
    const createdAt = nowIso();

    await this.exec(
      `
      INSERT INTO appointments (
        id,
        patient_id,
        provider,
        reason,
        start_at,
        end_at,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        appointmentId,
        input.patientId,
        input.provider,
        input.reason,
        input.startAt,
        input.endAt,
        input.status || "scheduled",
        createdAt,
      ]
    );

    return {
      id: appointmentId,
      patientId: input.patientId,
      provider: input.provider,
      reason: input.reason,
      startAt: input.startAt,
      endAt: input.endAt,
      status: input.status || "scheduled",
      createdAt,
    };
  }

  async getAppointment(appointmentId: string): Promise<AppointmentRecord | null> {
    await this.ensureSchema();

    const rows = await this.query<AppointmentRow>(
      `
      SELECT
        id,
        patient_id,
        provider,
        reason,
        start_at,
        end_at,
        status,
        created_at
      FROM appointments
      WHERE id = ?
      LIMIT 1
      `,
      [appointmentId]
    );

    return rows[0] ? this.mapAppointment(rows[0]) : null;
  }

  async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentRow["status"]
  ): Promise<AppointmentRecord | null> {
    await this.ensureSchema();

    await this.exec(
      `
      UPDATE appointments
      SET status = ?
      WHERE id = ?
      `,
      [status, appointmentId]
    );

    return this.getAppointment(appointmentId);
  }

  async listAppointments(patientId: string): Promise<AppointmentRecord[]> {
    await this.ensureSchema();

    const rows = await this.query<AppointmentRow>(
      `
      SELECT
        id,
        patient_id,
        provider,
        reason,
        start_at,
        end_at,
        status,
        created_at
      FROM appointments
      WHERE patient_id = ?
      ORDER BY start_at ASC
      `,
      [patientId]
    );

    return rows.map((row) => this.mapAppointment(row));
  }

  async listAppointmentsByRange(
    startAt: string,
    endAt: string,
    provider?: string
  ): Promise<AppointmentRecord[]> {
    await this.ensureSchema();

    const withProvider = typeof provider === "string" && provider.length > 0;
    const sql = withProvider
      ? `
      SELECT
        id,
        patient_id,
        provider,
        reason,
        start_at,
        end_at,
        status,
        created_at
      FROM appointments
      WHERE start_at < ? AND end_at > ? AND provider = ?
      ORDER BY start_at ASC
      `
      : `
      SELECT
        id,
        patient_id,
        provider,
        reason,
        start_at,
        end_at,
        status,
        created_at
      FROM appointments
      WHERE start_at < ? AND end_at > ?
      ORDER BY start_at ASC
      `;

    const params = withProvider
      ? [endAt, startAt, provider as string]
      : [endAt, startAt];

    const rows = await this.query<AppointmentRow>(sql, params);
    return rows.map((row) => this.mapAppointment(row));
  }

  async createDentalImage(
    input: CreateDentalImageInput
  ): Promise<DentalImageRecord> {
    await this.ensureSchema();

    const imageId = crypto.randomUUID();
    const createdAt = nowIso();
    const capturedAt = input.capturedAt || createdAt;

    await this.exec(
      `
      INSERT INTO dental_images (
        id,
        patient_id,
        modality,
        image_url,
        captured_at,
        tooth_numbers_json,
        notes,
        findings_json,
        risk_level,
        analyzed_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        imageId,
        input.patientId,
        input.modality,
        input.imageUrl,
        capturedAt,
        JSON.stringify(input.toothNumbers || []),
        input.notes || null,
        JSON.stringify([]),
        null,
        null,
        createdAt,
      ]
    );

    return {
      id: imageId,
      patientId: input.patientId,
      modality: input.modality,
      imageUrl: input.imageUrl,
      capturedAt,
      toothNumbers: input.toothNumbers || [],
      notes: input.notes,
      findings: [],
      createdAt,
    };
  }

  async getDentalImage(imageId: string): Promise<DentalImageRecord | null> {
    await this.ensureSchema();

    const rows = await this.query<DentalImageRow>(
      `
      SELECT
        id,
        patient_id,
        modality,
        image_url,
        captured_at,
        tooth_numbers_json,
        notes,
        findings_json,
        risk_level,
        analyzed_at,
        created_at
      FROM dental_images
      WHERE id = ?
      LIMIT 1
      `,
      [imageId]
    );

    return rows[0] ? this.mapImage(rows[0]) : null;
  }

  async listDentalImages(patientId: string): Promise<DentalImageRecord[]> {
    await this.ensureSchema();

    const rows = await this.query<DentalImageRow>(
      `
      SELECT
        id,
        patient_id,
        modality,
        image_url,
        captured_at,
        tooth_numbers_json,
        notes,
        findings_json,
        risk_level,
        analyzed_at,
        created_at
      FROM dental_images
      WHERE patient_id = ?
      ORDER BY captured_at DESC
      `,
      [patientId]
    );

    return rows.map((row) => this.mapImage(row));
  }

  async saveImageAnalysis(
    input: SaveImageAnalysisInput
  ): Promise<DentalImageRecord> {
    await this.ensureSchema();

    const analyzedAt = input.analyzedAt || nowIso();

    await this.exec(
      `
      UPDATE dental_images
      SET findings_json = ?, risk_level = ?, analyzed_at = ?
      WHERE id = ?
      `,
      [
        JSON.stringify(input.findings),
        input.riskLevel,
        analyzedAt,
        input.imageId,
      ]
    );

    const updated = await this.getDentalImage(input.imageId);
    if (!updated) {
      throw new Error(`Image ${input.imageId} not found`);
    }

    return updated;
  }
}
