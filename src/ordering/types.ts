export type ServiceMode = "court" | "pickup" | "dine_in";
export type OrderState = "awaiting_preparation" | "awaiting_payment" | "queued_for_preparation" | "canceled" | "exception";
export type CheckoutInput = {
  id: string; accessKey: string; customerName: string; phone: string | null; kind: ServiceMode; locationId: string | null;
  locationConfirmed: boolean;
  items: { productId: string; quantity: number; priceIdr: number }[];
};
export type OrderView = {
  id: string; source: "guest" | "counter"; customerName: string; phone: string | null; kind: ServiceMode; destination: string;
  totalIdr: number; state: OrderState; reason: string | null; createdAt: string; expiresAt: string | null; accessExpiresAt: string;
  demoTransactionId: string | null; reference: string | null; workflow: "demo" | "court_test"; pickupCode: string | null; simulated: boolean; testOnly: true;
  items: { productId: string; name: string; nameEn: string | null; description: string; descriptionEn: string | null; quantity: number; unitPriceIdr: number }[];
  paymentStatus: "unpaid" | "simulated_paid" | "review" | "refund_pending" | "refunded";
  receivedIdr: string; refundedIdr: string;
  payments: { id: string; amountIdr: number; matched: boolean; primary: boolean;
    refunds: { id: string; state: "pending" | "succeeded" | "failed"; amountIdr: number }[] }[];
};
export type PaymentEvent = {
  eventId: string; orderId: string; transactionId: string; flow: "payment" | "refund";
  status: "pending" | "succeeded" | "failed" | "expired"; amountIdr: number; currency: string;
};
export type DemoPayload = PaymentEvent;
export type StaffOrder = OrderView & { inbox: { id: string; payload: DemoPayload; result: string | null }[] };
