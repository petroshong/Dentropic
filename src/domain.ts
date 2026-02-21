export type DataBackend = "memory" | "cloudflare";

export type DentalModality =
  | "bitewing"
  | "periapical"
  | "panoramic"
  | "cbct"
  | "intraoral-photo";

export type AppointmentStatus =
  | "scheduled"
  | "checked-in"
  | "completed"
  | "cancelled";

export type RiskLevel = "low" | "moderate" | "high";

export type UserRole =
  | "admin"
  | "dentist"
  | "hygienist"
  | "assistant"
  | "front-desk"
  | "billing"
  | "readonly"
  | "system";

export type InsuranceTier = "primary" | "secondary";

export type TreatmentPlanStatus =
  | "active"
  | "accepted"
  | "completed"
  | "archived";

export type TreatmentPlanItemStatus =
  | "proposed"
  | "scheduled"
  | "completed"
  | "removed";

export type LedgerEntryType =
  | "charge"
  | "payment"
  | "adjustment"
  | "claim"
  | "insurance-payment";

export type CommunicationType =
  | "text"
  | "email"
  | "phone"
  | "letter"
  | "in-person";

export type CommunicationDirection = "inbound" | "outbound";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "open" | "in-progress" | "done";

export type RecallStatus = "due" | "scheduled" | "completed";

export interface Actor {
  userId: string;
  role: UserRole;
  purpose?: string;
}

export interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone?: string;
  email?: string;
  insuranceCarrier?: string;
  metadata: Record<string, string>;
  externalIds: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  provider: string;
  reason: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface ImageFinding {
  code: string;
  label: string;
  summary: string;
  confidence: number;
  risk: RiskLevel;
  toothNumbers: string[];
}

export interface DentalImageRecord {
  id: string;
  patientId: string;
  modality: DentalModality;
  imageUrl: string;
  capturedAt: string;
  toothNumbers: string[];
  notes?: string;
  findings: ImageFinding[];
  riskLevel?: RiskLevel;
  analyzedAt?: string;
  createdAt: string;
}

export interface FamilyMember {
  patientId: string;
  relationToGuarantor: string;
  isGuarantor: boolean;
}

export interface FamilyRecord {
  id: string;
  guarantorPatientId: string;
  members: FamilyMember[];
  createdAt: string;
  updatedAt: string;
}

export interface InsurancePlanRecord {
  id: string;
  patientId: string;
  tier: InsuranceTier;
  carrier: string;
  employer?: string;
  subscriberName: string;
  subscriberId: string;
  relationToSubscriber: string;
  groupName?: string;
  groupNumber?: string;
  annualMax?: number;
  deductible?: number;
  benefitPercentages: Record<string, number>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentPlanRecord {
  id: string;
  patientId: string;
  heading: string;
  status: TreatmentPlanStatus;
  signed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentPlanItemRecord {
  id: string;
  planId: string;
  patientId: string;
  tooth?: string;
  surface?: string;
  diagnosis?: string;
  adaCode: string;
  description: string;
  fee: number;
  allowedFee?: number;
  priority: number;
  status: TreatmentPlanItemStatus;
  insuranceEstPrimary: number;
  insuranceEstSecondary: number;
  patientEst: number;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntryRecord {
  id: string;
  patientId: string;
  familyId?: string;
  type: LedgerEntryType;
  amount: number;
  description: string;
  entryDate: string;
  relatedPlanItemId?: string;
  claimStatus?: string;
  createdBy: string;
  createdAt: string;
}

export interface ChartEntryRecord {
  id: string;
  patientId: string;
  entryDate: string;
  tooth?: string;
  surface?: string;
  diagnosis?: string;
  procedureCode?: string;
  note: string;
  provider: string;
  createdAt: string;
}

export interface RecallRecord {
  id: string;
  patientId: string;
  recallType: string;
  intervalMonths: number;
  lastVisitDate?: string;
  dueDate: string;
  status: RecallStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleBlockRecord {
  id: string;
  provider: string;
  operatory?: string;
  startAt: string;
  endAt: string;
  blockType: "available" | "booked" | "break" | "hold";
  patientId?: string;
  appointmentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationLogRecord {
  id: string;
  patientId: string;
  communicationType: CommunicationType;
  direction: CommunicationDirection;
  noteCiphertext: string;
  createdBy: string;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  patientId?: string;
  title: string;
  detailsCiphertext?: string;
  assignedTo?: string;
  dueAt?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  reason?: string;
  metadata: Record<string, string>;
}
