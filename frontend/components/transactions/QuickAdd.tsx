"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { txApi } from "../../lib/api";
import { guessCategory, parseQuickAdd, CATEGORY_EMOJI, isIncomeCategory, looksLikeIncome } from "../../lib/categories";

type EntryKind = "spend" | "income" | "lent" | "investment";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "#1e293b",
  border: "0.5px solid #334155",
  borderRadius: 12,
  padding: "12px 14px",
  color: "#f1f5f9",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export default function QuickAdd() {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [kind, setKind] = useState<EntryKind>("spend");
  const [lentTo, setLentTo] = useState("");
  const [paymentMode, setPaymentMode] = useState<"account" | "cash">("account");
  const [showShortcut, setShowShortcut] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: txApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setTitle("");
      setAmount("");
      setShortcut("");
      setLentTo("");
      setKind("spend");
      setError("");
      titleRef.current?.focus();
    },
    onError: () => setError("Failed to save. Try again."),
  });

  useEffect(() => {
    const parsed = parseQuickAdd(shortcut);
    if (!parsed) return;
    setTitle(parsed.merchant);
    setAmount(String(parsed.amount));
    const category = guessCategory(parsed.merchant);
    if (isIncomeCategory(category) || looksLikeIncome(parsed.merchant)) setKind("income");
  }, [shortcut]);

  const category = useMemo(() => {
    if (kind === "lent") return "Lent";
    if (kind === "investment") return "Investment";
    return guessCategory(title || shortcut);
  }, [kind, shortcut, title]);

  const txType: "expense" | "income" = kind === "income" ? "income" : "expense";
  const numericAmount = Number(amount);

  function sanitizeAmount(value: string) {
    const cleaned = value.replace(/[^\d.]/g, "");
    const [whole, ...rest] = cleaned.split(".");
    return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
  }

  function handleSubmit() {
    if (!title.trim()) { setError("Enter what this was for."); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError("Enter a valid amount."); return; }
    if (kind === "lent" && !lentTo.trim()) { setError("Enter who you lent money to."); return; }

    mutate({
      amount: numericAmount,
      type: txType,
      category,
      merchant: title.trim(),
      description: shortcut || `${title.trim()} ${numericAmount}`,
      spend_kind: kind === "lent" ? "lent" : kind === "investment" ? "investment" : "regular",
      lent_to: kind === "lent" ? lentTo.trim() : null,
      lent_status: kind === "lent" ? "outstanding" : "none",
      payment_mode: paymentMode,
      source: "manual",
    });
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        background: "#111827",
        border: "0.5px solid #1e293b",
        borderRadius: 16,
        padding: 12,
      }}>
        <div className="quick-add-main-grid" style={{ display: "grid", gap: 8 }}>
          <input
            ref={titleRef}
            value={title}
            onChange={e => { setTitle(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="What was it for?"
            style={fieldStyle}
          />
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
              fontSize: 15,
              fontWeight: 800,
              pointerEvents: "none",
            }}>
              ₹
            </span>
            <input
              value={amount}
              onChange={e => { setAmount(sanitizeAmount(e.target.value)); setError(""); }}
              onBeforeInput={e => {
                const data = e.data ?? "";
                if (data && !/[\d.]/.test(data)) e.preventDefault();
                if (data === "." && amount.includes(".")) e.preventDefault();
              }}
              onPaste={e => {
                e.preventDefault();
                setAmount(sanitizeAmount(e.clipboardData.getData("text")));
              }}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              inputMode="decimal"
              placeholder="Amount"
              style={{ ...fieldStyle, paddingLeft: 32, fontWeight: 700 }}
            />
          </div>
        </div>

        <div className="quick-add-kind-grid" style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {([
            ["spend", "Spend"],
            ["income", "Income"],
            ["lent", "Lent"],
            ["investment", "Invest"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setKind(value)}
              style={{
                minHeight: 38,
                borderRadius: 12,
                border: `0.5px solid ${kind === value ? "#6366f1" : "#334155"}`,
                background: kind === value ? "#312e81" : "#0f172a",
                color: kind === value ? "#c4b5fd" : "#64748b",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="quick-add-payment-grid" style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {(["account", "cash"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setPaymentMode(mode)}
              style={{
                minHeight: 38,
                borderRadius: 12,
                border: `0.5px solid ${paymentMode === mode ? "#2dd4bf" : "#334155"}`,
                background: paymentMode === mode ? "#134e4a" : "#0f172a",
                color: paymentMode === mode ? "#5eead4" : "#64748b",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {kind === "lent" && (
          <input
            value={lentTo}
            onChange={e => { setLentTo(e.target.value); setError(""); }}
            placeholder="Who did you lend to?"
            style={{ ...fieldStyle, marginTop: 10 }}
          />
        )}

        <button
          onClick={() => setShowShortcut(v => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            fontSize: 12,
            padding: "10px 0 0",
            cursor: "pointer",
          }}
        >
          {showShortcut ? "Hide shortcut" : "Use quick text shortcut"}
        </button>

        {showShortcut && (
          <input
            value={shortcut}
            onChange={e => { setShortcut(e.target.value); setError(""); }}
            placeholder='coffee 180  •  uber 240  •  salary 55000'
            style={{ ...fieldStyle, marginTop: 8, fontSize: 13 }}
          />
        )}

        {(title || amount) && (
          <div style={{
            marginTop: 10,
            padding: "9px 11px",
            background: "#0f172a",
            borderRadius: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
          }}>
            <span style={{ fontSize: 13, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {CATEGORY_EMOJI[category] ?? "📦"} {title || "Untitled"} · {category}
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: txType === "income" ? "#34d399" : "#f87171", flexShrink: 0 }}>
              {txType === "income" ? "+" : "-"}₹{Number.isFinite(numericAmount) ? numericAmount.toLocaleString("en-IN") : "0"}
            </span>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: "#f87171", margin: "8px 0 0" }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          style={{
            width: "100%",
            marginTop: 10,
            background: "#6366f1",
            border: "none",
            borderRadius: 12,
            minHeight: 46,
            color: "white",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Adding..." : `Add ${kind === "income" ? "Income" : kind === "lent" ? "Lent Money" : kind === "investment" ? "Investment" : "Spend"}`}
        </button>
      </div>
    </div>
  );
}
