import type { Actor, AuditEvent } from "../domain.js";

export interface AuditLogInput {
  actor: Actor;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  reason?: string;
  metadata?: Record<string, string>;
}

export class AuditLog {
  private readonly events: AuditEvent[] = [];

  log(input: AuditLogInput): AuditEvent {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      success: input.success,
      reason: input.reason,
      metadata: input.metadata || {},
    };
    this.events.push(event);
    return event;
  }

  list(limit = 100): AuditEvent[] {
    return this.events.slice(-Math.max(1, limit)).reverse();
  }
}
