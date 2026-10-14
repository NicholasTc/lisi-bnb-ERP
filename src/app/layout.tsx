import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "LISI BNB ERP", description: "Employee access" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
