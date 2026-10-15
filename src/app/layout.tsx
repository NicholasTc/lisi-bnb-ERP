import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "LISI BNB Café", description: "Menu kafe untuk jeda permainanmu. Café menu for your break between games." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
