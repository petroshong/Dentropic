import type {
  AppointmentRecord,
  AppointmentStatus,
  DentalImageRecord,
  DentalModality,
  ImageFinding,
  PatientRecord,
  RiskLevel,
} from "../domain.js";

export interface UpsertPatientInput {
  patientId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone?: string;
  email?: string;
  insuranceCarrier?: string;
  metadata?: Record<string, string>;
  externalIds?: Record<string, string>;
}

export interface CreateAppointmentInput {
  patientId: string;
  provider: string;
  reason: string;
  startAt: string;
  endAt: string;
  status?: AppointmentStatus;
}

export interface CreateDentalImageInput {
  patientId: string;
  modality: DentalModality;
  imageUrl: string;
  capturedAt?: string;
  toothNumbers?: string[];
  notes?: string;
}

export interface SaveImageAnalysisInput {
  imageId: string;
  findings: ImageFinding[];
  riskLevel: RiskLevel;
  analyzedAt?: string;
}

export interface DentalStore {
  upsertPatient(input: UpsertPatientInput): Promise<PatientRecord>;
  getPatient(patientId: string): Promise<PatientRecord | null>;
  listPatients(): Promise<PatientRecord[]>;
  createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord>;
  getAppointment(appointmentId: string): Promise<AppointmentRecord | null>;
  updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus
  ): Promise<AppointmentRecord | null>;
  listAppointments(patientId: string): Promise<AppointmentRecord[]>;
  listAppointmentsByRange(
    startAt: string,
    endAt: string,
    provider?: string
  ): Promise<AppointmentRecord[]>;
  createDentalImage(input: CreateDentalImageInput): Promise<DentalImageRecord>;
  getDentalImage(imageId: string): Promise<DentalImageRecord | null>;
  listDentalImages(patientId: string): Promise<DentalImageRecord[]>;
  saveImageAnalysis(input: SaveImageAnalysisInput): Promise<DentalImageRecord>;
}
