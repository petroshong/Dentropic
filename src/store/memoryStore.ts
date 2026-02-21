import type {
  AppointmentRecord,
  DentalImageRecord,
  PatientRecord,
} from "../domain.js";
import type {
  CreateAppointmentInput,
  CreateDentalImageInput,
  DentalStore,
  SaveImageAnalysisInput,
  UpsertPatientInput,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function safeRecord(value?: Record<string, string>): Record<string, string> {
  return value ? { ...value } : {};
}

export class MemoryDentalStore implements DentalStore {
  private readonly patients = new Map<string, PatientRecord>();
  private readonly appointments = new Map<string, AppointmentRecord>();
  private readonly images = new Map<string, DentalImageRecord>();

  async upsertPatient(input: UpsertPatientInput): Promise<PatientRecord> {
    const patientId = input.patientId || crypto.randomUUID();
    const existing = this.patients.get(patientId);
    const createdAt = existing?.createdAt || nowIso();
    const updatedAt = nowIso();

    const patient: PatientRecord = {
      id: patientId,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      phone: input.phone,
      email: input.email,
      insuranceCarrier: input.insuranceCarrier,
      metadata: {
        ...(existing?.metadata || {}),
        ...safeRecord(input.metadata),
      },
      externalIds: {
        ...(existing?.externalIds || {}),
        ...safeRecord(input.externalIds),
      },
      createdAt,
      updatedAt,
    };

    this.patients.set(patientId, patient);
    return patient;
  }

  async getPatient(patientId: string): Promise<PatientRecord | null> {
    return this.patients.get(patientId) || null;
  }

  async listPatients(): Promise<PatientRecord[]> {
    return Array.from(this.patients.values()).sort((a, b) =>
      a.lastName.localeCompare(b.lastName)
    );
  }

  async createAppointment(
    input: CreateAppointmentInput
  ): Promise<AppointmentRecord> {
    const appointment: AppointmentRecord = {
      id: crypto.randomUUID(),
      patientId: input.patientId,
      provider: input.provider,
      reason: input.reason,
      startAt: input.startAt,
      endAt: input.endAt,
      status: input.status || "scheduled",
      createdAt: nowIso(),
    };

    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  async getAppointment(appointmentId: string): Promise<AppointmentRecord | null> {
    return this.appointments.get(appointmentId) || null;
  }

  async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentRecord["status"]
  ): Promise<AppointmentRecord | null> {
    const existing = this.appointments.get(appointmentId);
    if (!existing) {
      return null;
    }

    const updated: AppointmentRecord = {
      ...existing,
      status,
    };
    this.appointments.set(appointmentId, updated);
    return updated;
  }

  async listAppointments(patientId: string): Promise<AppointmentRecord[]> {
    return Array.from(this.appointments.values())
      .filter((appointment) => appointment.patientId === patientId)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  async listAppointmentsByRange(
    startAt: string,
    endAt: string,
    provider?: string
  ): Promise<AppointmentRecord[]> {
    return Array.from(this.appointments.values())
      .filter((appointment) => {
        const overlaps =
          appointment.startAt < endAt && appointment.endAt > startAt;
        if (!overlaps) {
          return false;
        }
        if (provider && appointment.provider !== provider) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  async createDentalImage(
    input: CreateDentalImageInput
  ): Promise<DentalImageRecord> {
    const image: DentalImageRecord = {
      id: crypto.randomUUID(),
      patientId: input.patientId,
      modality: input.modality,
      imageUrl: input.imageUrl,
      capturedAt: input.capturedAt || nowIso(),
      toothNumbers: input.toothNumbers || [],
      notes: input.notes,
      findings: [],
      createdAt: nowIso(),
    };

    this.images.set(image.id, image);
    return image;
  }

  async getDentalImage(imageId: string): Promise<DentalImageRecord | null> {
    return this.images.get(imageId) || null;
  }

  async listDentalImages(patientId: string): Promise<DentalImageRecord[]> {
    return Array.from(this.images.values())
      .filter((image) => image.patientId === patientId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async saveImageAnalysis(
    input: SaveImageAnalysisInput
  ): Promise<DentalImageRecord> {
    const existing = this.images.get(input.imageId);
    if (!existing) {
      throw new Error(`Image ${input.imageId} not found`);
    }

    const next: DentalImageRecord = {
      ...existing,
      findings: input.findings,
      riskLevel: input.riskLevel,
      analyzedAt: input.analyzedAt || nowIso(),
    };

    this.images.set(existing.id, next);
    return next;
  }
}
