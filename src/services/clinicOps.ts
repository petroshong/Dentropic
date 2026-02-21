import type {
  Actor,
  AppointmentRecord,
  ChartEntryRecord,
  CommunicationDirection,
  CommunicationLogRecord,
  CommunicationType,
  FamilyRecord,
  InsurancePlanRecord,
  InsuranceTier,
  LedgerEntryRecord,
  LedgerEntryType,
  PatientRecord,
  RecallRecord,
  RecallStatus,
  ScheduleBlockRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TreatmentPlanItemRecord,
  TreatmentPlanRecord,
  TreatmentPlanStatus,
} from "../domain.js";
import type { TextCipher } from "../security/crypto.js";
import type { ClinicOpsRepository } from "../store/clinicOpsRepository.js";
import type { DentalStore } from "../store/types.js";

export interface SearchPatientsInput {
  query?: string;
  lastName?: string;
  firstName?: string;
  phone?: string;
  dateOfBirth?: string;
  externalId?: string;
  limit?: number;
}

export interface UpsertFamilyInput {
  familyId?: string;
  guarantorPatientId: string;
  memberPatientId: string;
  relationToGuarantor: string;
}

export interface UpsertInsurancePlanInput {
  planId?: string;
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
  benefitPercentages?: Record<string, number>;
  notes?: string;
}

export interface CreateTreatmentPlanInput {
  planId?: string;
  patientId: string;
  heading: string;
  status?: TreatmentPlanStatus;
  signed?: boolean;
}

export interface AddTreatmentPlanItemInput {
  itemId?: string;
  planId: string;
  patientId: string;
  tooth?: string;
  surface?: string;
  diagnosis?: string;
  adaCode: string;
  description: string;
  fee: number;
  allowedFee?: number;
  priority?: number;
}

export interface PostLedgerEntryInput {
  patientId: string;
  familyId?: string;
  type: LedgerEntryType;
  amount: number;
  description: string;
  entryDate?: string;
  relatedPlanItemId?: string;
  claimStatus?: string;
  createdBy: string;
}

export interface AddChartEntryInput {
  patientId: string;
  entryDate?: string;
  tooth?: string;
  surface?: string;
  diagnosis?: string;
  procedureCode?: string;
  note: string;
  provider: string;
}

export interface UpsertRecallInput {
  recallId?: string;
  patientId: string;
  recallType: string;
  intervalMonths: number;
  lastVisitDate?: string;
  dueDate?: string;
  status?: RecallStatus;
}

export interface UpsertScheduleBlockInput {
  blockId?: string;
  provider: string;
  operatory?: string;
  startAt: string;
  endAt: string;
  blockType: "available" | "booked" | "break" | "hold";
  patientId?: string;
  appointmentId?: string;
  notes?: string;
}

export interface FindOpenSlotsInput {
  provider: string;
  date: string;
  durationMinutes: number;
  intervalMinutes?: number;
  startHour?: number;
  endHour?: number;
}

export interface AddCommunicationLogInput {
  patientId: string;
  communicationType: CommunicationType;
  direction: CommunicationDirection;
  note: string;
  createdBy: string;
}

export interface UpsertTaskInput {
  taskId?: string;
  patientId?: string;
  title: string;
  details?: string;
  assignedTo?: string;
  dueAt?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  actorUserId: string;
}

export interface OpenDentalSnapshot {
  patients?: Array<{
    patNum: string;
    firstName: string;
    lastName: string;
    birthdate: string;
    phone?: string;
    email?: string;
    chartNumber?: string;
    guarantorPatNum?: string;
  }>;
  appointments?: Array<{
    aptNum: string;
    patNum: string;
    provider: string;
    reason: string;
    startAt: string;
    endAt: string;
    status?: AppointmentRecord["status"];
  }>;
  insurancePlans?: Array<{
    planNum: string;
    patNum: string;
    tier: InsuranceTier;
    carrier: string;
    subscriberName: string;
    subscriberId: string;
    relationToSubscriber: string;
    groupName?: string;
    groupNumber?: string;
    annualMax?: number;
    deductible?: number;
    preventive?: number;
    restorative?: number;
    endodontic?: number;
    periodontal?: number;
    oralSurgery?: number;
    crowns?: number;
    prosthodontics?: number;
  }>;
  treatmentPlans?: Array<{
    planNum: string;
    patNum: string;
    heading: string;
    status?: TreatmentPlanStatus;
    signed?: boolean;
    items?: Array<{
      itemNum: string;
      tooth?: string;
      surface?: string;
      diagnosis?: string;
      adaCode: string;
      description: string;
      fee: number;
      allowedFee?: number;
      priority?: number;
    }>;
  }>;
  ledgerEntries?: Array<{
    entryNum: string;
    patNum: string;
    type: LedgerEntryType;
    amount: number;
    description: string;
    entryDate: string;
    claimStatus?: string;
  }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function startOfDayIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function endOfDayIso(date: string): string {
  return `${date}T23:59:59.999Z`;
}

function addMonths(dateIso: string, months: number): string {
  const date = new Date(dateIso);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function overlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && endA > startB;
}

function clampPercent(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, value));
}

function estimateCategoryFromAdaCode(adaCode: string): string {
  const code = adaCode.toUpperCase();
  if (code.startsWith("D1") || code.startsWith("T1")) {
    return "preventive";
  }
  if (code.startsWith("D3") || code.startsWith("T3") || code.startsWith("D2")) {
    return "restorative";
  }
  if (code.startsWith("D33") || code.startsWith("D34")) {
    return "endodontic";
  }
  if (code.startsWith("D4")) {
    return "periodontal";
  }
  if (code.startsWith("D7")) {
    return "oralSurgery";
  }
  if (code.startsWith("D27")) {
    return "crowns";
  }
  if (code.startsWith("D5") || code.startsWith("D6")) {
    return "prosthodontics";
  }
  return "restorative";
}

function bucketByAge(entryDate: string): "0-30" | "31-60" | "61-90" | "over-90" {
  const now = Date.now();
  const ageDays = Math.floor(
    (now - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (ageDays <= 30) {
    return "0-30";
  }
  if (ageDays <= 60) {
    return "31-60";
  }
  if (ageDays <= 90) {
    return "61-90";
  }
  return "over-90";
}

export class ClinicOpsService {
  private readonly store: DentalStore;
  private readonly textCipher: TextCipher;
  private readonly repo: ClinicOpsRepository;

  constructor(
    store: DentalStore,
    textCipher: TextCipher,
    repo: ClinicOpsRepository
  ) {
    this.store = store;
    this.textCipher = textCipher;
    this.repo = repo;
  }

  async searchPatients(input: SearchPatientsInput): Promise<PatientRecord[]> {
    const q = (input.query || "").trim().toLowerCase();
    const last = (input.lastName || "").trim().toLowerCase();
    const first = (input.firstName || "").trim().toLowerCase();
    const phone = (input.phone || "").replace(/\D/g, "");
    const externalId = (input.externalId || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(200, input.limit || 50));

    const patients = await this.store.listPatients();
    const filtered = patients.filter((patient) => {
      if (q) {
        const haystack = [
          patient.firstName,
          patient.lastName,
          patient.phone || "",
          patient.email || "",
          patient.dateOfBirth,
          Object.values(patient.externalIds).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }

      if (last && !patient.lastName.toLowerCase().includes(last)) {
        return false;
      }
      if (first && !patient.firstName.toLowerCase().includes(first)) {
        return false;
      }
      if (input.dateOfBirth && patient.dateOfBirth !== input.dateOfBirth) {
        return false;
      }
      if (phone) {
        const p = (patient.phone || "").replace(/\D/g, "");
        if (!p.includes(phone)) {
          return false;
        }
      }
      if (externalId) {
        const ids = Object.values(patient.externalIds).join(" ").toLowerCase();
        if (!ids.includes(externalId)) {
          return false;
        }
      }
      return true;
    });

    return filtered.slice(0, limit);
  }

  async upsertFamily(input: UpsertFamilyInput): Promise<FamilyRecord> {
    const guarantor = await this.store.getPatient(input.guarantorPatientId);
    const member = await this.store.getPatient(input.memberPatientId);
    if (!guarantor || !member) {
      throw new Error("Guarantor and member must both exist");
    }

    const now = nowIso();
    let family: FamilyRecord | null = null;

    if (input.familyId) {
      family = await this.repo.findFamilyById(input.familyId);
    }

    if (!family) {
      family = await this.repo.findFamilyByGuarantor(input.guarantorPatientId);
    }

    if (!family) {
      family = {
        id: input.familyId || crypto.randomUUID(),
        guarantorPatientId: input.guarantorPatientId,
        members: [
          {
            patientId: input.guarantorPatientId,
            relationToGuarantor: "self",
            isGuarantor: true,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
    }

    const existingMember = family.members.find(
      (m) => m.patientId === input.memberPatientId
    );

    if (existingMember) {
      existingMember.relationToGuarantor = input.relationToGuarantor;
    } else {
      family.members.push({
        patientId: input.memberPatientId,
        relationToGuarantor: input.relationToGuarantor,
        isGuarantor: false,
      });
    }

    family.updatedAt = now;
    return this.repo.saveFamily(family);
  }

  async listFamilyByPatient(patientId: string): Promise<FamilyRecord | null> {
    return this.repo.findFamilyByPatient(patientId);
  }

  async upsertInsurancePlan(
    input: UpsertInsurancePlanInput
  ): Promise<InsurancePlanRecord> {
    const now = nowIso();
    const planId = input.planId || crypto.randomUUID();
    const existing = await this.repo.getInsurancePlan(planId);

    const normalizedBenefits = {
      preventive: clampPercent(input.benefitPercentages?.preventive, 100),
      restorative: clampPercent(input.benefitPercentages?.restorative, 80),
      endodontic: clampPercent(input.benefitPercentages?.endodontic, 80),
      periodontal: clampPercent(input.benefitPercentages?.periodontal, 80),
      oralSurgery: clampPercent(input.benefitPercentages?.oralSurgery, 80),
      crowns: clampPercent(input.benefitPercentages?.crowns, 50),
      prosthodontics: clampPercent(input.benefitPercentages?.prosthodontics, 50),
    };

    const plan: InsurancePlanRecord = {
      id: planId,
      patientId: input.patientId,
      tier: input.tier,
      carrier: input.carrier,
      employer: input.employer,
      subscriberName: input.subscriberName,
      subscriberId: input.subscriberId,
      relationToSubscriber: input.relationToSubscriber,
      groupName: input.groupName,
      groupNumber: input.groupNumber,
      annualMax: input.annualMax,
      deductible: input.deductible,
      benefitPercentages: normalizedBenefits,
      notes: input.notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    return this.repo.saveInsurancePlan(plan);
  }

  async listInsurancePlans(patientId: string): Promise<InsurancePlanRecord[]> {
    return this.repo.listInsurancePlansByPatient(patientId);
  }

  async createTreatmentPlan(
    input: CreateTreatmentPlanInput
  ): Promise<TreatmentPlanRecord> {
    const now = nowIso();
    const plan: TreatmentPlanRecord = {
      id: input.planId || crypto.randomUUID(),
      patientId: input.patientId,
      heading: input.heading,
      status: input.status || "active",
      signed: Boolean(input.signed),
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.saveTreatmentPlan(plan);
  }

  async addTreatmentPlanItem(
    input: AddTreatmentPlanItemInput
  ): Promise<TreatmentPlanItemRecord> {
    const plan = await this.repo.getTreatmentPlan(input.planId);
    if (!plan) {
      throw new Error(`Treatment plan ${input.planId} not found`);
    }

    const now = nowIso();
    const item: TreatmentPlanItemRecord = {
      id: input.itemId || crypto.randomUUID(),
      planId: input.planId,
      patientId: input.patientId,
      tooth: input.tooth,
      surface: input.surface,
      diagnosis: input.diagnosis,
      adaCode: input.adaCode,
      description: input.description,
      fee: input.fee,
      allowedFee: input.allowedFee,
      priority: input.priority || 0,
      status: "proposed",
      insuranceEstPrimary: 0,
      insuranceEstSecondary: 0,
      patientEst: input.fee,
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.saveTreatmentPlanItem(item);
  }

  async listTreatmentPlans(patientId: string): Promise<
    Array<{
      plan: TreatmentPlanRecord;
      items: TreatmentPlanItemRecord[];
    }>
  > {
    const plans = await this.repo.listTreatmentPlansByPatient(patientId);
    const rows = await Promise.all(
      plans.map(async (plan) => ({
        plan,
        items: await this.repo.listTreatmentPlanItemsByPlan(plan.id),
      }))
    );
    return rows;
  }

  async estimateTreatmentPlan(planId: string): Promise<{
    plan: TreatmentPlanRecord;
    items: TreatmentPlanItemRecord[];
    totals: {
      feeTotal: number;
      primaryEstimateTotal: number;
      secondaryEstimateTotal: number;
      patientEstimateTotal: number;
    };
  }> {
    const plan = await this.repo.getTreatmentPlan(planId);
    if (!plan) {
      throw new Error(`Treatment plan ${planId} not found`);
    }

    const insurance = await this.listInsurancePlans(plan.patientId);
    const primary = insurance.find((planItem) => planItem.tier === "primary");
    const secondary = insurance.find((planItem) => planItem.tier === "secondary");

    const sourceItems = await this.repo.listTreatmentPlanItemsByPlan(plan.id);
    const items = await Promise.all(
      sourceItems.map(async (item) => {
        const category = estimateCategoryFromAdaCode(item.adaCode);
        const allowed = typeof item.allowedFee === "number" ? item.allowedFee : item.fee;

        const primaryPct = clampPercent(primary?.benefitPercentages?.[category], 0);
        const primaryEstimate = (allowed * primaryPct) / 100;

        const remainingAfterPrimary = Math.max(0, allowed - primaryEstimate);
        const secondaryPct = clampPercent(
          secondary?.benefitPercentages?.[category],
          0
        );
        const secondaryEstimate = (remainingAfterPrimary * secondaryPct) / 100;

        const patientEstimate = Math.max(
          0,
          item.fee - primaryEstimate - secondaryEstimate
        );

        const updated: TreatmentPlanItemRecord = {
          ...item,
          insuranceEstPrimary: Number(primaryEstimate.toFixed(2)),
          insuranceEstSecondary: Number(secondaryEstimate.toFixed(2)),
          patientEst: Number(patientEstimate.toFixed(2)),
          updatedAt: nowIso(),
        };

        return this.repo.saveTreatmentPlanItem(updated);
      })
    );

    const totals = items.reduce(
      (acc, item) => {
        acc.feeTotal += item.fee;
        acc.primaryEstimateTotal += item.insuranceEstPrimary;
        acc.secondaryEstimateTotal += item.insuranceEstSecondary;
        acc.patientEstimateTotal += item.patientEst;
        return acc;
      },
      {
        feeTotal: 0,
        primaryEstimateTotal: 0,
        secondaryEstimateTotal: 0,
        patientEstimateTotal: 0,
      }
    );

    totals.feeTotal = Number(totals.feeTotal.toFixed(2));
    totals.primaryEstimateTotal = Number(totals.primaryEstimateTotal.toFixed(2));
    totals.secondaryEstimateTotal = Number(totals.secondaryEstimateTotal.toFixed(2));
    totals.patientEstimateTotal = Number(totals.patientEstimateTotal.toFixed(2));

    return {
      plan,
      items,
      totals,
    };
  }

  async postLedgerEntry(input: PostLedgerEntryInput): Promise<LedgerEntryRecord> {
    const entry: LedgerEntryRecord = {
      id: crypto.randomUUID(),
      patientId: input.patientId,
      familyId: input.familyId,
      type: input.type,
      amount: Number(input.amount.toFixed(2)),
      description: input.description,
      entryDate: input.entryDate || nowIso(),
      relatedPlanItemId: input.relatedPlanItemId,
      claimStatus: input.claimStatus,
      createdBy: input.createdBy,
      createdAt: nowIso(),
    };

    return this.repo.saveLedgerEntry(entry);
  }

  async getAccountSnapshot(patientId: string): Promise<{
    entries: LedgerEntryRecord[];
    aging: Record<"0-30" | "31-60" | "61-90" | "over-90", number>;
    totals: {
      charges: number;
      credits: number;
      pendingInsurance: number;
      estimatedBalance: number;
    };
  }> {
    const entries = await this.repo.listLedgerEntriesByPatient(patientId);

    const aging = {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "over-90": 0,
    };

    let charges = 0;
    let credits = 0;
    let pendingInsurance = 0;

    for (const entry of entries) {
      if (entry.type === "charge" || entry.type === "adjustment") {
        charges += entry.amount;
        const bucket = bucketByAge(entry.entryDate);
        aging[bucket] += entry.amount;
      } else if (entry.type === "payment" || entry.type === "insurance-payment") {
        credits += entry.amount;
      } else if (entry.type === "claim") {
        pendingInsurance += entry.amount;
      }
    }

    return {
      entries,
      aging: {
        "0-30": Number(aging["0-30"].toFixed(2)),
        "31-60": Number(aging["31-60"].toFixed(2)),
        "61-90": Number(aging["61-90"].toFixed(2)),
        "over-90": Number(aging["over-90"].toFixed(2)),
      },
      totals: {
        charges: Number(charges.toFixed(2)),
        credits: Number(credits.toFixed(2)),
        pendingInsurance: Number(pendingInsurance.toFixed(2)),
        estimatedBalance: Number((charges - credits - pendingInsurance).toFixed(2)),
      },
    };
  }

  async addChartEntry(input: AddChartEntryInput): Promise<ChartEntryRecord> {
    const entry: ChartEntryRecord = {
      id: crypto.randomUUID(),
      patientId: input.patientId,
      entryDate: input.entryDate || nowIso(),
      tooth: input.tooth,
      surface: input.surface,
      diagnosis: input.diagnosis,
      procedureCode: input.procedureCode,
      note: input.note,
      provider: input.provider,
      createdAt: nowIso(),
    };

    return this.repo.saveChartEntry(entry);
  }

  async listChartEntries(patientId: string): Promise<ChartEntryRecord[]> {
    return this.repo.listChartEntriesByPatient(patientId);
  }

  async upsertRecall(input: UpsertRecallInput): Promise<RecallRecord> {
    const now = nowIso();
    const dueDate =
      input.dueDate ||
      (input.lastVisitDate
        ? addMonths(input.lastVisitDate, input.intervalMonths)
        : addMonths(now, input.intervalMonths));

    const recall: RecallRecord = {
      id: input.recallId || crypto.randomUUID(),
      patientId: input.patientId,
      recallType: input.recallType,
      intervalMonths: input.intervalMonths,
      lastVisitDate: input.lastVisitDate,
      dueDate,
      status: input.status || "due",
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.saveRecall(recall);
  }

  async listRecallDue(fromDate: string, toDate: string): Promise<RecallRecord[]> {
    const from = startOfDayIso(fromDate);
    const to = endOfDayIso(toDate);
    return this.repo.listRecallsDue(from, to);
  }

  async upsertScheduleBlock(
    input: UpsertScheduleBlockInput
  ): Promise<ScheduleBlockRecord> {
    const now = nowIso();
    const block: ScheduleBlockRecord = {
      id: input.blockId || crypto.randomUUID(),
      provider: input.provider,
      operatory: input.operatory,
      startAt: input.startAt,
      endAt: input.endAt,
      blockType: input.blockType,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.saveScheduleBlock(block);
  }

  private createTimeSlots(
    startIso: string,
    endIso: string,
    durationMinutes: number,
    intervalMinutes: number
  ): Array<{ startAt: string; endAt: string }> {
    const slots: Array<{ startAt: string; endAt: string }> = [];
    const durationMs = durationMinutes * 60 * 1000;
    const intervalMs = intervalMinutes * 60 * 1000;
    let cursor = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();

    while (cursor + durationMs <= end) {
      const slotStart = new Date(cursor).toISOString();
      const slotEnd = new Date(cursor + durationMs).toISOString();
      slots.push({ startAt: slotStart, endAt: slotEnd });
      cursor += intervalMs;
    }

    return slots;
  }

  async findOpenSlots(
    input: FindOpenSlotsInput
  ): Promise<Array<{ startAt: string; endAt: string }>> {
    const dayStart = `${input.date}T00:00:00.000Z`;
    const dayEnd = `${input.date}T23:59:59.999Z`;
    const startHour = typeof input.startHour === "number" ? input.startHour : 8;
    const endHour = typeof input.endHour === "number" ? input.endHour : 17;
    const intervalMinutes = input.intervalMinutes || 15;

    const rangeStart = `${input.date}T${String(startHour).padStart(2, "0")}:00:00.000Z`;
    const rangeEnd = `${input.date}T${String(endHour).padStart(2, "0")}:00:00.000Z`;

    const baseSlots = this.createTimeSlots(
      rangeStart,
      rangeEnd,
      input.durationMinutes,
      intervalMinutes
    );

    const appointments = await this.store.listAppointmentsByRange(
      dayStart,
      dayEnd,
      input.provider
    );

    const providerBlocks = await this.repo.listScheduleBlocksByProviderInRange(
      input.provider,
      dayStart,
      dayEnd
    );

    const availableBlocks = providerBlocks.filter(
      (block) => block.blockType === "available"
    );
    const blockingBlocks = providerBlocks.filter((block) =>
      ["booked", "break", "hold"].includes(block.blockType)
    );

    return baseSlots.filter((slot) => {
      if (
        availableBlocks.length > 0 &&
        !availableBlocks.some(
          (block) => slot.startAt >= block.startAt && slot.endAt <= block.endAt
        )
      ) {
        return false;
      }

      if (
        appointments.some((appointment) =>
          overlap(slot.startAt, slot.endAt, appointment.startAt, appointment.endAt)
        )
      ) {
        return false;
      }

      if (
        blockingBlocks.some((block) =>
          overlap(slot.startAt, slot.endAt, block.startAt, block.endAt)
        )
      ) {
        return false;
      }

      return true;
    });
  }

  async bookAppointmentFromSlot(input: {
    patientId: string;
    provider: string;
    reason: string;
    startAt: string;
    endAt: string;
    operatory?: string;
  }): Promise<{
    appointment: AppointmentRecord;
    scheduleBlock: ScheduleBlockRecord;
  }> {
    const appointment = await this.store.createAppointment({
      patientId: input.patientId,
      provider: input.provider,
      reason: input.reason,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "scheduled",
    });

    const scheduleBlock = await this.upsertScheduleBlock({
      provider: input.provider,
      operatory: input.operatory,
      startAt: input.startAt,
      endAt: input.endAt,
      blockType: "booked",
      patientId: input.patientId,
      appointmentId: appointment.id,
      notes: input.reason,
    });

    return { appointment, scheduleBlock };
  }

  async addCommunicationLog(
    input: AddCommunicationLogInput
  ): Promise<CommunicationLogRecord> {
    const log: CommunicationLogRecord = {
      id: crypto.randomUUID(),
      patientId: input.patientId,
      communicationType: input.communicationType,
      direction: input.direction,
      noteCiphertext: this.textCipher.encrypt(input.note),
      createdBy: input.createdBy,
      createdAt: nowIso(),
    };

    return this.repo.saveCommunicationLog(log);
  }

  async listCommunicationLogs(
    patientId: string
  ): Promise<Array<CommunicationLogRecord & { note: string }>> {
    const logs = await this.repo.listCommunicationLogsByPatient(patientId);
    return logs.map((log) => ({
      ...log,
      note: this.textCipher.decrypt(log.noteCiphertext),
    }));
  }

  async upsertTask(input: UpsertTaskInput): Promise<TaskRecord> {
    const now = nowIso();
    const existing = input.taskId ? await this.repo.getTask(input.taskId) : null;
    const task: TaskRecord = {
      id: input.taskId || crypto.randomUUID(),
      patientId: input.patientId,
      title: input.title,
      detailsCiphertext:
        typeof input.details === "string"
          ? this.textCipher.encrypt(input.details)
          : existing?.detailsCiphertext,
      assignedTo: input.assignedTo,
      dueAt: input.dueAt,
      priority: input.priority || existing?.priority || "medium",
      status: input.status || existing?.status || "open",
      createdBy: existing?.createdBy || input.actorUserId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    return this.repo.saveTask(task);
  }

  async listTasks(input: {
    status?: TaskStatus;
    assignedTo?: string;
    limit?: number;
  }): Promise<Array<TaskRecord & { details?: string }>> {
    const limit = Math.max(1, Math.min(200, input.limit || 50));
    const tasks = await this.repo.listTasks({
      status: input.status,
      assignedTo: input.assignedTo,
      limit,
    });

    return tasks.map((task) => ({
      ...task,
      details: task.detailsCiphertext
        ? this.textCipher.decrypt(task.detailsCiphertext)
        : undefined,
    }));
  }

  async getDashboard(date: string): Promise<{
    date: string;
    schedule: AppointmentRecord[];
    recallsDue: RecallRecord[];
    openTasks: number;
    urgentTasks: number;
  }> {
    const start = startOfDayIso(date);
    const end = endOfDayIso(date);
    const appointments = await this.store.listAppointmentsByRange(start, end);
    const recallsDue = await this.listRecallDue(date, date);
    const tasks = await this.listTasks({ status: "open", limit: 500 });

    return {
      date,
      schedule: appointments,
      recallsDue,
      openTasks: tasks.length,
      urgentTasks: tasks.filter((task) => task.priority === "urgent").length,
    };
  }

  async importOpenDentalSnapshot(
    snapshot: OpenDentalSnapshot,
    actor: Actor
  ): Promise<{
    patientsImported: number;
    appointmentsImported: number;
    insurancePlansImported: number;
    treatmentPlansImported: number;
    treatmentPlanItemsImported: number;
    ledgerEntriesImported: number;
    actor: string;
  }> {
    const patientMap = new Map<string, string>();

    let patientsImported = 0;
    let appointmentsImported = 0;
    let insurancePlansImported = 0;
    let treatmentPlansImported = 0;
    let treatmentPlanItemsImported = 0;
    let ledgerEntriesImported = 0;

    for (const patient of snapshot.patients || []) {
      const saved = await this.store.upsertPatient({
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.birthdate,
        phone: patient.phone,
        email: patient.email,
        externalIds: {
          opendental_patnum: patient.patNum,
          ...(patient.chartNumber
            ? { opendental_chartnumber: patient.chartNumber }
            : {}),
        },
      });
      patientMap.set(patient.patNum, saved.id);
      patientsImported += 1;
    }

    for (const patient of snapshot.patients || []) {
      if (!patient.guarantorPatNum || patient.guarantorPatNum === patient.patNum) {
        continue;
      }
      const guarantorId = patientMap.get(patient.guarantorPatNum);
      const memberId = patientMap.get(patient.patNum);
      if (guarantorId && memberId) {
        await this.upsertFamily({
          guarantorPatientId: guarantorId,
          memberPatientId: memberId,
          relationToGuarantor: "family",
        });
      }
    }

    for (const appointment of snapshot.appointments || []) {
      const patientId = patientMap.get(appointment.patNum);
      if (!patientId) {
        continue;
      }
      await this.store.createAppointment({
        patientId,
        provider: appointment.provider,
        reason: appointment.reason,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        status: appointment.status || "scheduled",
      });
      appointmentsImported += 1;
    }

    for (const plan of snapshot.insurancePlans || []) {
      const patientId = patientMap.get(plan.patNum);
      if (!patientId) {
        continue;
      }
      await this.upsertInsurancePlan({
        patientId,
        tier: plan.tier,
        carrier: plan.carrier,
        subscriberName: plan.subscriberName,
        subscriberId: plan.subscriberId,
        relationToSubscriber: plan.relationToSubscriber,
        groupName: plan.groupName,
        groupNumber: plan.groupNumber,
        annualMax: plan.annualMax,
        deductible: plan.deductible,
        benefitPercentages: {
          preventive: plan.preventive || 100,
          restorative: plan.restorative || 80,
          endodontic: plan.endodontic || 80,
          periodontal: plan.periodontal || 80,
          oralSurgery: plan.oralSurgery || 80,
          crowns: plan.crowns || 50,
          prosthodontics: plan.prosthodontics || 50,
        },
      });
      insurancePlansImported += 1;
    }

    for (const plan of snapshot.treatmentPlans || []) {
      const patientId = patientMap.get(plan.patNum);
      if (!patientId) {
        continue;
      }
      const saved = await this.createTreatmentPlan({
        patientId,
        heading: plan.heading,
        status: plan.status || "active",
        signed: plan.signed,
      });
      treatmentPlansImported += 1;

      for (const item of plan.items || []) {
        await this.addTreatmentPlanItem({
          planId: saved.id,
          patientId,
          tooth: item.tooth,
          surface: item.surface,
          diagnosis: item.diagnosis,
          adaCode: item.adaCode,
          description: item.description,
          fee: item.fee,
          allowedFee: item.allowedFee,
          priority: item.priority,
        });
        treatmentPlanItemsImported += 1;
      }

      await this.estimateTreatmentPlan(saved.id);
    }

    for (const entry of snapshot.ledgerEntries || []) {
      const patientId = patientMap.get(entry.patNum);
      if (!patientId) {
        continue;
      }

      await this.postLedgerEntry({
        patientId,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        entryDate: entry.entryDate,
        claimStatus: entry.claimStatus,
        createdBy: actor.userId,
      });
      ledgerEntriesImported += 1;
    }

    return {
      patientsImported,
      appointmentsImported,
      insurancePlansImported,
      treatmentPlansImported,
      treatmentPlanItemsImported,
      ledgerEntriesImported,
      actor: actor.userId,
    };
  }
}
