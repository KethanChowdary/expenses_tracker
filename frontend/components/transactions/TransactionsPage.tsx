"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { txApi } from "../../lib/api";
import TxItem from "./TxItem";
import PeriodBar from "../page_layouts/PeriodBar";
import { usePeriod } from "../../lib/usePeriod";
import { CATEGORY_ICON_OPTIONS, useCategories } from "../../lib/customCategories";

const FILTERS = ["All", "Expenses", "Income"] as const;
type Filter = typeof FILTERS[number];
type KindFilter = "all" | "regular" | "lent" | "investment";
type PaymentFilter = "all" | "account" | "cash";
type SavedFilter = { name: string; filter: Filter; search?: string; category: string; kind: KindFilter; paymentMode: PaymentFilter };

import { useEffect, useMemo, useState } from "react";

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [kind, setKind] = useState<KindFilter>("all");
  const [paymentMode, setPaymentMode] = useState<PaymentFilter>("all");
  const [filterName, setFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showFilterName, setShowFilterName] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const {
    categories,
    customCategories,
    hiddenCategories,
    getCategoryIcon,
    updateCategoryIcon,
    removeCategory,
    renameCategory,
    setCategoryHidden,
  } = useCategories();
  const qc = useQueryClient();
  const p = usePeriod();

  useEffect(() => {
    const saved = localStorage.getItem("expense_tracker_saved_filters");
    if (saved) setSavedFilters(JSON.parse(saved));
  }, []);

  function persistSavedFilters(next: SavedFilter[]) {
    setSavedFilters(next);
    localStorage.setItem("expense_tracker_saved_filters", JSON.stringify(next));
  }

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", p.period.dateFrom, p.period.dateTo, filter],
    queryFn: () => txApi.list({
      limit: "1000",
      order: "desc",
      date_from: p.period.dateFrom,
      date_to:   p.period.dateTo,
      ...(filter === "Expenses" ? { type: "expense" } : {}),
      ...(filter === "Income"   ? { type: "income"  } : {}),
    }),
  });

  const visibleTxs = useMemo(() => txs.filter(t => {
    const displayCategory = t.spend_kind === "lent" ? "Lent" : t.spend_kind === "investment" ? "Investment" : t.category;
    if (category !== "All" && displayCategory !== category) return false;
    if (kind !== "all" && (t.spend_kind ?? "regular") !== kind) return false;
    if (paymentMode !== "all" && (t.payment_mode ?? "account") !== paymentMode) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [
        t.amount,
        t.transaction_date,
        t.category,
        t.merchant,
        t.description,
        t.reason,
        t.lent_to,
        t.source,
        t.payment_mode,
        t.spend_kind,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [txs, category, kind, paymentMode, search]);

  const totalExp = visibleTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalInc = visibleTxs.filter(t => t.type === "income" ).reduce((s, t) => s + t.amount, 0);
  const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

  function saveCurrentFilter() {
    const name = filterName.trim();
    if (!name) return;
    const next = [
      ...savedFilters.filter(f => f.name.toLowerCase() !== name.toLowerCase()),
      { name, filter, search, category, kind, paymentMode },
    ];
    persistSavedFilters(next);
    setFilterName("");
    setShowFilterName(false);
  }

  function applySavedFilter(saved: SavedFilter) {
    setFilter(saved.filter);
    setSearch(saved.search ?? "");
    setShowSearch(Boolean(saved.search));
    setCategory(saved.category);
    setKind(saved.kind);
    setPaymentMode(saved.paymentMode ?? "all");
    setShowFilters(false);
  }

  function resetFilters() {
    setSearch("");
    setCategory("All");
    setKind("all");
    setPaymentMode("all");
    setFilterName("");
    setShowSearch(false);
    setShowFilterName(false);
  }

  async function handleRenameCategory(oldName: string) {
    const next = renameCategory(oldName, renameDrafts[oldName] ?? oldName);
    setRenameDrafts(prev => {
      const copy = { ...prev };
      delete copy[oldName];
      if (next !== oldName) copy[next] = next;
      return copy;
    });
    if (next !== oldName) {
      await Promise.all(txs.filter(t => t.category === oldName).map(t => txApi.update(t.id, { category: next })));
      qc.invalidateQueries({ queryKey: ["transactions"] });
    }
  }

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

      {/* Period summary strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8, marginBottom: 16,
      }}>
        {[
          { label: "Income",   value: fmt(totalInc), color: "#34d399" },
          { label: "Spent",    value: fmt(totalExp), color: "#f87171" },
          { label: "Saved",    value: fmt(totalInc - totalExp),
            color: totalInc - totalExp >= 0 ? "#818cf8" : "#f87171" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "#1e293b", borderRadius: 10,
            padding: "10px 12px", textAlign: "center",
          }}>
            <p style={{ fontSize: 10, color: "#64748b", margin: "0 0 2px",
              textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "5px 14px", borderRadius: 20,
            border: `0.5px solid ${filter === f ? "#6366f1" : "#334155"}`,
            background: filter === f ? "#312e81" : "transparent",
            color: filter === f ? "#a5b4fc" : "#64748b",
            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: showSearch ? 10 : 14, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowSearch(v => !v)}
          aria-expanded={showSearch}
          aria-label="Toggle search"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 42, height: 42,
            background: showSearch || search ? "#312e81" : "#1e293b",
            border: `0.5px solid ${showSearch || search ? "#6366f1" : "#334155"}`,
            borderRadius: 10,
            color: showSearch || search ? "#c7d2fe" : "#e2e8f0",
            fontSize: 18, fontFamily: "inherit", cursor: "pointer",
            position: "relative",
          }}
        >
          <i className="ti ti-search" />
          {search && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              width: 16, height: 16, borderRadius: 8,
              background: "#6366f1", color: "white", fontSize: 10,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              1
            </span>
          )}
        </button>
        <button
          onClick={() => setShowFilters(v => !v)}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: showFilters ? "#312e81" : "#1e293b",
            border: `0.5px solid ${showFilters ? "#6366f1" : "#334155"}`,
            borderRadius: 10, padding: "9px 12px",
            color: showFilters ? "#c7d2fe" : "#e2e8f0",
            fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
          }}
        >
          <i className="ti ti-filter" style={{ fontSize: 16 }} />
          Filters
          {(category !== "All" || kind !== "all" || paymentMode !== "all") && (
            <span style={{
              minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9,
              background: "#6366f1", color: "white", fontSize: 11,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {[category !== "All", kind !== "all", paymentMode !== "all"].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {showSearch && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search merchant, reason, amount..."
          autoFocus
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "#1e293b",
            border: "0.5px solid #334155",
            borderRadius: 10,
            padding: "10px 12px",
            color: "#f1f5f9",
            fontSize: 13,
            outline: "none",
            marginBottom: 14,
            fontFamily: "inherit",
          }}
        />
      )}

      {showFilters && (
        <div style={{ background: "#111827", border: "0.5px solid #1e293b", borderRadius: 12, padding: 10, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{
              background: "#1e293b", border: "0.5px solid #334155", borderRadius: 10,
              padding: "9px 10px", color: "#f1f5f9", fontSize: 13, fontFamily: "inherit",
            }}>
              <option value="All">All categories</option>
              {categories.map(c => <option key={c} value={c}>{getCategoryIcon(c)} {c}</option>)}
            </select>
            <select value={kind} onChange={e => setKind(e.target.value as KindFilter)} style={{
              background: "#1e293b", border: "0.5px solid #334155", borderRadius: 10,
              padding: "9px 10px", color: "#f1f5f9", fontSize: 13, fontFamily: "inherit",
            }}>
              <option value="all">All spend types</option>
              <option value="regular">Regular spends</option>
              <option value="lent">Money lent</option>
              <option value="investment">Investments</option>
            </select>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as PaymentFilter)} style={{
              background: "#1e293b", border: "0.5px solid #334155", borderRadius: 10,
              padding: "9px 10px", color: "#f1f5f9", fontSize: 13, fontFamily: "inherit",
            }}>
              <option value="all">Cash + account</option>
              <option value="account">Account only</option>
              <option value="cash">Cash only</option>
            </select>
            <button onClick={() => setShowCategoryManager(v => !v)} style={{
              background: "#1e293b", border: "0.5px solid #334155", borderRadius: 10,
              padding: "9px 10px", color: "#94a3b8", fontSize: 13, fontFamily: "inherit",
              cursor: "pointer",
            }}>
              Categories
            </button>
          </div>

          {showCategoryManager && (
            <div style={{ background: "#0f172a", border: "0.5px solid #1e293b", borderRadius: 12, padding: 10, marginBottom: 10 }}>
              <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>
                Custom categories
              </p>
              {customCategories.length === 0 ? (
                <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>Add custom categories from any transaction edit form.</p>
              ) : customCategories.map(cat => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input
                    value={renameDrafts[cat] ?? cat}
                    onChange={e => setRenameDrafts(prev => ({ ...prev, [cat]: e.target.value }))}
                    onBlur={() => { void handleRenameCategory(cat); }}
                    style={{ flex: 1, background: "#111827", border: "0.5px solid #334155", borderRadius: 8, color: "#f1f5f9", padding: "6px 8px", fontSize: 13 }}
                  />
                  <select
                    value={getCategoryIcon(cat)}
                    onChange={e => updateCategoryIcon(cat, e.target.value)}
                    style={{ background: "#111827", border: "0.5px solid #334155", borderRadius: 8, color: "#f1f5f9", padding: "6px 8px" }}
                  >
                    {CATEGORY_ICON_OPTIONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                  </select>
                  <button onClick={() => setCategoryHidden(cat, !hiddenCategories.includes(cat))} style={{
                    background: "transparent", border: "none", color: hiddenCategories.includes(cat) ? "#f59e0b" : "#64748b", cursor: "pointer", fontSize: 16,
                  }}>
                    <i className={`ti ${hiddenCategories.includes(cat) ? "ti-eye-off" : "ti-eye"}`} />
                  </button>
                  <button onClick={() => removeCategory(cat)} style={{
                    background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16,
                  }}>
                    <i className="ti ti-trash" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showFilterName && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                placeholder="What would you like to name this filter?"
                autoFocus
                style={{
                  flex: 1, minWidth: 0, background: "#0f172a", border: "0.5px solid #334155",
                  borderRadius: 9, padding: "9px 10px", color: "#f1f5f9", fontSize: 13,
                  outline: "none", fontFamily: "inherit",
                }}
              />
              <button onClick={saveCurrentFilter} style={{
                background: "#6366f1", border: "none", borderRadius: 9, color: "white",
                padding: "0 12px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                Save
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowFilterName(true)} style={{
              background: "#6366f1", border: "none", borderRadius: 9, color: "white",
              padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              Save filter
            </button>
            <button onClick={resetFilters} style={{
              background: "transparent", border: "0.5px solid #334155", borderRadius: 9,
              color: "#94a3b8", padding: "8px 12px", fontSize: 13, cursor: "pointer",
            }}>
              Clear
            </button>
          </div>

          {savedFilters.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {savedFilters.map(saved => (
                <button key={saved.name} onClick={() => applySavedFilter(saved)} style={{
                  padding: "5px 10px", borderRadius: 16, border: "0.5px solid #334155",
                  background: "#1e293b", color: "#94a3b8", fontSize: 12, cursor: "pointer",
                }}>
                  {saved.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <p style={{ color: "#475569", textAlign: "center", marginTop: 40 }}>Loading…</p>
      )}
      {!isLoading && visibleTxs.length === 0 && (
        <p style={{ color: "#475569", textAlign: "center", marginTop: 40, fontSize: 14 }}>
          No transactions in this period.
        </p>
      )}
      {visibleTxs.map(tx => (
        <div key={tx.id}>
          <TxItem tx={tx} />
        </div>
      ))}
    </div>
  );
}
