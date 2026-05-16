"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Transaction, txApi } from "../../lib/api";
import { useCategories, CATEGORY_ICON_OPTIONS } from "../../lib/customCategories";

type FormState = {
  category: string;
  amount: string;
  type: "expense" | "income";
  merchant: string;
  transaction_date: string;
  reason: string;
  reason_photo: string;
  spend_kind: "regular" | "lent" | "investment";
  lent_to: string;
  lent_status: "none" | "outstanding" | "received";
  received_mode: "cash" | "account" | "";
  received_date: string;
  payment_mode: "cash" | "account";
  is_recurring: number;
  recurring_name: string;
  investment_value: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  border: "0.5px solid #334155",
  borderRadius: 8,
  padding: "9px 11px",
  color: "#f1f5f9",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

export default function TxItem({ tx }: { tx: Transaction }) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📦");
  const { categories, addCategory, getCategoryIcon } = useCategories();
  const [form, setForm] = useState<FormState>({
    category: tx.category,
    amount: String(tx.amount),
    type: tx.type,
    merchant: tx.merchant ?? "",
    transaction_date: tx.transaction_date,
    reason: tx.reason ?? "",
    reason_photo: tx.reason_photo ?? "",
    spend_kind: tx.spend_kind ?? "regular",
    lent_to: tx.lent_to ?? "",
    lent_status: tx.lent_status ?? "none",
    received_mode: tx.received_mode ?? "",
    received_date: tx.received_date ?? "",
    payment_mode: tx.payment_mode ?? "account",
    is_recurring: tx.is_recurring ?? 0,
    recurring_name: tx.recurring_name ?? "",
    investment_value: tx.investment_value ? String(tx.investment_value) : "",
  });
  const qc = useQueryClient();
  const { mutate: del } = useMutation({
    mutationFn: () => txApi.delete(tx.id),
    onMutate: () => setDeleting(true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
    onError: () => setDeleting(false),
  });
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => txApi.update(tx.id, {
      amount: Number(form.amount),
      type: form.type,
      category: form.spend_kind === "lent" ? "Lent" : form.spend_kind === "investment" ? "Investment" : form.category,
      merchant: form.merchant || null,
      reason: form.reason || null,
      reason_photo: form.reason_photo || null,
      spend_kind: form.spend_kind,
      lent_to: form.spend_kind === "lent" ? form.lent_to || null : null,
      lent_status: form.spend_kind === "lent" ? form.lent_status : "none",
      received_mode: form.spend_kind === "lent" && form.lent_status === "received" && form.received_mode
        ? form.received_mode
        : null,
      received_date: form.spend_kind === "lent" && form.lent_status === "received"
        ? form.received_date || new Date().toISOString().slice(0, 10)
        : null,
      payment_mode: form.payment_mode,
      is_recurring: form.is_recurring,
      recurring_name: form.is_recurring ? form.recurring_name || form.merchant || form.reason || null : null,
      investment_value: form.spend_kind === "investment" && form.investment_value
        ? Number(form.investment_value)
        : null,
      transaction_date: form.transaction_date,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setEditing(false);
    },
  });

  const displayCategory = tx.spend_kind === "lent" ? "Lent" : tx.spend_kind === "investment" ? "Investment" : tx.category;
  const emoji = getCategoryIcon(displayCategory);
  const isIncome = tx.type === "income";
  const date = new Date(tx.transaction_date).toLocaleDateString("en-IN", {
    day: "numeric", month: "short",
  });
  const statementInfo = tx.description || tx.merchant || "";
  const primaryText = tx.reason || tx.merchant || tx.description || displayCategory;
  const meta = [
    displayCategory,
    tx.spend_kind === "lent" && tx.lent_to ? `to ${tx.lent_to}` : "",
    tx.spend_kind === "lent" ? (tx.lent_status === "received" ? "received" : "due") : "",
    tx.spend_kind === "investment" ? "investment" : "",
    tx.reason_photo ? "photo" : "",
    date,
  ].filter(Boolean).join(" · ");
  const showStatementInfo = Boolean(tx.reason && statementInfo);
  const detailRows = [
    { label: "Category", value: displayCategory },
    { label: "Date", value: date },
    { label: "Type", value: tx.type === "income" ? "Income" : "Expense" },
    { label: "Paid from", value: tx.payment_mode === "cash" ? "Cash" : "Account" },
    { label: "Source", value: tx.source },
    tx.is_recurring ? { label: "Recurring", value: tx.recurring_name || "Yes" } : null,
    tx.reason ? { label: "Reason", value: tx.reason } : null,
    statementInfo ? { label: "Transaction info", value: statementInfo } : null,
    tx.spend_kind === "lent" && tx.lent_to ? { label: "Lent to", value: tx.lent_to } : null,
    tx.spend_kind === "lent" ? { label: "Lent status", value: tx.lent_status === "received" ? "Received" : "Not received" } : null,
    tx.received_mode ? { label: "Received as", value: tx.received_mode === "cash" ? "Cash" : "Account" } : null,
    tx.received_date ? { label: "Received date", value: new Date(tx.received_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) } : null,
    tx.spend_kind === "investment" ? { label: "Marked as", value: "Investment" } : null,
    tx.spend_kind === "investment" && tx.investment_value ? { label: "Current value", value: `₹${Math.round(tx.investment_value).toLocaleString("en-IN")}` } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row && row.value));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handlePhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("reason_photo", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  function handleAddCategory() {
    const category = addCategory(newCategory, newCategoryIcon);
    if (!category) return;
    set("category", category);
    setNewCategory("");
    setNewCategoryIcon("📦");
  }

  return (
    <div style={{ borderBottom: "0.5px solid #1e293b", opacity: deleting ? 0.4 : 1 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        cursor: "pointer",
        transition: "opacity 0.2s",
      }} onClick={() => setExpanded(v => !v)}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "#1e293b",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0", margin: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {primaryText}
          </p>
          <p style={{ fontSize: 11, color: "#475569", margin: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meta}
          </p>
          {showStatementInfo && (
            <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Info: {statementInfo}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600,
            color: isIncome ? "#34d399" : tx.spend_kind === "investment" ? "#38bdf8" : tx.spend_kind === "lent" ? "#f59e0b" : "#f87171" }}>
            {isIncome ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
          </span>
          <button onClick={(e) => { e.stopPropagation(); setEditing(v => !v); }} style={{
            background: "none", border: "none", cursor: "pointer",
            color: editing ? "#a5b4fc" : "#475569", fontSize: 16, padding: 4,
            display: "flex", alignItems: "center",
          }}>
            <i className="ti ti-pencil" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); del(); }} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#475569", fontSize: 16, padding: 4,
            display: "flex", alignItems: "center",
          }}>
            <i className="ti ti-trash" />
          </button>
        </div>
      </div>

      {expanded && !editing && (
        <div style={{
          background: "#111827",
          border: "0.5px solid #1e293b",
          borderRadius: 10,
          padding: 12,
          margin: "0 0 12px 52px",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {detailRows.map(row => (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 10 }}>
                <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {row.label}
                </span>
                <span style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {tx.reason_photo && (
            <img
              src={tx.reason_photo}
              alt=""
              onClick={() => setPhotoOpen(true)}
              style={{
                width: "100%",
                maxHeight: 220,
                objectFit: "cover",
                borderRadius: 8,
                marginTop: 12,
                border: "0.5px solid #334155",
                cursor: "zoom-in",
              }}
            />
          )}
        </div>
      )}

      {editing && (
        <div style={{
          background: "#111827",
          border: "0.5px solid #1e293b",
          borderRadius: 10,
          padding: 12,
          margin: "0 0 12px 52px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={e => set("amount", e.target.value)}
              placeholder="Amount"
              style={inputStyle}
            />
            <input
              type="date"
              value={form.transaction_date}
              onChange={e => set("transaction_date", e.target.value)}
              style={inputStyle}
            />
            <input
              value={form.merchant}
              onChange={e => set("merchant", e.target.value)}
              placeholder="Merchant/title"
              style={inputStyle}
            />
            <select
              value={form.type}
              onChange={e => set("type", e.target.value as FormState["type"])}
              style={inputStyle}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select
              value={form.spend_kind}
              onChange={e => set("spend_kind", e.target.value as FormState["spend_kind"])}
              style={inputStyle}
            >
              <option value="regular">Spend</option>
              <option value="lent">Money lent</option>
              <option value="investment">Investment</option>
            </select>
            <select
              value={form.payment_mode}
              onChange={e => set("payment_mode", e.target.value as FormState["payment_mode"])}
              style={inputStyle}
            >
              <option value="account">Account</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {form.spend_kind === "regular" && (
            <>
              <select value={form.category} onChange={e => set("category", e.target.value)} style={inputStyle}>
                {categories.filter(c => c !== "Lent" && c !== "Investment").map(c => (
                  <option key={c} value={c}>{getCategoryIcon(c)} {c}</option>
                ))}
              </select>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 6,
              }}>
                {CATEGORY_ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewCategoryIcon(icon)}
                    style={{
                      height: 32,
                      borderRadius: 8,
                      border: `0.5px solid ${newCategoryIcon === icon ? "#6366f1" : "#334155"}`,
                      background: newCategoryIcon === icon ? "#312e81" : "#0f172a",
                      color: "#f1f5f9",
                      fontSize: 17,
                      cursor: "pointer",
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                  placeholder="Add custom category"
                  style={inputStyle}
                />
                <button
                  onClick={handleAddCategory}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    background: "#1e293b",
                    color: "#a5b4fc",
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Add
                </button>
              </div>
            </>
          )}

          {form.spend_kind === "lent" && (
            <>
              <input
                value={form.lent_to}
                onChange={e => set("lent_to", e.target.value)}
                placeholder="Person name"
                style={inputStyle}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select
                  value={form.lent_status}
                  onChange={e => set("lent_status", e.target.value as FormState["lent_status"])}
                  style={inputStyle}
                >
                  <option value="outstanding">Not received</option>
                  <option value="received">Received</option>
                </select>
                {form.lent_status === "received" && (
                  <select
                    value={form.received_mode}
                    onChange={e => set("received_mode", e.target.value as FormState["received_mode"])}
                    style={inputStyle}
                  >
                    <option value="">Received as...</option>
                    <option value="account">Account</option>
                    <option value="cash">Cash</option>
                  </select>
                )}
              </div>
              {form.lent_status === "received" && (
                <input
                  type="date"
                  value={form.received_date}
                  onChange={e => set("received_date", e.target.value)}
                  style={inputStyle}
                />
              )}
            </>
          )}

          {form.spend_kind === "investment" && (
            <input
              type="number"
              min="1"
              value={form.investment_value}
              onChange={e => set("investment_value", e.target.value)}
              placeholder="Current value, optional"
              style={inputStyle}
            />
          )}

          <textarea
            value={form.reason}
            onChange={e => set("reason", e.target.value)}
            placeholder="Reason or note"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={Boolean(form.is_recurring)}
              onChange={e => set("is_recurring", e.target.checked ? 1 : 0)}
            />
            Recurring spend
          </label>
          {Boolean(form.is_recurring) && (
            <input
              value={form.recurring_name}
              onChange={e => set("recurring_name", e.target.value)}
              placeholder="Recurring name, e.g. Rent, SIP, Netflix"
              style={inputStyle}
            />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{
              padding: "8px 11px",
              borderRadius: 8,
              background: "#0f172a",
              border: "0.5px solid #334155",
              color: "#94a3b8",
              fontSize: 12,
              cursor: "pointer",
            }}>
              Add photo
              <input type="file" accept="image/*" onChange={e => handlePhoto(e.target.files?.[0])} style={{ display: "none" }} />
            </label>
            {form.reason_photo && (
              <>
                <img src={form.reason_photo} alt="" style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 6 }} />
                <button onClick={() => set("reason_photo", "")} style={{
                  background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12,
                }}>
                  Remove
                </button>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => save()}
              disabled={saving}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 9,
                border: "none",
                background: "#6366f1",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 9,
                border: "0.5px solid #334155",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {photoOpen && tx.reason_photo && (
        <div
          onClick={() => setPhotoOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.9)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <img
            src={tx.reason_photo}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "82vh",
              borderRadius: 12,
              border: "0.5px solid #334155",
            }}
          />
        </div>
      )}
    </div>
  );
}
