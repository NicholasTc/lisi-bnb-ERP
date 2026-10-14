export const roles = ["preparation", "delivery", "supervisor", "owner"] as const;
export type Role = typeof roles[number];
export function isRole(role: string): role is Role { return roles.includes(role as Role); }
export function canReadOwnerDiagnostic(assigned: readonly string[]) { return assigned.includes("owner"); }
