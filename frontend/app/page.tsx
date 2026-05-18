"use client";
import AppShell from "../components/page_layouts/AppShell";
import DashboardPage    from "../components/dashboard/DashboardPage";
import TransactionsPage from "../components/transactions/TransactionsPage";
import CsvImportPage    from "../components/import_file/CsvImportPage";
import AnalyticsPage    from "../components/analytics/AnalyticsPage";
import InsightsPage     from "../components/insights/InsightsPage";
import AuthPage         from "../components/auth/AuthPage";
import { useAuth } from "../custom_library/authContext";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: "100svh", display: "grid", placeItems: "center", color: "#64748b" }}>Loading…</div>;
  }

  if (!user) return <AuthPage />;

  return (
    <AppShell>
      {(tab, setTab) => {
        if (tab === "dashboard")    return <DashboardPage />;
        if (tab === "transactions") return <TransactionsPage />;
        if (tab === "import")       return <CsvImportPage />;
        if (tab === "analytics")    return <AnalyticsPage />;
        return <InsightsPage />;
      }}
    </AppShell>
  );
}
