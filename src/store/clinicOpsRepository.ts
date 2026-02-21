import type {
  ChartEntryRecord,
  CommunicationLogRecord,
  FamilyRecord,
  InsurancePlanRecord,
  LedgerEntryRecord,
  RecallRecord,
  ScheduleBlockRecord,
  TaskRecord,
  TaskStatus,
  TreatmentPlanItemRecord,
  TreatmentPlanRecord,
} from "../domain.js";

export interface ListTasksFilter {
  status?: TaskStatus;
  assignedTo?: string;
  limit: number;
}

export interface ClinicOpsRepository {
  findFamilyById(familyId: string): Promise<FamilyRecord | null>;
  findFamilyByGuarantor(guarantorPatientId: string): Promise<FamilyRecord | null>;
  findFamilyByPatient(patientId: string): Promise<FamilyRecord | null>;
  saveFamily(family: FamilyRecord): Promise<FamilyRecord>;

  getInsurancePlan(planId: string): Promise<InsurancePlanRecord | null>;
  saveInsurancePlan(plan: InsurancePlanRecord): Promise<InsurancePlanRecord>;
  listInsurancePlansByPatient(patientId: string): Promise<InsurancePlanRecord[]>;

  saveTreatmentPlan(plan: TreatmentPlanRecord): Promise<TreatmentPlanRecord>;
  getTreatmentPlan(planId: string): Promise<TreatmentPlanRecord | null>;
  listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlanRecord[]>;

  saveTreatmentPlanItem(
    item: TreatmentPlanItemRecord
  ): Promise<TreatmentPlanItemRecord>;
  listTreatmentPlanItemsByPlan(planId: string): Promise<TreatmentPlanItemRecord[]>;

  saveLedgerEntry(entry: LedgerEntryRecord): Promise<LedgerEntryRecord>;
  listLedgerEntriesByPatient(patientId: string): Promise<LedgerEntryRecord[]>;

  saveChartEntry(entry: ChartEntryRecord): Promise<ChartEntryRecord>;
  listChartEntriesByPatient(patientId: string): Promise<ChartEntryRecord[]>;

  saveRecall(recall: RecallRecord): Promise<RecallRecord>;
  listRecallsDue(fromIso: string, toIso: string): Promise<RecallRecord[]>;

  saveScheduleBlock(block: ScheduleBlockRecord): Promise<ScheduleBlockRecord>;
  listScheduleBlocksByProviderInRange(
    provider: string,
    startIso: string,
    endIso: string
  ): Promise<ScheduleBlockRecord[]>;

  saveCommunicationLog(log: CommunicationLogRecord): Promise<CommunicationLogRecord>;
  listCommunicationLogsByPatient(patientId: string): Promise<CommunicationLogRecord[]>;

  getTask(taskId: string): Promise<TaskRecord | null>;
  saveTask(task: TaskRecord): Promise<TaskRecord>;
  listTasks(filter: ListTasksFilter): Promise<TaskRecord[]>;
}
