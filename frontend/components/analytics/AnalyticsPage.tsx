"use client";
import { useQuery } from "@tanstack/react-query";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { txApi, Transaction } from "../../lib/api";
import { useCategories } from "../../lib/customCategories";
import PeriodBar from "../page_layouts/PeriodBar";
import { usePeriod } from "../../lib/usePeriod";
import { useState } from "react";

// ── palette ──────────────────────────────────────────────────────

const CAT_COLORS = [
  "#6366f1","#f59e0b","#34d399","#f87171","#818cf8",
  "#fb923c","#2dd4bf","#e879f9","#38bdf8","#a3e635",
];

// ── helpers ──────────────────────────────────────────────────────

function fmt(n: number) { return "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN"); }
function fmtK(n: number) {
  if (Math.abs(n) >= 100_000) return "₹" + (n/100_000).toFixed(1) + "L";
  if (Math.abs(n) >= 1_000)   return "₹" + (n/1_000).toFixed(1) + "k";
  return "₹" + Math.round(n);
}
function fmtPct(pct: number) {
  if (pct > 0 && pct < 1) return "<1%";
  return `${pct.toFixed(0)}%`;
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, t) => {
    const k = key(t);
    (acc[k] = acc[k] || []).push(t);
    return acc;
  }, {} as Record<string, T[]>);
}

// ── sub-components ────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, color: "#64748b", textTransform: "uppercase",
      letterSpacing: "0.6px", margin: "20px 0 10px", fontWeight: 600,
    }}>
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 14, padding: "14px 16px", ...style }}>
      {children}
    </div>
  );
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f172a", border: "0.5px solid #334155",
      borderRadius: 8, padding: "8px 12px", fontSize: 12,
    }}>
      <p style={{ color: "#94a3b8", margin: "0 0 4px" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "#a5b4fc", margin: 0, fontWeight: 600 }}>
          {fmtK(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const p = usePeriod();
  const { getCategoryIcon } = useCategories();
  const [paymentFilter, setPaymentFilter] = useState<"all" | "account" | "cash">("all");

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", p.period.dateFrom, p.period.dateTo],
    queryFn: () => txApi.list({
      limit: "1000",
      order: "asc",
      date_from: p.period.dateFrom,
      date_to:   p.period.dateTo,
    }),
  });

  const filteredTxs = txs.filter(t => paymentFilter === "all" || (t.payment_mode ?? "account") === paymentFilter);
  const expenses = filteredTxs.filter(t => t.type === "expense");
  const regularExpenses = expenses.filter(t => (t.spend_kind ?? "regular") === "regular");
  const lent = expenses.filter(t => t.spend_kind === "lent");
  const investments = expenses.filter(t => t.spend_kind === "investment");
  const income   = filteredTxs.filter(t => t.type === "income");

  const totalExp = regularExpenses.reduce((s, t) => s + t.amount, 0);
  const totalLent = lent.reduce((s, t) => s + t.amount, 0);
  const outstandingLent = lent
    .filter(t => t.lent_status !== "received")
    .reduce((s, t) => s + t.amount, 0);
  const receivedLent = lent
    .filter(t => t.lent_status === "received")
    .reduce((s, t) => s + t.amount, 0);
  const totalInvested = investments.reduce((s, t) => s + t.amount, 0);
  const totalInc = income.reduce((s, t)   => s + t.amount, 0);
  const accountIncome = income.filter(t => (t.payment_mode ?? "account") === "account").reduce((s, t) => s + t.amount, 0);
  const cashIncome = income.filter(t => t.payment_mode === "cash").reduce((s, t) => s + t.amount, 0);
  const accountOutflow = expenses.filter(t => (t.payment_mode ?? "account") === "account").reduce((s, t) => s + t.amount, 0);
  const cashOutflow = expenses.filter(t => t.payment_mode === "cash").reduce((s, t) => s + t.amount, 0);
  const accountLentReceived = lent.filter(t => t.lent_status === "received" && t.received_mode === "account").reduce((s, t) => s + t.amount, 0);
  const cashLentReceived = lent.filter(t => t.lent_status === "received" && t.received_mode === "cash").reduce((s, t) => s + t.amount, 0);
  const accountSavings = accountIncome - accountOutflow + accountLentReceived;
  const cashSavings = cashIncome - cashOutflow + cashLentReceived;
  const saved    = totalInc - totalExp - totalInvested - outstandingLent;
  const savingsRate = totalInc > 0 ? Math.round((saved / totalInc) * 100) : 0;

  // ── category breakdown ────────────────────────────────────────

  const byCat = groupBy(regularExpenses, t => t.category || "Other");
  const catData = Object.entries(byCat)
    .map(([cat, txs]) => ({ cat, total: txs.reduce((s, t) => s + t.amount, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // ── daily trend ───────────────────────────────────────────────

  const byDay = groupBy(filteredTxs, t => t.transaction_date);
  const dailyData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, ts]) => {
      const exp = ts.filter(t => t.type === "expense" && (t.spend_kind ?? "regular") === "regular").reduce((s, t) => s + t.amount, 0);
      const inc = ts.filter(t => t.type === "income" ).reduce((s, t) => s + t.amount, 0);
      // Short label: "01", "02" etc
      const label = day.split("-")[2] ?? day;
      return { label, exp, inc };
    });

  // ── top merchants ─────────────────────────────────────────────

  const byMerchant = groupBy(
    regularExpenses.filter(t => t.merchant),
    t => t.merchant!,
  );
  const topMerchants = Object.entries(byMerchant)
    .map(([m, ts]) => ({ merchant: m, total: ts.reduce((s, t) => s + t.amount, 0), count: ts.length }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // ── income sources ────────────────────────────────────────────

  const byIncSrc = groupBy(income.filter(t => t.merchant), t => t.merchant!);
  const incSources = Object.entries(byIncSrc)
    .map(([m, ts]) => ({ merchant: m, total: ts.reduce((s, t) => s + t.amount, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const peopleLedger = Object.entries(groupBy(lent.filter(t => t.lent_to), t => t.lent_to!))
    .map(([person, ts]) => ({
      person,
      outstanding: ts.filter(t => t.lent_status !== "received").reduce((s, t) => s + t.amount, 0),
      received: ts.filter(t => t.lent_status === "received").reduce((s, t) => s + t.amount, 0),
      count: ts.length,
    }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8);

  const investmentLedger = investments
    .map(t => ({
      name: t.reason || t.merchant || t.description || t.category,
      amount: t.amount,
      value: t.investment_value,
      date: t.transaction_date,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const recurring = expenses
    .filter(t => t.is_recurring)
    .map(t => ({
      name: t.recurring_name || t.reason || t.merchant || t.description || t.category,
      amount: t.amount,
      paymentMode: t.payment_mode,
    }))
    .slice(0, 8);

  if (isLoading) return (
    <p style={{ color: "#475569", textAlign: "center", marginTop: 60 }}>Loading…</p>
  );

  return (
    <div>
      <PeriodBar
        mode={p.mode} setMode={p.setMode}
        label={p.period.label}
        prevPeriod={p.prevPeriod} nextPeriod={p.nextPeriod}
        salaryDay={p.salaryDay} setSalaryDay={p.setSalaryDay}
        customFrom={p.customFrom} setCustomFrom={p.setCustomFrom}
        customTo={p.customTo}   setCustomTo={p.setCustomTo}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["all", "account", "cash"] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setPaymentFilter(mode)}
            style={{
              padding: "6px 12px",
              borderRadius: 18,
              border: `0.5px solid ${paymentFilter === mode ? "#6366f1" : "#334155"}`,
              background: paymentFilter === mode ? "#312e81" : "transparent",
              color: paymentFilter === mode ? "#a5b4fc" : "#64748b",
              fontSize: 12,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {mode === "all" ? "All" : mode}
          </button>
        ))}
      </div>

      {filteredTxs.length === 0 ? (
        <p style={{ color: "#475569", textAlign: "center", marginTop: 60, fontSize: 14 }}>
          No transactions in this period.
        </p>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            {[
              { label: "Income",   value: fmt(totalInc), color: "#34d399", bg: "#064e3b" },
              { label: "Spent",    value: fmt(totalExp), color: "#f87171", bg: "#450a0a" },
              { label: "Invested",  value: fmt(totalInvested), color: "#38bdf8", bg: "#082f49" },
              { label: "Lent Out",  value: fmt(outstandingLent), color: "#f59e0b", bg: "#451a03",
                sub: receivedLent ? `${fmt(receivedLent)} received` : undefined },
              { label: "Saved",    value: fmt(Math.abs(saved)),
                color: saved >= 0 ? "#818cf8" : "#f87171",
                bg: saved >= 0 ? "#1e1b4b" : "#450a0a",
                sub: saved < 0 ? "overspent" : undefined },
              { label: "Savings %", value: `${savingsRate}%`,
                color: savingsRate >= 20 ? "#34d399" : savingsRate >= 0 ? "#f59e0b" : "#f87171",
                bg: "#1e293b" },
            ].map(({ label, value, color, bg, sub }) => (
              <div key={label} style={{ background: bg, borderRadius: 14, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 4px",
                  textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0 }}>{value}</p>
                {sub && <p style={{ fontSize: 11, color: "#f87171", margin: "2px 0 0" }}>{sub}</p>}
              </div>
            ))}
          </div>

          <SectionTitle>Cash and account savings</SectionTitle>
          <Card>
            {[
              { label: "Account savings", value: accountSavings, color: accountSavings >= 0 ? "#34d399" : "#f87171" },
              { label: "Cash savings", value: cashSavings, color: cashSavings >= 0 ? "#2dd4bf" : "#f87171" },
              { label: "Money to receive", value: outstandingLent, color: "#f59e0b" },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 0",
                borderBottom: i < 2 ? "0.5px solid #0f172a" : "none",
              }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{row.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{fmt(row.value)}</span>
              </div>
            ))}
          </Card>

          {peopleLedger.length > 0 && (
            <>
              <SectionTitle>People ledger</SectionTitle>
              <Card>
                {peopleLedger.map((row, i) => (
                  <div key={row.person} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 0",
                    borderBottom: i < peopleLedger.length - 1 ? "0.5px solid #0f172a" : "none",
                  }}>
                    <div>
                      <p style={{ color: "#e2e8f0", fontSize: 13, margin: 0 }}>{row.person}</p>
                      <p style={{ color: "#64748b", fontSize: 11, margin: 0 }}>
                        {row.count} txn{row.count > 1 ? "s" : ""} · {fmt(row.received)} received
                      </p>
                    </div>
                    <span style={{ color: row.outstanding > 0 ? "#f59e0b" : "#34d399", fontWeight: 800, fontSize: 14 }}>
                      {fmt(row.outstanding)}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}

          {investmentLedger.length > 0 && (
            <>
              <SectionTitle>Investment ledger</SectionTitle>
              <Card>
                {investmentLedger.map((row, i) => (
                  <div key={`${row.date}-${row.name}-${i}`} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 0",
                    borderBottom: i < investmentLedger.length - 1 ? "0.5px solid #0f172a" : "none",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "#e2e8f0", fontSize: 13, margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 230 }}>
                        {row.name}
                      </p>
                      <p style={{ color: "#64748b", fontSize: 11, margin: 0 }}>{row.date}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#38bdf8", fontWeight: 800, fontSize: 14, margin: 0 }}>{fmt(row.amount)}</p>
                      {row.value && (
                        <p style={{
                          color: row.value >= row.amount ? "#34d399" : "#f87171",
                          fontWeight: 700,
                          fontSize: 11,
                          margin: 0,
                        }}>
                          now {fmt(row.value)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}

          {recurring.length > 0 && (
            <>
              <SectionTitle>Recurring spends</SectionTitle>
              <Card>
                {recurring.map((row, i) => (
                  <div key={`${row.name}-${i}`} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 0",
                    borderBottom: i < recurring.length - 1 ? "0.5px solid #0f172a" : "none",
                  }}>
                    <span style={{ color: "#e2e8f0", fontSize: 13 }}>{row.name}</span>
                    <span style={{ color: "#f87171", fontWeight: 800, fontSize: 14 }}>
                      {fmt(row.amount)}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}

          {/* ── Daily trend ── */}
          {dailyData.length > 1 && (
            <>
              <SectionTitle>Daily spend</SectionTitle>
              <Card>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#475569", fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#475569", fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={fmtK}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone" dataKey="exp"
                      stroke="#f87171" strokeWidth={2}
                      dot={false} name="Expense"
                    />
                    {totalInc > 0 && (
                      <Line
                        type="monotone" dataKey="inc"
                        stroke="#34d399" strokeWidth={2}
                        dot={false} name="Income"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#f87171" }}>● Expense</span>
                  {totalInc > 0 && <span style={{ fontSize: 11, color: "#34d399" }}>● Income</span>}
                </div>
              </Card>
            </>
          )}

          {/* ── Category breakdown ── */}
          {catData.length > 0 && (
            <>
              <SectionTitle>Spending by category</SectionTitle>
              <Card style={{ marginBottom: 0, padding: "18px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {catData.map(({ cat, total }, i) => {
                    const pct = totalExp > 0 ? (total / totalExp) * 100 : 0;
                    return (
                      <div
                        key={cat}
                        title={`${cat}: ${fmt(total)}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(92px, max-content) 1fr",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        <span style={{
                          color: "#94a3b8",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {getCategoryIcon(cat)} {cat}
                        </span>
                        <div style={{
                          height: 14,
                          background: "#0f172a",
                          borderRadius: 8,
                          overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: "100%",
                            minWidth: pct > 0 ? 18 : 0,
                            background: CAT_COLORS[i % CAT_COLORS.length],
                            borderRadius: 8,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Category list with % bar */}
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {catData.map(({ cat, total }, i) => {
                  const pct = totalExp > 0 ? (total / totalExp) * 100 : 0;
                  return (
                    <div key={cat} style={{
                      background: "#1e293b", borderRadius: 10, padding: "10px 14px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: "#e2e8f0" }}>
                          {getCategoryIcon(cat)} {cat}
                        </span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: CAT_COLORS[i % CAT_COLORS.length] }}>
                            {fmt(total)}
                          </span>
                          <span style={{ fontSize: 11, color: "#475569", marginLeft: 6 }}>
                            {fmtPct(pct)}
                          </span>
                        </div>
                      </div>
                      <div style={{ background: "#0f172a", borderRadius: 4, height: 4, overflow: "hidden" }}>
                        <div style={{
                          width: `${pct}%`, height: "100%",
                          minWidth: pct > 0 ? 18 : 0,
                          background: CAT_COLORS[i % CAT_COLORS.length],
                          borderRadius: 4, transition: "width 0.4s",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Top merchants ── */}
          {topMerchants.length > 0 && (
            <>
              <SectionTitle>Top merchants</SectionTitle>
              <Card>
                {topMerchants.map(({ merchant, total, count }, i) => (
                  <div key={merchant} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 0",
                    borderBottom: i < topMerchants.length - 1 ? "0.5px solid #0f172a" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: CAT_COLORS[i % CAT_COLORS.length] + "22",
                        color: CAT_COLORS[i % CAT_COLORS.length],
                        fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <div>
                        <p style={{ fontSize: 13, color: "#e2e8f0", margin: 0,
                          maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {merchant}
                        </p>
                        <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>
                          {count} txn{count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>
                      {fmt(total)}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}

          {/* ── Income sources ── */}
          {incSources.length > 0 && (
            <>
              <SectionTitle>Income sources</SectionTitle>
              <Card style={{ marginBottom: 8 }}>
                {incSources.map(({ merchant, total }, i) => (
                  <div key={merchant} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 0",
                    borderBottom: i < incSources.length - 1 ? "0.5px solid #0f172a" : "none",
                  }}>
                    <span style={{ fontSize: 13, color: "#e2e8f0",
                      maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {merchant}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>
                      {fmt(total)}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
