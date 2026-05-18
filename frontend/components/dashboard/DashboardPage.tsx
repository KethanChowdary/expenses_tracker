"use client";
import { useQuery } from "@tanstack/react-query";
import { txApi } from "../../custom_library/api";
import QuickAdd from "../transactions/QuickAdd";
import SummaryCards from "./SummaryCards";
import TxItem from "../transactions/TxItem";
import AccountBalanceCard from "./AccountBalanceCard";

export default function DashboardPage() {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => txApi.list({ limit: "200" }),
  });

  const recent = txs.slice(0, 5);

  return (
    <div className="dashboard-layout">
      <div className="dashboard-primary">
        <QuickAdd />
        {isLoading ? (
          <p style={{ color: "#475569", textAlign: "center", marginTop: 40 }}>Loading…</p>
        ) : (
          <>
            <AccountBalanceCard txs={txs} />
            <SummaryCards txs={txs} />
          </>
        )}
      </div>
      {!isLoading && (
        <div className="dashboard-recent">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
              Recent
            </p>
          </div>
          {recent.length === 0
            ? <p style={{ color: "#475569", textAlign: "center", marginTop: 20, fontSize: 14 }}>
                No transactions yet. Add one above ↑
              </p>
            : recent.map(tx => <TxItem key={tx.id} tx={tx} />)
          }
        </div>
      )}
    </div>
  );
}
