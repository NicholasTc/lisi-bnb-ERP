import type { Metadata } from "next";
import { OrderStatus } from "@/components/order-status";
import "../../menu.css";
import "../../ordering.css";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OrderStatus key={id} id={id} />; }
