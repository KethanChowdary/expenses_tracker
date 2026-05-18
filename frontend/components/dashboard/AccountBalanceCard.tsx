"use client";
import { useEffect, useMemo, useState } from "react";
import { Transaction } from "../../custom_library/api";

const ACCOUNT_KEY = "expense_tracker_account_balance_baseline";
const CASH_KEY = "expense_tracker_cash_balance_baseline";

interface BalanceBaseline {
  amount: number;
  asOf: string;
}

function readBaseline(key: string): BalanceBaseline | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.amount === "number" && typeof parsed?.asOf === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function parseBackendCreatedAt(value: string) {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`).getTime();
}

function BalancePanel({
  title,
  storageKey,
  mode,
  txs,
}: {
  title: string;
  storageKey: string;
  mode: "account" | "cash";
  txs: Transaction[];
}) {
  const [baseline, setBaseline] = useState<BalanceBaseline | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = readBaseline(storageKey);
    setBaseline(saved);
    setDraft(saved ? String(saved.amount) : "");
    setEditing(!saved);
  }, [storageKey]);

  const adjustment = useMemo(() => {
    if (!baseline) return 0;
    const asOf = new Date(baseline.asOf).getTime();
    return txs
      .filter(t => (
        t.source === "manual" &&
        (t.payment_mode ?? "account") === mode &&
        parseBackendCreatedAt(t.created_at) >= asOf
      ))
      .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
  }, [baseline, mode, txs]);

  const current = baseline ? baseline.amount + adjustment : null;

  function saveBalance() {
    const amount = Number(draft);
    if (!Number.isFinite(amount)) return;
    const next = { amount, asOf: new Date().toISOString() };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setBaseline(next);
    setEditing(false);
  }

  return (
    <div style={{ background: "#1e293b", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
            {title}
          </p>
          <p style={{ fontSize: 24, fontWeight: 800, color: current === null ? "#64748b" : "#f1f5f9", margin: 0 }}>
            {current === null ? "Not set" : fmt(current)}
          </p>
          {baseline && (
            <p style={{ color: adjustment >= 0 ? "#34d399" : "#f87171", fontSize: 12, margin: "3px 0 0" }}>
              {adjustment >= 0 ? "+" : "-"}{fmt(Math.abs(adjustment))} manual {mode} activity
            </p>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => {
              setDraft(current === null ? "" : String(Math.round(current)));
              setEditing(true);
            }}
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              border: "0.5px solid #334155",
              borderRadius: 9,
              color: "#94a3b8",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Update
          </button>
        )}
      </div>

      {editing && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveBalance()}
            placeholder={`${title} amount`}
            autoFocus
            style={{
              minWidth: 0,
              flex: 1,
              background: "#0f172a",
              border: "0.5px solid #334155",
              borderRadius: 9,
              padding: "9px 10px",
              color: "#f1f5f9",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={saveBalance}
            style={{
              background: "#6366f1",
              border: "none",
              borderRadius: 9,
              color: "white",
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Set
          </button>
          {baseline && (
            <button
              onClick={() => setEditing(false)}
              style={{
                background: "transparent",
                border: "0.5px solid #334155",
                borderRadius: 9,
                color: "#94a3b8",
                padding: "0 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {baseline && (
        <p style={{ color: "#64748b", fontSize: 11, margin: "10px 0 0" }}>
          Tracks manual {mode} transactions added after {new Date(baseline.asOf).toLocaleString("en-IN", {
            day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}.
        </p>
      )}
    </div>
  );
}

export default function AccountBalanceCard({ txs }: { txs: Transaction[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 16 }}>
      <BalancePanel title="Account balance" storageKey={ACCOUNT_KEY} mode="account" txs={txs} />
      <BalancePanel title="Cash balance" storageKey={CASH_KEY} mode="cash" txs={txs} />
    </div>
  );
}
