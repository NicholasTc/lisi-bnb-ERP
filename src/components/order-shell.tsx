import Link from "next/link";
import type { Language } from "../catalog/types";
import { orderCopy } from "../ordering/copy";
export function OrderShell({ language, change, children }: { language: Language; change: (value: Language) => void; children: React.ReactNode }) {
  const t = orderCopy[language];
  return <main className="customer-menu" lang={language}><div className="menu-shell order-shell">
    <header className="menu-header"><Link href="/" className="menu-brand">LISI<span> BNB</span></Link>
      <div className="menu-language" role="group" aria-label={language === "id" ? "Bahasa" : "Language"}>
        <button aria-pressed={language === "id"} onClick={() => change("id")}>ID</button><button aria-pressed={language === "en"} onClick={() => change("en")}>EN</button>
      </div></header>
    <div className="order-subnav"><Link href="/" className="order-back">{t.back}</Link><span className="order-test-label">{t.test}</span></div>
    {children}
  </div></main>;
}
