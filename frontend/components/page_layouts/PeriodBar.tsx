"use client";
/**
 * PeriodBar — period-mode tabs + navigator + custom inputs
 * Drop this above any page that uses usePeriod().
 */
import { PeriodMode } from "../../custom_library/usePeriod";

const S = {
  pill: (active: boolean) => ({
    padding: "5px 12px",
    borderRadius: 20,
    border: `0.5px solid ${active ? "#6366f1" : "#334155"}`,
    background: active ? "#312e81" : "transparent",
    color: active ? "#a5b4fc" : "#64748b",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
    transition: "all 0.15s",
  }),
  navBtn: {
    background: "#1e293b",
    border: "0.5px solid #334155",
    borderRadius: 8,
    width: 32, height: 32,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: "#94a3b8", fontSize: 16,
    flexShrink: 0,
  } as React.CSSProperties,
  dateInput: {
    background: "#0f172a",
    border: "0.5px solid #334155",
    borderRadius: 8,
    padding: "6px 10px",
    color: "#f1f5f9",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    flex: 1,
  } as React.CSSProperties,
};

interface Props {
  mode: PeriodMode;
  setMode: (m: PeriodMode) => void;
  label: string;
  prevPeriod: () => void;
  nextPeriod: () => void;
  // salary
  salaryDay: number;
  setSalaryDay: (d: number) => void;
  // custom
  customFrom: string;
  setCustomFrom: (s: string) => void;
  customTo: string;
  setCustomTo: (s: string) => void;
}

const MODES: { id: PeriodMode; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "salary",  label: "Salary cycle" },
  { id: "custom",  label: "Custom" },
];

export default function PeriodBar({
  mode, setMode, label,
  prevPeriod, nextPeriod,
  salaryDay, setSalaryDay,
  customFrom, setCustomFrom,
  customTo, setCustomTo,
}: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      {/* Mode pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
        {MODES.map(({ id, label: l }) => (
          <button key={id} style={S.pill(mode === id)} onClick={() => setMode(id)}>
            {l}
          </button>
        ))}
      </div>

      {/* Monthly / salary navigator */}
      {(mode === "monthly" || mode === "salary") && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={S.navBtn} onClick={prevPeriod}>‹</button>
          <span style={{
            flex: 1, textAlign: "center", color: "#e2e8f0",
            fontSize: 14, fontWeight: 600,
          }}>
            {label}
          </span>
          <button style={S.navBtn} onClick={nextPeriod}>›</button>
        </div>
      )}

      {/* Salary day picker */}
      {mode === "salary" && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Salary on day</span>
          <select
            value={salaryDay}
            onChange={e => setSalaryDay(Number(e.target.value))}
            style={{
              background: "#1e293b", border: "0.5px solid #334155",
              borderRadius: 8, padding: "4px 8px",
              color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", outline: "none",
            }}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "#475569" }}>of each month</span>
        </div>
      )}

      {/* Custom date range */}
      {mode === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            style={S.dateInput}
          />
          <span style={{ color: "#475569", fontSize: 12 }}>→</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            style={S.dateInput}
          />
        </div>
      )}
    </div>
  );
}