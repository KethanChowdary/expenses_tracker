"use client";
import { Tab } from "./AppShell";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard",    label: "Home",      icon: "ti-home" },
  { id: "transactions", label: "History",   icon: "ti-list" },
  { id: "import",       label: "Import",    icon: "ti-upload" },
  { id: "analytics",    label: "Analytics", icon: "ti-chart-pie" },
  { id: "insights",     label: "Insights",  icon: "ti-sparkles" },
];

export default function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="bottom-nav" style={{
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      background: "#0f172a",
      borderTop: "0.5px solid #1e293b",
      zIndex: 20,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {TABS.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "10px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: active === id ? "#6366f1" : "#64748b",
            transition: "color 0.15s",
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 22 }} />
          <span style={{ fontSize: 10 }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
