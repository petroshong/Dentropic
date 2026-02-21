import type { Actor, UserRole } from "../domain.js";

export type Permission =
  | "patient:read"
  | "patient:write"
  | "appointment:read"
  | "appointment:write"
  | "insurance:read"
  | "insurance:write"
  | "treatment:read"
  | "treatment:write"
  | "ledger:read"
  | "ledger:write"
  | "chart:read"
  | "chart:write"
  | "recall:read"
  | "recall:write"
  | "task:read"
  | "task:write"
  | "communication:read"
  | "communication:write"
  | "image:read"
  | "image:write"
  | "image:analyze"
  | "migration:write"
  | "audit:read";

const allPermissions: Permission[] = [
  "patient:read",
  "patient:write",
  "appointment:read",
  "appointment:write",
  "insurance:read",
  "insurance:write",
  "treatment:read",
  "treatment:write",
  "ledger:read",
  "ledger:write",
  "chart:read",
  "chart:write",
  "recall:read",
  "recall:write",
  "task:read",
  "task:write",
  "communication:read",
  "communication:write",
  "image:read",
  "image:write",
  "image:analyze",
  "migration:write",
  "audit:read",
];

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: allPermissions,
  system: allPermissions,
  dentist: [
    "patient:read",
    "patient:write",
    "appointment:read",
    "appointment:write",
    "insurance:read",
    "treatment:read",
    "treatment:write",
    "ledger:read",
    "chart:read",
    "chart:write",
    "recall:read",
    "recall:write",
    "task:read",
    "task:write",
    "communication:read",
    "communication:write",
    "image:read",
    "image:write",
    "image:analyze",
  ],
  hygienist: [
    "patient:read",
    "appointment:read",
    "appointment:write",
    "insurance:read",
    "treatment:read",
    "chart:read",
    "chart:write",
    "recall:read",
    "recall:write",
    "task:read",
    "task:write",
    "communication:read",
    "communication:write",
    "image:read",
    "image:write",
    "image:analyze",
  ],
  assistant: [
    "patient:read",
    "appointment:read",
    "appointment:write",
    "treatment:read",
    "chart:read",
    "chart:write",
    "task:read",
    "task:write",
    "communication:read",
    "communication:write",
    "image:read",
    "image:write",
    "image:analyze",
  ],
  "front-desk": [
    "patient:read",
    "patient:write",
    "appointment:read",
    "appointment:write",
    "insurance:read",
    "recall:read",
    "recall:write",
    "task:read",
    "task:write",
    "communication:read",
    "communication:write",
  ],
  billing: [
    "patient:read",
    "appointment:read",
    "insurance:read",
    "insurance:write",
    "treatment:read",
    "ledger:read",
    "ledger:write",
    "communication:read",
    "communication:write",
    "task:read",
    "task:write",
  ],
  readonly: [
    "patient:read",
    "appointment:read",
    "insurance:read",
    "treatment:read",
    "ledger:read",
    "chart:read",
    "recall:read",
    "task:read",
    "communication:read",
    "image:read",
  ],
};

function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function assertAuthorized(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor.role, permission)) {
    throw new Error(
      `Actor ${actor.userId} (${actor.role}) is not authorized for ${permission}`
    );
  }
}

export function requirePurpose(actor: Actor, requiredNote: string): void {
  if (!actor.purpose || actor.purpose.trim().length < 8) {
    throw new Error(
      `Purpose of use is required (${requiredNote}). Provide actor.purpose with at least 8 characters.`
    );
  }
}
