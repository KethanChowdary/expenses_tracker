"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { txApi } from "../../lib/api";
import { useCategories } from "../../lib/customCategories";
import { useCategoryBudgets } from "../../lib/budgets";

function fmt(n: number) {
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: isoDate(start),
    dateTo: isoDate(end),
    elapsedDays: now.getDate(),
    daysInMonth: end.getDate(),
  };
}

function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? "#312e81" : "#1e293b",
      borderRadius: 14,
      padding: "14px 16px",
    }}>
      {children}
    </div>
  );
}

export default function InsightsPage() {
  const { categories, getCategoryIcon } = useCategories();
  const { budgets, setBudget } = useCategoryBudgets();
  const bounds = useMemo(monthBounds, []);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", "insights", bounds.dateFrom, bounds.dateTo],
    queryFn: () => txApi.list({
      limit: "1000",
      order: "desc",
      date_from: bounds.dateFrom,
      date_to: bounds.dateTo,
    }),
  });

  const regularExpenses = txs.filter(t => (
    t.type === "expense" &&
    (t.spend_kind ?? "regular") === "regular"
  ));

  const spentByCategory = regularExpenses.reduce((acc, tx) => {
    const category = tx.category || "Other";
    acc[category] = (acc[category] ?? 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  const rows = Array.from(new Set([
    ...categories,
    ...Object.keys(budgets),
    ...Object.keys(spentByCategory),
  ])).map(category => {
    const budget = budgets[category] ?? 0;
    const spent = spentByCategory[category] ?? 0;
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 160) : 0;
    return {
      category,
      budget,
      spent,
      remaining: budget - spent,
      pct,
    };
  }).sort((a, b) => {
    const aActive = a.budget > 0 || a.spent > 0 ? 1 : 0;
    const bActive = b.budget > 0 || b.spent > 0 ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    if (b.pct !== a.pct) return b.pct - a.pct;
    return b.spent - a.spent;
  });

  const activeRows = rows.filter(row => row.budget > 0 || row.spent > 0);
  const totalBudget = Object.values(budgets).reduce((sum, amount) => sum + amount, 0);
  const totalSpent = regularExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetPace = totalBudget > 0 ? totalBudget * (bounds.elapsedDays / bounds.daysInMonth) : 0;
  const topCategory = activeRows.filter(row => row.spent > 0).sort((a, b) => b.spent - a.spent)[0];
  const overBudget = activeRows.filter(row => row.budget > 0 && row.spent > row.budget);
  const cashSpent = regularExpenses
    .filter(tx => tx.payment_mode === "cash")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const cashPct = totalSpent > 0 ? Math.round((cashSpent / totalSpent) * 100) : 0;

  const callouts = [
    overBudget.length
      ? `${overBudget[0].category} is over budget by ${fmt(overBudget[0].spent - overBudget[0].budget)}.`
      : totalBudget > 0
        ? `You have ${fmt(totalRemaining)} left across monthly budgets.`
        : "Set category budgets to unlock budget warnings.",
    topCategory
      ? `${topCategory.category} is your biggest spend this month at ${fmt(topCategory.spent)}.`
      : "Add expenses to see your top spending category.",
    totalBudget > 0 && totalSpent > budgetPace
      ? `Spending is ${fmt(totalSpent - budgetPace)} ahead of this month's budget pace.`
      : totalBudget > 0
        ? "Spending is within this month's budget pace."
        : null,
    totalSpent > 0 ? `${cashPct}% of regular spending used cash.` : null,
  ].filter((item): item is string => Boolean(item));

  if (isLoading) {
    return <p style={{ color: "#475569", textAlign: "center", marginTop: 40 }}>Loading…</p>;
  }

  return (
    <div className="insights-layout">
      <div className="insights-summary">
        <Card accent>
          <p style={{ color: "#a5b4fc", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
            Budget left
          </p>
          <p style={{ color: "#f8fafc", fontSize: 28, fontWeight: 800, margin: 0 }}>
            {totalBudget > 0 ? `${totalRemaining < 0 ? "-" : ""}${fmt(totalRemaining)}` : "Not set"}
          </p>
          <p style={{ color: "#c7d2fe", fontSize: 12, margin: "4px 0 0" }}>
            {fmt(totalSpent)} spent of {fmt(totalBudget)}
          </p>
        </Card>

        <Card>
          <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
            Insights
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {callouts.map(item => (
              <div key={item} style={{
                color: "#cbd5e1",
                fontSize: 13,
                lineHeight: 1.35,
                padding: "9px 10px",
                background: "#0f172a",
                border: "0.5px solid #334155",
                borderRadius: 10,
              }}>
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
          Monthly category budgets
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(row => (
            <div key={row.category} style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 108px",
              gap: 10,
              alignItems: "center",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: "#e2e8f0", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {getCategoryIcon(row.category)} {row.category}
                  </span>
                  <span style={{
                    color: row.budget > 0 && row.remaining < 0 ? "#f87171" : "#94a3b8",
                    fontSize: 12,
                    flexShrink: 0,
                  }}>
                    {fmt(row.spent)}{row.budget > 0 ? ` / ${fmt(row.budget)}` : ""}
                  </span>
                </div>
                <div style={{ height: 6, background: "#0f172a", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${row.budget > 0 ? Math.min(row.pct, 100) : 0}%`,
                    height: "100%",
                    background: row.remaining < 0 ? "#f87171" : row.pct > 80 ? "#f59e0b" : "#6366f1",
                    borderRadius: 4,
                  }} />
                </div>
              </div>
              <input
                type="number"
                min="0"
                value={row.budget || ""}
                onChange={e => setBudget(row.category, Number(e.target.value))}
                placeholder="Budget"
                style={{
                  width: "100%",
                  background: "#0f172a",
                  border: "0.5px solid #334155",
                  borderRadius: 9,
                  padding: "8px 9px",
                  color: "#f1f5f9",
                  fontSize: 12,
                  outline: "none",
                }}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
