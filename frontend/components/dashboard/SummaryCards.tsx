import { Transaction } from "../../lib/api";

export default function SummaryCards({ txs }: { txs: Transaction[] }) {
  const now = new Date();
  const monthTxs = txs.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const regularSpent = monthTxs
    .filter(t => t.type === "expense" && (t.spend_kind ?? "regular") === "regular")
    .reduce((s, t) => s + t.amount, 0);
  const lentOutstanding = monthTxs
    .filter(t => t.type === "expense" && t.spend_kind === "lent" && t.lent_status !== "received")
    .reduce((s, t) => s + t.amount, 0);
  const invested = monthTxs
    .filter(t => t.type === "expense" && t.spend_kind === "investment")
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const daysInMonth = now.getDate();
  const dailyAvg = daysInMonth > 0 ? regularSpent / daysInMonth : 0;
  const balance = totalIncome - regularSpent - invested - lentOutstanding;

  const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

  const Card = ({ label, value, sub, accent }: {
    label: string; value: string; sub?: string; accent?: boolean
  }) => (
    <div style={{
      background: accent ? "#312e81" : "#1e293b",
      borderRadius: 14, padding: "14px 16px",
    }}>
      <p style={{ fontSize: 11, color: accent ? "#818cf8" : "#64748b",
        textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: accent ? "#a5b4fc" : "#64748b", margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );

  return (
    <div className="summary-grid" style={{ display: "grid", gap: 10, marginBottom: 20 }}>
      <Card label="Spent" value={fmt(regularSpent)} sub={`${daysInMonth} days`} accent />
      <Card label="Daily Avg" value={fmt(dailyAvg)} />
      <Card label="Invested" value={fmt(invested)} />
      <Card label="To Receive" value={fmt(lentOutstanding)} />
      <Card label="Income" value={fmt(totalIncome)} />
      <Card label="Balance" value={fmt(balance)} />
    </div>
  );
}
