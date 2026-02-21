import { MCPServer, object } from "mcp-use/server";
import { z } from "zod";
import { loadConfig } from "./src/config.js";
import type {
  Actor,
  AppointmentStatus,
  CommunicationDirection,
  CommunicationType,
  DentalModality,
  InsuranceTier,
  LedgerEntryType,
  RiskLevel,
  TaskPriority,
  TaskStatus,
  TreatmentPlanStatus,
  UserRole,
} from "./src/domain.js";
import { DentalImageAnalyzer } from "./src/services/aiImageAnalysis.js";
import {
  type OpenDentalSnapshot,
  type SearchPatientsInput,
  ClinicOpsService,
} from "./src/services/clinicOps.js";
import { assertAuthorized, requirePurpose, type Permission } from "./src/security/auth.js";
import { AuditLog } from "./src/security/audit.js";
import { createTextCipher } from "./src/security/crypto.js";
import { createClinicOpsRepository } from "./src/store/createClinicOpsRepository.js";
import { createDentalStore } from "./src/store/createStore.js";

const config = loadConfig();
const store = createDentalStore(config);
const clinicOpsRepository = createClinicOpsRepository(config);
const textCipher = createTextCipher(config.phiEncryptionKey);
const clinicOps = new ClinicOpsService(store, textCipher, clinicOpsRepository);
const auditLog = new AuditLog();
const imageAnalyzer = new DentalImageAnalyzer({
  apiKey: config.openaiApiKey,
  model: config.dentalImageModel,
  baseUrl: config.openaiBaseUrl,
});

const server = new MCPServer({
  name: config.serverName,
  title: config.serverTitle,
  version: "1.0.0",
  description: config.serverDescription,
  baseUrl: config.baseUrl,
  favicon: "favicon.ico",
  websiteUrl: config.websiteUrl,
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

const userRoles: UserRole[] = [
  "admin",
  "dentist",
  "hygienist",
  "assistant",
  "front-desk",
  "billing",
  "readonly",
  "system",
];

const actorSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(userRoles),
  purpose: z.string().optional(),
});

const modalityValues: DentalModality[] = [
  "bitewing",
  "periapical",
  "panoramic",
  "cbct",
  "intraoral-photo",
];

const appointmentStatusValues: AppointmentStatus[] = [
  "scheduled",
  "checked-in",
  "completed",
  "cancelled",
];

const riskLevelValues: RiskLevel[] = ["low", "moderate", "high"];
const insuranceTierValues: InsuranceTier[] = ["primary", "secondary"];
const treatmentPlanStatusValues: TreatmentPlanStatus[] = [
  "active",
  "accepted",
  "completed",
  "archived",
];
const ledgerEntryTypeValues: LedgerEntryType[] = [
  "charge",
  "payment",
  "adjustment",
  "claim",
  "insurance-payment",
];
const communicationTypes: CommunicationType[] = [
  "text",
  "email",
  "phone",
  "letter",
  "in-person",
];
const communicationDirections: CommunicationDirection[] = [
  "inbound",
  "outbound",
];
const taskPriorityValues: TaskPriority[] = ["low", "medium", "high", "urgent"];
const taskStatusValues: TaskStatus[] = ["open", "in-progress", "done"];

type ToolRunOptions = {
  actor: Actor;
  permission: Permission;
  action: string;
  resourceType: string;
  resourceId?: string;
  requirePurposeOnRead?: boolean;
  metadata?: Record<string, unknown>;
};

function metadataToStrings(
  metadata: Record<string, unknown> | undefined
): Record<string, string> {
  if (!metadata) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, String(value)])
  );
}

async function runWithAuthAudit<T>(
  options: ToolRunOptions,
  fn: () => Promise<T>
): Promise<T> {
  assertAuthorized(options.actor, options.permission);

  if (options.requirePurposeOnRead && config.requirePurposeOnSensitiveReads) {
    requirePurpose(options.actor, "sensitive read operation");
  }

  try {
    const result = await fn();
    auditLog.log({
      actor: options.actor,
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      success: true,
      metadata: metadataToStrings(options.metadata),
    });
    return result;
  } catch (error) {
    auditLog.log({
      actor: options.actor,
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      success: false,
      reason: error instanceof Error ? error.message : String(error),
      metadata: metadataToStrings(options.metadata),
    });
    throw error;
  }
}

function redactPatientForRole(actor: Actor, patient: Record<string, unknown>) {
  if (["admin", "dentist", "hygienist", "assistant", "front-desk", "billing", "system"].includes(actor.role)) {
    return patient;
  }

  return {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
  };
}

server.tool(
  {
    name: "system-readiness",
    description:
      "Check Dental MCP readiness including backend mode, model status, and HIPAA guardrails.",
    schema: z.object({}),
  },
  async () => {
    return object({
      serverName: config.serverName,
      baseUrl: config.baseUrl,
      dataBackend: config.dataBackend,
      cloudflareConfigured: Boolean(
        config.cloudflareAccountId &&
          config.cloudflareDatabaseId &&
          config.cloudflareApiToken
      ),
      modelConfigured: Boolean(config.openaiApiKey),
      phiEncryptionEnabled: textCipher.enabled,
      requirePurposeOnSensitiveReads: config.requirePurposeOnSensitiveReads,
    });
  }
);

server.tool(
  {
    name: "upsert-patient",
    description:
      "Create or update patient demographics (OpenDental replacement for patient info management).",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string().optional(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      dateOfBirth: z.string().describe("YYYY-MM-DD"),
      phone: z.string().optional(),
      email: z.string().optional(),
      insuranceCarrier: z.string().optional(),
      metadata: z.record(z.string(), z.string()).optional(),
      externalIds: z.record(z.string(), z.string()).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const patient = await runWithAuthAudit(
      {
        actor,
        permission: "patient:write",
        action: "upsert-patient",
        resourceType: "patient",
        resourceId: input.patientId,
      },
      () => store.upsertPatient(input)
    );

    return object({
      patient,
      dataBackend: config.dataBackend,
    });
  }
);

server.tool(
  {
    name: "search-patients",
    description:
      "Search patient list by name, phone, DOB, or external IDs (Select Patient equivalent).",
    schema: z.object({
      actor: actorSchema,
      query: z.string().optional(),
      lastName: z.string().optional(),
      firstName: z.string().optional(),
      phone: z.string().optional(),
      dateOfBirth: z.string().optional(),
      externalId: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const patients = await runWithAuthAudit(
      {
        actor,
        permission: "patient:read",
        action: "search-patients",
        resourceType: "patient",
        requirePurposeOnRead: true,
        metadata: { q: input.query || "" },
      },
      () => clinicOps.searchPatients(input as SearchPatientsInput)
    );

    return object({
      count: patients.length,
      patients: patients.map((patient) =>
        redactPatientForRole(actor, patient as unknown as Record<string, unknown>)
      ),
    });
  }
);

server.tool(
  {
    name: "upsert-family-member",
    description:
      "Link a patient into a family/guarantor record (Family module equivalent).",
    schema: z.object({
      actor: actorSchema,
      familyId: z.string().optional(),
      guarantorPatientId: z.string(),
      memberPatientId: z.string(),
      relationToGuarantor: z.string(),
    }),
  },
  async ({ actor, ...input }) => {
    const family = await runWithAuthAudit(
      {
        actor,
        permission: "patient:write",
        action: "upsert-family-member",
        resourceType: "family",
        resourceId: input.familyId,
      },
      () => clinicOps.upsertFamily(input)
    );

    return object({ family });
  }
);

server.tool(
  {
    name: "schedule-appointment",
    description:
      "Create an appointment record for a patient.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
      provider: z.string(),
      reason: z.string(),
      startAt: z.string().describe("ISO-8601"),
      endAt: z.string().describe("ISO-8601"),
      status: z.enum(appointmentStatusValues).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const appointment = await runWithAuthAudit(
      {
        actor,
        permission: "appointment:write",
        action: "schedule-appointment",
        resourceType: "appointment",
      },
      async () => {
        const patient = await store.getPatient(input.patientId);
        if (!patient) {
          throw new Error(`Patient ${input.patientId} not found`);
        }
        return store.createAppointment(input);
      }
    );

    return object({ appointment });
  }
);

server.tool(
  {
    name: "set-appointment-status",
    description: "Update appointment status (checked-in/completed/cancelled).",
    schema: z.object({
      actor: actorSchema,
      appointmentId: z.string(),
      status: z.enum(appointmentStatusValues),
    }),
  },
  async ({ actor, appointmentId, status }) => {
    const appointment = await runWithAuthAudit(
      {
        actor,
        permission: "appointment:write",
        action: "set-appointment-status",
        resourceType: "appointment",
        resourceId: appointmentId,
      },
      () => store.updateAppointmentStatus(appointmentId, status)
    );

    if (!appointment) {
      throw new Error(`Appointment ${appointmentId} not found`);
    }

    return object({ appointment });
  }
);

server.tool(
  {
    name: "add-provider-schedule-block",
    description:
      "Add schedule block for a provider/operatory (available/booked/break/hold).",
    schema: z.object({
      actor: actorSchema,
      blockId: z.string().optional(),
      provider: z.string(),
      operatory: z.string().optional(),
      startAt: z.string().describe("ISO-8601"),
      endAt: z.string().describe("ISO-8601"),
      blockType: z.enum(["available", "booked", "break", "hold"]),
      patientId: z.string().optional(),
      appointmentId: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const block = await runWithAuthAudit(
      {
        actor,
        permission: "appointment:write",
        action: "add-provider-schedule-block",
        resourceType: "schedule-block",
        resourceId: input.blockId,
      },
      async () => clinicOps.upsertScheduleBlock(input)
    );

    return object({ block });
  }
);

server.tool(
  {
    name: "find-open-slots",
    description:
      "Find open slots for a provider on a date, considering appointments and blocking schedule.",
    schema: z.object({
      actor: actorSchema,
      provider: z.string(),
      date: z.string().describe("YYYY-MM-DD"),
      durationMinutes: z.number().int().min(5).max(480),
      intervalMinutes: z.number().int().min(5).max(60).optional(),
      startHour: z.number().int().min(0).max(23).optional(),
      endHour: z.number().int().min(1).max(24).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const slots = await runWithAuthAudit(
      {
        actor,
        permission: "appointment:read",
        action: "find-open-slots",
        resourceType: "schedule",
      },
      () => clinicOps.findOpenSlots(input)
    );

    return object({
      provider: input.provider,
      date: input.date,
      durationMinutes: input.durationMinutes,
      slotCount: slots.length,
      slots,
    });
  }
);

server.tool(
  {
    name: "book-appointment-slot",
    description:
      "Book an appointment directly from an available slot and mark it as booked in schedule blocks.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
      provider: z.string(),
      reason: z.string(),
      startAt: z.string().describe("ISO-8601"),
      endAt: z.string().describe("ISO-8601"),
      operatory: z.string().optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const booking = await runWithAuthAudit(
      {
        actor,
        permission: "appointment:write",
        action: "book-appointment-slot",
        resourceType: "appointment",
      },
      () => clinicOps.bookAppointmentFromSlot(input)
    );

    return object(booking);
  }
);

server.tool(
  {
    name: "ingest-dental-image",
    description:
      "Register a dental image and modality for analysis workflow.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
      modality: z.enum(modalityValues),
      imageUrl: z.string().url(),
      capturedAt: z.string().optional(),
      toothNumbers: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const image = await runWithAuthAudit(
      {
        actor,
        permission: "image:write",
        action: "ingest-dental-image",
        resourceType: "image",
      },
      async () => {
        const patient = await store.getPatient(input.patientId);
        if (!patient) {
          throw new Error(`Patient ${input.patientId} not found`);
        }
        return store.createDentalImage(input);
      }
    );

    return object({ image });
  }
);

server.tool(
  {
    name: "analyze-dental-image",
    description:
      "Analyze dental imagery with model-backed triage when configured; otherwise rule-based fallback.",
    schema: z.object({
      actor: actorSchema,
      imageId: z.string(),
      clinicalContext: z.string().optional(),
    }),
    outputSchema: z.object({
      imageId: z.string(),
      riskLevel: z.enum(riskLevelValues),
      summary: z.string(),
      findings: z.array(
        z.object({
          code: z.string(),
          label: z.string(),
          summary: z.string(),
          confidence: z.number(),
          risk: z.enum(riskLevelValues),
          toothNumbers: z.array(z.string()),
        })
      ),
      analyzedAt: z.string(),
      source: z.enum(["model", "rule"]),
    }),
  },
  async ({ actor, imageId, clinicalContext }) => {
    const result = await runWithAuthAudit(
      {
        actor,
        permission: "image:analyze",
        action: "analyze-dental-image",
        resourceType: "image",
        resourceId: imageId,
      },
      async () => {
        const image = await store.getDentalImage(imageId);
        if (!image) {
          throw new Error(`Image ${imageId} not found`);
        }

        const analyzed = await imageAnalyzer.analyze({
          image,
          clinicalContext,
        });

        const updatedImage = await store.saveImageAnalysis({
          imageId,
          findings: analyzed.findings,
          riskLevel: analyzed.riskLevel,
        });

        return {
          imageId,
          riskLevel: analyzed.riskLevel,
          summary: analyzed.summary,
          findings: analyzed.findings,
          analyzedAt: updatedImage.analyzedAt || new Date().toISOString(),
          source: analyzed.source,
        };
      }
    );

    return object(result);
  }
);

server.tool(
  {
    name: "add-insurance-plan",
    description: "Create or update primary/secondary insurance details for a patient.",
    schema: z.object({
      actor: actorSchema,
      planId: z.string().optional(),
      patientId: z.string(),
      tier: z.enum(insuranceTierValues),
      carrier: z.string(),
      employer: z.string().optional(),
      subscriberName: z.string(),
      subscriberId: z.string(),
      relationToSubscriber: z.string(),
      groupName: z.string().optional(),
      groupNumber: z.string().optional(),
      annualMax: z.number().optional(),
      deductible: z.number().optional(),
      benefitPercentages: z.record(z.string(), z.number()).optional(),
      notes: z.string().optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const plan = await runWithAuthAudit(
      {
        actor,
        permission: "insurance:write",
        action: "add-insurance-plan",
        resourceType: "insurance-plan",
        resourceId: input.planId,
      },
      async () => {
        const patient = await store.getPatient(input.patientId);
        if (!patient) {
          throw new Error(`Patient ${input.patientId} not found`);
        }
        return clinicOps.upsertInsurancePlan(input);
      }
    );

    return object({ plan });
  }
);

server.tool(
  {
    name: "list-insurance-plans",
    description: "Return patient's primary/secondary insurance plans.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
    }),
  },
  async ({ actor, patientId }) => {
    const plans = await runWithAuthAudit(
      {
        actor,
        permission: "insurance:read",
        action: "list-insurance-plans",
        resourceType: "insurance-plan",
        requirePurposeOnRead: true,
      },
      async () => clinicOps.listInsurancePlans(patientId)
    );

    return object({ plans });
  }
);

server.tool(
  {
    name: "create-treatment-plan",
    description: "Create a treatment plan header for a patient.",
    schema: z.object({
      actor: actorSchema,
      planId: z.string().optional(),
      patientId: z.string(),
      heading: z.string(),
      status: z.enum(treatmentPlanStatusValues).optional(),
      signed: z.boolean().optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const plan = await runWithAuthAudit(
      {
        actor,
        permission: "treatment:write",
        action: "create-treatment-plan",
        resourceType: "treatment-plan",
        resourceId: input.planId,
      },
      async () => {
        const patient = await store.getPatient(input.patientId);
        if (!patient) {
          throw new Error(`Patient ${input.patientId} not found`);
        }
        return clinicOps.createTreatmentPlan(input);
      }
    );

    return object({ plan });
  }
);

server.tool(
  {
    name: "add-treatment-plan-item",
    description: "Add procedure item (ADA code/tooth/surface/fee) to a treatment plan.",
    schema: z.object({
      actor: actorSchema,
      itemId: z.string().optional(),
      planId: z.string(),
      patientId: z.string(),
      tooth: z.string().optional(),
      surface: z.string().optional(),
      diagnosis: z.string().optional(),
      adaCode: z.string(),
      description: z.string(),
      fee: z.number(),
      allowedFee: z.number().optional(),
      priority: z.number().int().min(0).max(99).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const item = await runWithAuthAudit(
      {
        actor,
        permission: "treatment:write",
        action: "add-treatment-plan-item",
        resourceType: "treatment-plan-item",
        resourceId: input.itemId,
      },
      async () => clinicOps.addTreatmentPlanItem(input)
    );

    return object({ item });
  }
);

server.tool(
  {
    name: "estimate-treatment-plan",
    description:
      "Compute patient/insurance estimates for a treatment plan using configured benefit percentages.",
    schema: z.object({
      actor: actorSchema,
      planId: z.string(),
    }),
  },
  async ({ actor, planId }) => {
    const estimate = await runWithAuthAudit(
      {
        actor,
        permission: "treatment:read",
        action: "estimate-treatment-plan",
        resourceType: "treatment-plan",
        resourceId: planId,
        requirePurposeOnRead: true,
      },
      async () => clinicOps.estimateTreatmentPlan(planId)
    );

    return object(estimate);
  }
);

server.tool(
  {
    name: "post-ledger-entry",
    description:
      "Post account ledger events: charge, payment, adjustment, claim, insurance payment.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
      familyId: z.string().optional(),
      type: z.enum(ledgerEntryTypeValues),
      amount: z.number(),
      description: z.string(),
      entryDate: z.string().optional(),
      relatedPlanItemId: z.string().optional(),
      claimStatus: z.string().optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const entry = await runWithAuthAudit(
      {
        actor,
        permission: "ledger:write",
        action: "post-ledger-entry",
        resourceType: "ledger-entry",
      },
      async () =>
        clinicOps.postLedgerEntry({
          ...input,
          createdBy: actor.userId,
        })
    );

    return object({ entry });
  }
);

server.tool(
  {
    name: "get-account-snapshot",
    description:
      "Get account ledger summary including aging buckets and estimated balance.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
    }),
  },
  async ({ actor, patientId }) => {
    const account = await runWithAuthAudit(
      {
        actor,
        permission: "ledger:read",
        action: "get-account-snapshot",
        resourceType: "ledger",
        resourceId: patientId,
        requirePurposeOnRead: true,
      },
      async () => clinicOps.getAccountSnapshot(patientId)
    );

    return object(account);
  }
);

server.tool(
  {
    name: "add-chart-entry",
    description:
      "Add clinical chart entry (diagnosis/procedure/note by tooth and surface).",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
      entryDate: z.string().optional(),
      tooth: z.string().optional(),
      surface: z.string().optional(),
      diagnosis: z.string().optional(),
      procedureCode: z.string().optional(),
      note: z.string(),
      provider: z.string(),
    }),
  },
  async ({ actor, ...input }) => {
    const chartEntry = await runWithAuthAudit(
      {
        actor,
        permission: "chart:write",
        action: "add-chart-entry",
        resourceType: "chart-entry",
      },
      async () => clinicOps.addChartEntry(input)
    );

    return object({ chartEntry });
  }
);

server.tool(
  {
    name: "get-chart",
    description: "Get chart entries for a patient ordered by most recent.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
    }),
  },
  async ({ actor, patientId }) => {
    const entries = await runWithAuthAudit(
      {
        actor,
        permission: "chart:read",
        action: "get-chart",
        resourceType: "chart",
        resourceId: patientId,
        requirePurposeOnRead: true,
      },
      async () => clinicOps.listChartEntries(patientId)
    );

    return object({ entries });
  }
);

server.tool(
  {
    name: "set-recall",
    description: "Create/update recall rules and due dates.",
    schema: z.object({
      actor: actorSchema,
      recallId: z.string().optional(),
      patientId: z.string(),
      recallType: z.string(),
      intervalMonths: z.number().int().min(1).max(120),
      lastVisitDate: z.string().optional(),
      dueDate: z.string().optional(),
      status: z.enum(["due", "scheduled", "completed"]).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const recall = await runWithAuthAudit(
      {
        actor,
        permission: "recall:write",
        action: "set-recall",
        resourceType: "recall",
        resourceId: input.recallId,
      },
      async () => clinicOps.upsertRecall(input)
    );

    return object({ recall });
  }
);

server.tool(
  {
    name: "list-recall-due",
    description: "List recalls due within date range.",
    schema: z.object({
      actor: actorSchema,
      fromDate: z.string().describe("YYYY-MM-DD"),
      toDate: z.string().describe("YYYY-MM-DD"),
    }),
  },
  async ({ actor, fromDate, toDate }) => {
    const recalls = await runWithAuthAudit(
      {
        actor,
        permission: "recall:read",
        action: "list-recall-due",
        resourceType: "recall",
      },
      async () => clinicOps.listRecallDue(fromDate, toDate)
    );

    return object({ recalls, count: recalls.length });
  }
);

server.tool(
  {
    name: "add-communication-log",
    description: "Add communication log item (text/email/phone/etc.) with encrypted note storage.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
      communicationType: z.enum(communicationTypes),
      direction: z.enum(communicationDirections),
      note: z.string(),
    }),
  },
  async ({ actor, ...input }) => {
    const log = await runWithAuthAudit(
      {
        actor,
        permission: "communication:write",
        action: "add-communication-log",
        resourceType: "communication",
      },
      async () =>
        clinicOps.addCommunicationLog({
          ...input,
          createdBy: actor.userId,
        })
    );

    return object({ log, encryptedAtRest: textCipher.enabled });
  }
);

server.tool(
  {
    name: "list-communication-log",
    description: "List communication log for patient with decrypted notes for authorized use.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
    }),
  },
  async ({ actor, patientId }) => {
    const logs = await runWithAuthAudit(
      {
        actor,
        permission: "communication:read",
        action: "list-communication-log",
        resourceType: "communication",
        resourceId: patientId,
        requirePurposeOnRead: true,
      },
      async () => clinicOps.listCommunicationLogs(patientId)
    );

    return object({ logs, count: logs.length });
  }
);

server.tool(
  {
    name: "upsert-task",
    description: "Create/update task queue items for clinical or operational workflows.",
    schema: z.object({
      actor: actorSchema,
      taskId: z.string().optional(),
      patientId: z.string().optional(),
      title: z.string(),
      details: z.string().optional(),
      assignedTo: z.string().optional(),
      dueAt: z.string().optional(),
      priority: z.enum(taskPriorityValues).optional(),
      status: z.enum(taskStatusValues).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const task = await runWithAuthAudit(
      {
        actor,
        permission: "task:write",
        action: "upsert-task",
        resourceType: "task",
        resourceId: input.taskId,
      },
      async () =>
        clinicOps.upsertTask({
          ...input,
          actorUserId: actor.userId,
        })
    );

    return object({ task, encryptedAtRest: textCipher.enabled });
  }
);

server.tool(
  {
    name: "list-tasks",
    description: "List tasks by status and assignee.",
    schema: z.object({
      actor: actorSchema,
      status: z.enum(taskStatusValues).optional(),
      assignedTo: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  },
  async ({ actor, ...input }) => {
    const tasks = await runWithAuthAudit(
      {
        actor,
        permission: "task:read",
        action: "list-tasks",
        resourceType: "task",
      },
      async () => clinicOps.listTasks(input)
    );

    return object({ tasks, count: tasks.length });
  }
);

server.tool(
  {
    name: "get-dashboard",
    description: "Daily dashboard: schedule, due recalls, open task volume.",
    schema: z.object({
      actor: actorSchema,
      date: z.string().describe("YYYY-MM-DD"),
    }),
  },
  async ({ actor, date }) => {
    const dashboard = await runWithAuthAudit(
      {
        actor,
        permission: "appointment:read",
        action: "get-dashboard",
        resourceType: "dashboard",
      },
      async () => clinicOps.getDashboard(date)
    );

    return object(dashboard);
  }
);

const openDentalSnapshotSchema: z.ZodType<OpenDentalSnapshot> = z.object({
  patients: z
    .array(
      z.object({
        patNum: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        birthdate: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        chartNumber: z.string().optional(),
        guarantorPatNum: z.string().optional(),
      })
    )
    .optional(),
  appointments: z
    .array(
      z.object({
        aptNum: z.string(),
        patNum: z.string(),
        provider: z.string(),
        reason: z.string(),
        startAt: z.string(),
        endAt: z.string(),
        status: z.enum(appointmentStatusValues).optional(),
      })
    )
    .optional(),
  insurancePlans: z
    .array(
      z.object({
        planNum: z.string(),
        patNum: z.string(),
        tier: z.enum(insuranceTierValues),
        carrier: z.string(),
        subscriberName: z.string(),
        subscriberId: z.string(),
        relationToSubscriber: z.string(),
        groupName: z.string().optional(),
        groupNumber: z.string().optional(),
        annualMax: z.number().optional(),
        deductible: z.number().optional(),
        preventive: z.number().optional(),
        restorative: z.number().optional(),
        endodontic: z.number().optional(),
        periodontal: z.number().optional(),
        oralSurgery: z.number().optional(),
        crowns: z.number().optional(),
        prosthodontics: z.number().optional(),
      })
    )
    .optional(),
  treatmentPlans: z
    .array(
      z.object({
        planNum: z.string(),
        patNum: z.string(),
        heading: z.string(),
        status: z.enum(treatmentPlanStatusValues).optional(),
        signed: z.boolean().optional(),
        items: z
          .array(
            z.object({
              itemNum: z.string(),
              tooth: z.string().optional(),
              surface: z.string().optional(),
              diagnosis: z.string().optional(),
              adaCode: z.string(),
              description: z.string(),
              fee: z.number(),
              allowedFee: z.number().optional(),
              priority: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  ledgerEntries: z
    .array(
      z.object({
        entryNum: z.string(),
        patNum: z.string(),
        type: z.enum(ledgerEntryTypeValues),
        amount: z.number(),
        description: z.string(),
        entryDate: z.string(),
        claimStatus: z.string().optional(),
      })
    )
    .optional(),
});

server.tool(
  {
    name: "import-opendental-snapshot",
    description:
      "Import OpenDental export snapshot into MCP objects for migration/sync bootstrap.",
    schema: z.object({
      actor: actorSchema,
      snapshot: openDentalSnapshotSchema,
    }),
  },
  async ({ actor, snapshot }) => {
    const result = await runWithAuthAudit(
      {
        actor,
        permission: "migration:write",
        action: "import-opendental-snapshot",
        resourceType: "migration",
      },
      async () => clinicOps.importOpenDentalSnapshot(snapshot, actor)
    );

    return object(result);
  }
);

server.tool(
  {
    name: "list-audit-events",
    description: "List recent audit events (admin/system only).",
    schema: z.object({
      actor: actorSchema,
      limit: z.number().int().min(1).max(500).optional(),
    }),
  },
  async ({ actor, limit }) => {
    const events = await runWithAuthAudit(
      {
        actor,
        permission: "audit:read",
        action: "list-audit-events",
        resourceType: "audit",
        requirePurposeOnRead: true,
      },
      async () => auditLog.list(limit || 100)
    );

    return object({ events, count: events.length });
  }
);

server.tool(
  {
    name: "get-patient-workspace",
    description:
      "Unified patient workspace: demographics, family, appointments, imaging, plans, account, chart, communication.",
    schema: z.object({
      actor: actorSchema,
      patientId: z.string(),
    }),
  },
  async ({ actor, patientId }) => {
    const workspace = await runWithAuthAudit(
      {
        actor,
        permission: "patient:read",
        action: "get-patient-workspace",
        resourceType: "patient-workspace",
        resourceId: patientId,
        requirePurposeOnRead: true,
      },
      async () => {
        const patient = await store.getPatient(patientId);
        if (!patient) {
          throw new Error(`Patient ${patientId} not found`);
        }

        const [appointments, images] = await Promise.all([
          store.listAppointments(patientId),
          store.listDentalImages(patientId),
        ]);

        const [
          family,
          insurancePlans,
          treatmentPlans,
          account,
          chart,
          communicationLog,
        ] = await Promise.all([
          clinicOps.listFamilyByPatient(patientId),
          clinicOps.listInsurancePlans(patientId),
          clinicOps.listTreatmentPlans(patientId),
          clinicOps.getAccountSnapshot(patientId),
          clinicOps.listChartEntries(patientId),
          clinicOps.listCommunicationLogs(patientId),
        ]);

        return {
          patient: redactPatientForRole(
            actor,
            patient as unknown as Record<string, unknown>
          ),
          family,
          appointments,
          images,
          insurancePlans,
          treatmentPlans,
          account,
          chart,
          communicationLog,
        };
      }
    );

    return object(workspace);
  }
);

server.listen().then(() => {
  console.log("Dental MCP server running");
});
