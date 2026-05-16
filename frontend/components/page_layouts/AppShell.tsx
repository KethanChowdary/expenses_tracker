"use client";
import { useState } from "react";
import BottomNav from "./BottomNav";
import Header from "./Header";

export type Tab = "dashboard" | "transactions" | "analytics" | "insights" | "import";

const TITLES: Record<Tab, string> = {
  dashboard: "Overview",
  transactions: "Transactions",
  analytics: "Analytics",
  insights: "Insights",
  import: "Import CSV",
};

export default function AppShell({
  children,
}: {
  children: (tab: Tab, setTab: (t: Tab) => void) => React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="app-shell" style={{
      minHeight: "100svh",
      display: "flex",
      flexDirection: "column",
      background: "#0f172a",
    }}>
      <Header title={TITLES[tab]} />
      <main className="app-main" style={{
        flex: 1,
        overflowY: "auto",
      }}>
        {children(tab, setTab)}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
