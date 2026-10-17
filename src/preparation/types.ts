export const preparationStates = ["awaiting_preparation", "preparing", "ready", "exception"] as const;
export type PreparationState = typeof preparationStates[number];
export type PreparationAction = "claim" | "ready" | "hold" | "pause" | "resume";
export type PreparationCommand = { id: string; kind: PreparationAction; orderId?: string; reason?: string; version?: number };
export type PreparationOrder = {
  id: string; reference: string; customerName: string; destination: string; state: PreparationState;
  createdAt: string; assigneeId: string | null; assigneeName: string | null; claimedAt: string | null; readyAt: string | null; reason: string | null;
  items: { name: string; nameEn: string | null; quantity: number }[];
};
export type PreparationQueue = {
  employee: { id: string; name: string; canWork: boolean; canDeliver: boolean; canManageAccounts: boolean };
  service: { deliveryPaused:boolean; paused: boolean; reason: string | null; version: number };
  latestOrderId: string | null; counts: Record<PreparationState, number>; orders: PreparationOrder[]; next: string | null;
};
