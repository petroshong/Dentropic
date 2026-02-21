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

function overlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && endA > startB;
}

export class MemoryClinicOpsRepository implements ClinicOpsRepository {
  private readonly families = new Map<string, FamilyRecord>();
  private readonly insurancePlans = new Map<string, InsurancePlanRecord>();
  private readonly treatmentPlans = new Map<string, TreatmentPlanRecord>();
  private readonly treatmentPlanItems = new Map<string, TreatmentPlanItemRecord>();
  private readonly ledgerEntries = new Map<string, LedgerEntryRecord>();
  private readonly chartEntries = new Map<string, ChartEntryRecord>();
  private readonly recalls = new Map<string, RecallRecord>();
  private readonly scheduleBlocks = new Map<string, ScheduleBlockRecord>();
  private readonly communicationLogs = new Map<string, CommunicationLogRecord>();
  private readonly tasks = new Map<string, TaskRecord>();

  async findFamilyById(familyId: string): Promise<FamilyRecord | null> {
    return this.families.get(familyId) || null;
  }

  async findFamilyByGuarantor(
    guarantorPatientId: string
  ): Promise<FamilyRecord | null> {
    return (
      Array.from(this.families.values()).find(
        (family) => family.guarantorPatientId === guarantorPatientId
      ) || null
    );
  }

  async findFamilyByPatient(patientId: string): Promise<FamilyRecord | null> {
    return (
      Array.from(this.families.values()).find((family) =>
        family.members.some((member) => member.patientId === patientId)
      ) || null
    );
  }

  async saveFamily(family: FamilyRecord): Promise<FamilyRecord> {
    this.families.set(family.id, family);
    return family;
  }

  async getInsurancePlan(planId: string): Promise<InsurancePlanRecord | null> {
    return this.insurancePlans.get(planId) || null;
  }

  async saveInsurancePlan(plan: InsurancePlanRecord): Promise<InsurancePlanRecord> {
    this.insurancePlans.set(plan.id, plan);
    return plan;
  }

  async listInsurancePlansByPatient(
    patientId: string
  ): Promise<InsurancePlanRecord[]> {
    return Array.from(this.insurancePlans.values())
      .filter((plan) => plan.patientId === patientId)
      .sort((a, b) => a.tier.localeCompare(b.tier));
  }

  async saveTreatmentPlan(plan: TreatmentPlanRecord): Promise<TreatmentPlanRecord> {
    this.treatmentPlans.set(plan.id, plan);
    return plan;
  }

  async getTreatmentPlan(planId: string): Promise<TreatmentPlanRecord | null> {
    return this.treatmentPlans.get(planId) || null;
  }

  async listTreatmentPlansByPatient(
    patientId: string
  ): Promise<TreatmentPlanRecord[]> {
    return Array.from(this.treatmentPlans.values())
      .filter((plan) => plan.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveTreatmentPlanItem(
    item: TreatmentPlanItemRecord
  ): Promise<TreatmentPlanItemRecord> {
    this.treatmentPlanItems.set(item.id, item);
    return item;
  }

  async listTreatmentPlanItemsByPlan(
    planId: string
  ): Promise<TreatmentPlanItemRecord[]> {
    return Array.from(this.treatmentPlanItems.values())
      .filter((item) => item.planId === planId)
      .sort((a, b) => a.priority - b.priority);
  }

  async saveLedgerEntry(entry: LedgerEntryRecord): Promise<LedgerEntryRecord> {
    this.ledgerEntries.set(entry.id, entry);
    return entry;
  }

  async listLedgerEntriesByPatient(patientId: string): Promise<LedgerEntryRecord[]> {
    return Array.from(this.ledgerEntries.values())
      .filter((entry) => entry.patientId === patientId)
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  }

  async saveChartEntry(entry: ChartEntryRecord): Promise<ChartEntryRecord> {
    this.chartEntries.set(entry.id, entry);
    return entry;
  }

  async listChartEntriesByPatient(patientId: string): Promise<ChartEntryRecord[]> {
    return Array.from(this.chartEntries.values())
      .filter((entry) => entry.patientId === patientId)
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }

  async saveRecall(recall: RecallRecord): Promise<RecallRecord> {
    this.recalls.set(recall.id, recall);
    return recall;
  }

  async listRecallsDue(fromIso: string, toIso: string): Promise<RecallRecord[]> {
    return Array.from(this.recalls.values())
      .filter((recall) => recall.dueDate >= fromIso && recall.dueDate <= toIso)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async saveScheduleBlock(
    block: ScheduleBlockRecord
  ): Promise<ScheduleBlockRecord> {
    this.scheduleBlocks.set(block.id, block);
    return block;
  }

  async listScheduleBlocksByProviderInRange(
    provider: string,
    startIso: string,
    endIso: string
  ): Promise<ScheduleBlockRecord[]> {
    return Array.from(this.scheduleBlocks.values())
      .filter((block) => block.provider === provider)
      .filter((block) => overlap(block.startAt, block.endAt, startIso, endIso))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  async saveCommunicationLog(
    log: CommunicationLogRecord
  ): Promise<CommunicationLogRecord> {
    this.communicationLogs.set(log.id, log);
    return log;
  }

  async listCommunicationLogsByPatient(
    patientId: string
  ): Promise<CommunicationLogRecord[]> {
    return Array.from(this.communicationLogs.values())
      .filter((log) => log.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTask(taskId: string): Promise<TaskRecord | null> {
    return this.tasks.get(taskId) || null;
  }

  async saveTask(task: TaskRecord): Promise<TaskRecord> {
    this.tasks.set(task.id, task);
    return task;
  }

  async listTasks(filter: ListTasksFilter): Promise<TaskRecord[]> {
    return Array.from(this.tasks.values())
      .filter((task) => (filter.status ? task.status === filter.status : true))
      .filter((task) =>
        filter.assignedTo ? task.assignedTo === filter.assignedTo : true
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, filter.limit);
  }
}
