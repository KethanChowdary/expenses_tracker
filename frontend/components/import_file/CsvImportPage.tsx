"use client";
import { useState, useRef } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "../../custom_library/getApiBaseUrl";
import { getAuthToken } from "../../custom_library/api";

type Step = "upload" | "password" | "map" | "review" | "done";
type Mode = "single" | "split"; // single amount col vs separate debit/credit cols

interface AutoMap {
  date_col: string;
  amount_col: string;
  debit_col: string;
  credit_col: string;
  description_col: string;
  category_col: string;
  type_col: string;
  balance_col: string;
  mode: Mode;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

interface ReviewTx {
  amount: number;
  type: "expense" | "income";
  category: string;
  merchant: string | null;
  description: string | null;
  reason?: string | null;
  spend_kind: "regular" | "lent" | "investment";
  lent_to?: string | null;
  lent_status: "none" | "outstanding" | "received";
  payment_mode: "cash" | "account";
  import_fingerprint: string | null;
  source: string;
  transaction_date: string;
}

interface ReviewRow {
  row_id: string;
  selected: boolean;
  duplicate: boolean;
  duplicate_in_file: boolean;
  existing: ReviewTx | null;
  transaction: ReviewTx;
}

// ── styles ────────────────────────────────────────────────

const S = {
  card: {
    background: "#1e293b",
    borderRadius: 14,
    padding: "16px",
  } as React.CSSProperties,

  label: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
    display: "block",
  } as React.CSSProperties,

  input: {
    width: "100%",
    background: "#0f172a",
    border: "0.5px solid #334155",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#f1f5f9",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,

  select: {
    width: "100%",
    background: "#0f172a",
    border: "0.5px solid #334155",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#f1f5f9",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 32,
  } as React.CSSProperties,

  btn: (accent?: boolean, disabled?: boolean) => ({
    width: "100%",
    padding: "13px",
    borderRadius: 12,
    border: "none",
    background: accent ? "#6366f1" : "#1e293b",
    color: accent ? "white" : "#64748b",
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1,
    transition: "opacity 0.15s",
  } as React.CSSProperties),

  pill: (active: boolean) => ({
    padding: "6px 14px",
    borderRadius: 20,
    border: `0.5px solid ${active ? "#6366f1" : "#334155"}`,
    background: active ? "#312e81" : "transparent",
    color: active ? "#a5b4fc" : "#64748b",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  } as React.CSSProperties),
};

// ── select helper ─────────────────────────────────────────

function ColSelect({
  label,
  value,
  onChange,
  headers,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  headers: string[];
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label style={S.label}>
        {label}
        {required && <span style={{ color: "#f87171" }}> *</span>}
        {hint && (
          <span style={{ color: "#475569", fontWeight: 400, marginLeft: 6 }}>
            — {hint}
          </span>
        )}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...S.select,
          borderColor: required && !value ? "#f87171" : "#334155",
        }}
      >
        <option value="">— skip —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── main component ────────────────────────────────────────

export default function CsvImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");

  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);

  // Column mapping state
  const [mode, setMode] = useState<Mode>("single");
  const [dateCol, setDateCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  const [debitCol, setDebitCol] = useState("");
  const [creditCol, setCreditCol] = useState("");
  const [descCol, setDescCol] = useState("");
  const [categoryCol, setCategoryCol] = useState("");
  const [typeCol, setTypeCol] = useState("");
  const [defaultType, setDefaultType] = useState("expense");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // ── preview call ────────────────────────────────────────

  async function callPreview(f: File, pw = "") {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", f);
    fd.append("password", pw);


    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/imports/preview`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.status === 423) { setStep("password"); return; }
      if (res.status === 401) { setPwError("Wrong password. Try again."); return; }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(`Could not read file: ${err?.detail || res.statusText}`);
        setStep("upload");
        return;
      }

      const data = await res.json();
      applyPreview(data.headers, data.preview_rows, data.auto_map);
      setStep("map");
      setPwError("");
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
      setStep("upload");
    } finally {
      setLoading(false);
    }
  }

  function applyPreview(
    hdrs: string[],
    rows: Record<string, string>[],
    autoMap?: AutoMap
  ) {
    setHeaders(hdrs);
    setPreview(rows);

    if (autoMap) {
      setMode(autoMap.mode ?? "single");
      setDateCol(autoMap.date_col ?? "");
      setAmountCol(autoMap.amount_col ?? "");
      setDebitCol(autoMap.debit_col ?? "");
      setCreditCol(autoMap.credit_col ?? "");
      setDescCol(autoMap.description_col ?? "");
      setCategoryCol(autoMap.category_col ?? "");
      setTypeCol(autoMap.type_col ?? "");
    }
  }

  async function handleFile(f: File) {
    setFile(f);
    setError("");
    setPassword("");
    setPwError("");
    await callPreview(f);
  }

  async function handlePasswordSubmit() {
    if (!file || !password.trim()) return;
    setPwError("");
    await callPreview(file, password);
  }

  // ── import call ─────────────────────────────────────────

  function buildMappingFormData() {
    if (!dateCol) { setError("Date column is required."); return; }
    if (mode === "single" && !amountCol) { setError("Amount column is required."); return; }
    if (mode === "split" && (!debitCol || !creditCol)) {
      setError("Both Debit and Credit columns are required in split mode.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file!);
    fd.append("password", password);
    fd.append("date_col", dateCol);
    fd.append("default_type", defaultType);
    if (descCol) fd.append("description_col", descCol);
    if (categoryCol) fd.append("category_col", categoryCol);

    if (mode === "split") {
      fd.append("debit_col", debitCol);
      fd.append("credit_col", creditCol);
    } else {
      fd.append("amount_col", amountCol);
      if (typeCol) fd.append("type_col", typeCol);
    }
    return fd;
  }

  async function handleReview() {
    const fd = buildMappingFormData();
    if (!fd) return;

    try {
      setLoading(true);
      setError("");
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/imports/review`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(`Review failed: ${err?.detail || "Check your column mapping."}`);
        return;
      }
      const data = await res.json();
      setReviewRows(data.rows ?? []);
      setStep("review");
    } catch {
      setError("Review failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommitImport() {
    const transactions = reviewRows
      .filter(row => row.selected && !row.duplicate && !row.duplicate_in_file)
      .map(row => row.transaction);
    try {
      setLoading(true);
      setError("");
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/imports/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ transactions }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(`Import failed: ${err?.detail || "Could not save transactions."}`);
        return;
      }
      const data = await res.json();
      setResult(data);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["transactions"] });
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateReviewTx(rowId: string, patch: Partial<ReviewTx>) {
    setReviewRows(rows => rows.map(row => (
      row.row_id === rowId ? { ...row, transaction: { ...row.transaction, ...patch } } : row
    )));
  }

  function toggleReviewRow(rowId: string) {
    setReviewRows(rows => rows.map(row => {
      if (row.row_id !== rowId || row.duplicate || row.duplicate_in_file) return row;
      return { ...row, selected: !row.selected };
    }));
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setReviewRows([]);
    setResult(null);
    setError("");
    setPassword("");
    setPwError("");
    setDateCol(""); setAmountCol(""); setDebitCol("");
    setCreditCol(""); setDescCol(""); setCategoryCol("");
    setTypeCol(""); setMode("single");
  }

  // ── UPLOAD step ─────────────────────────────────────────

  if (step === "upload") return (
    <div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
        Upload a CSV, XLSX, or PDF exported from your bank.
      </p>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        style={{
          border: "1.5px dashed #334155",
          borderRadius: 16,
          padding: "48px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: "#111827",
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
        <p style={{ color: "#94a3b8", margin: 0, fontSize: 15 }}>
          Tap to select file
        </p>
        <p style={{ color: "#475569", margin: "4px 0 0", fontSize: 12 }}>
          CSV · XLSX · PDF — drag & drop or tap
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
      {loading && (
        <p style={{ color: "#818cf8", textAlign: "center", marginTop: 16 }}>
          Reading file…
        </p>
      )}
      {error && (
        <p style={{ color: "#f87171", marginTop: 12, fontSize: 13 }}>{error}</p>
      )}
    </div>
  );

  // ── PASSWORD step ───────────────────────────────────────

  if (step === "password") return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px" }}>
          File is password protected
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{file?.name}</p>
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <label style={S.label}>Enter file password</label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPwError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            placeholder="Enter password…"
            autoFocus
            style={{ ...S.input, paddingRight: 44 }}
          />
          <button
            onClick={() => setShowPw((p) => !p)}
            style={{
              position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)",
              background: "none", border: "none",
              cursor: "pointer", color: "#64748b", fontSize: 16, padding: 4,
            }}
          >
            <i className={`ti ${showPw ? "ti-eye-off" : "ti-eye"}`} />
          </button>
        </div>
        {pwError && (
          <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>❌ {pwError}</p>
        )}
        <p style={{ fontSize: 11, color: "#475569", marginTop: 10 }}>
          💡 Indian bank statements are often protected with your date of birth
          (DDMMYYYY) or PAN number.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={handlePasswordSubmit}
          disabled={loading || !password.trim()}
          style={S.btn(true, loading || !password.trim())}
        >
          {loading ? "Unlocking…" : "Unlock & Continue →"}
        </button>
        <button onClick={reset} style={S.btn()}>← Try a different file</button>
      </div>
    </div>
  );

  // ── MAP step ────────────────────────────────────────────

  if (step === "map") return (
    <div>
      {/* File info */}
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
        <span style={{ color: "#94a3b8" }}>{file?.name}</span>
        {" · "}
        <span style={{ color: "#6366f1" }}>{headers.length} columns</span>
        {password && (
          <span style={{ color: "#34d399", marginLeft: 8 }}>🔓 Unlocked</span>
        )}
      </p>

      {/* Preview table */}
      <div style={{ ...S.card, marginBottom: 16, overflowX: "auto" }}>
        <p style={{ ...S.label, marginBottom: 8 }}>Preview (first 5 rows)</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  style={{
                    color: "#6366f1", textAlign: "left",
                    padding: "4px 8px", borderBottom: "0.5px solid #334155",
                    whiteSpace: "nowrap", fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td
                    key={h}
                    style={{
                      color: "#94a3b8", padding: "4px 8px",
                      borderBottom: "0.5px solid #1e293b",
                      whiteSpace: "nowrap", maxWidth: 160,
                      overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Amount mode toggle */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <label style={{ ...S.label, marginBottom: 10 }}>Amount column format</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button style={S.pill(mode === "single")} onClick={() => setMode("single")}>
            Single amount column
          </button>
          <button style={S.pill(mode === "split")} onClick={() => setMode("split")}>
            Separate Debit / Credit
          </button>
        </div>

        {/* Mode hint */}
        <p style={{ fontSize: 11, color: "#475569", margin: "0 0 14px" }}>
          {mode === "split"
            ? "💡 Most bank statements (SBI, HDFC, ICICI) use separate Debit and Credit columns."
            : "💡 Use this if your file has one amount column and a separate type/DR-CR column."}
        </p>

        {/* Columns for selected mode */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ColSelect
            label="Date column"
            value={dateCol}
            onChange={setDateCol}
            headers={headers}
            required
          />

          {mode === "split" ? (
            <>
              <ColSelect
                label="Debit column"
                value={debitCol}
                onChange={setDebitCol}
                headers={headers}
                required
                hint="withdrawals / expenses"
              />
              <ColSelect
                label="Credit column"
                value={creditCol}
                onChange={setCreditCol}
                headers={headers}
                required
                hint="deposits / income"
              />
            </>
          ) : (
            <>
              <ColSelect
                label="Amount column"
                value={amountCol}
                onChange={setAmountCol}
                headers={headers}
                required
              />
              <ColSelect
                label="Type column"
                value={typeCol}
                onChange={setTypeCol}
                headers={headers}
                hint="DR/CR or expense/income"
              />
            </>
          )}

          <ColSelect
            label="Description column"
            value={descCol}
            onChange={setDescCol}
            headers={headers}
            hint="narration / details / particulars"
          />
          <ColSelect
            label="Category column"
            value={categoryCol}
            onChange={setCategoryCol}
            headers={headers}
          />

          {/* Default type — only shown in single mode without a type col */}
          {mode === "single" && !typeCol && (
            <div>
              <label style={S.label}>Default transaction type</label>
              <select
                value={defaultType}
                onChange={(e) => setDefaultType(e.target.value)}
                style={S.select}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p style={{ color: "#f87171", marginBottom: 12, fontSize: 13 }}>{error}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={handleReview}
          disabled={loading}
          style={S.btn(true, loading)}
        >
          {loading ? "Checking…" : "Review Transactions"}
        </button>
        <button onClick={reset} style={S.btn()}>← Back</button>
      </div>
    </div>
  );

  // ── REVIEW step ─────────────────────────────────────────

  if (step === "review") {
    const selectedCount = reviewRows.filter(row => row.selected && !row.duplicate && !row.duplicate_in_file).length;
    const duplicateCount = reviewRows.filter(row => row.duplicate || row.duplicate_in_file).length;

    return (
      <div>
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Ready", value: selectedCount, color: "#34d399" },
              { label: "Duplicates", value: duplicateCount, color: "#f59e0b" },
              { label: "Rows", value: reviewRows.length, color: "#a5b4fc" },
            ].map(item => (
              <div key={item.label}>
                <p style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", margin: "0 0 4px" }}>{item.label}</p>
                <p style={{ color: item.color, fontSize: 20, fontWeight: 800, margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {reviewRows.map(row => {
            const disabled = row.duplicate || row.duplicate_in_file;
            return (
              <div key={row.row_id} style={{
                ...S.card,
                border: `0.5px solid ${disabled ? "#78350f" : row.selected ? "#1e3a8a" : "#334155"}`,
                opacity: disabled ? 0.72 : 1,
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={row.selected && !disabled}
                    disabled={disabled}
                    onChange={() => toggleReviewRow(row.row_id)}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.transaction.description || row.transaction.merchant || row.transaction.category}
                      </p>
                      <span style={{ color: row.transaction.type === "income" ? "#34d399" : "#f87171", fontWeight: 800 }}>
                        {row.transaction.type === "income" ? "+" : "-"}₹{Math.round(row.transaction.amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 8px" }}>
                      {row.transaction.category} · {row.transaction.transaction_date}
                    </p>
                    {disabled && (
                      <div style={{ background: "#451a03", borderRadius: 8, padding: 8, marginBottom: 8 }}>
                        <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, margin: "0 0 4px" }}>
                          {row.duplicate ? "Already imported" : "Duplicate row in this file"}
                        </p>
                        {row.existing && (
                          <p style={{ color: "#fed7aa", fontSize: 11, margin: 0, overflowWrap: "anywhere" }}>
                            Existing: {row.existing.transaction_date} · ₹{Math.round(row.existing.amount).toLocaleString("en-IN")} · {row.existing.description || row.existing.merchant}
                          </p>
                        )}
                      </div>
                    )}
                    {!disabled && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input
                          value={row.transaction.category}
                          onChange={e => updateReviewTx(row.row_id, { category: e.target.value })}
                          placeholder="Category"
                          style={S.input}
                        />
                        <select
                          value={row.transaction.spend_kind}
                          onChange={e => updateReviewTx(row.row_id, {
                            spend_kind: e.target.value as ReviewTx["spend_kind"],
                            category: e.target.value === "lent" ? "Lent" : e.target.value === "investment" ? "Investment" : row.transaction.category,
                            lent_status: e.target.value === "lent" ? "outstanding" : "none",
                            lent_to: e.target.value === "lent" ? row.transaction.lent_to ?? null : null,
                          })}
                          style={S.select}
                        >
                          <option value="regular">Spend</option>
                          <option value="lent">Money lent</option>
                          <option value="investment">Investment</option>
                        </select>
                        <select
                          value={row.transaction.payment_mode}
                          onChange={e => updateReviewTx(row.row_id, { payment_mode: e.target.value as ReviewTx["payment_mode"] })}
                          style={S.select}
                        >
                          <option value="account">Account</option>
                          <option value="cash">Cash</option>
                        </select>
                        <select
                          value={row.transaction.type}
                          onChange={e => updateReviewTx(row.row_id, { type: e.target.value as ReviewTx["type"] })}
                          style={S.select}
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                        <input
                          value={row.transaction.reason ?? ""}
                          onChange={e => updateReviewTx(row.row_id, { reason: e.target.value || null })}
                          placeholder="Reason, optional"
                          style={S.input}
                        />
                        <input
                          value={row.transaction.lent_to ?? ""}
                          onChange={e => updateReviewTx(row.row_id, {
                            lent_to: e.target.value || null,
                            lent_status: e.target.value ? "outstanding" : row.transaction.lent_status,
                          })}
                          placeholder="Lent to, optional"
                          disabled={row.transaction.spend_kind !== "lent"}
                          style={{
                            ...S.input,
                            opacity: row.transaction.spend_kind === "lent" ? 1 : 0.45,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p style={{ color: "#f87171", marginBottom: 12, fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handleCommitImport}
            disabled={loading || selectedCount === 0}
            style={S.btn(true, loading || selectedCount === 0)}
          >
            {loading ? "Importing…" : `Import ${selectedCount} Transactions`}
          </button>
          <button onClick={() => setStep("map")} style={S.btn()}>← Edit Mapping</button>
        </div>
      </div>
    );
  }

  // ── DONE step ───────────────────────────────────────────

  return (
    <div style={{ textAlign: "center", paddingTop: 40 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px" }}>
        Import Complete
      </h2>
      <div style={{ ...S.card, textAlign: "left", marginBottom: 24 }}>
        {[
          { label: "Imported",             value: result?.imported, color: "#34d399" },
          { label: "Skipped (duplicates)", value: result?.skipped,  color: "#f59e0b" },
          { label: "Errors",               value: result?.errors,   color: "#f87171" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              display: "flex", justifyContent: "space-between",
              padding: "10px 0", borderBottom: "0.5px solid #334155",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: 14 }}>{label}</span>
            <span style={{ color, fontWeight: 700, fontSize: 16 }}>{value ?? 0}</span>
          </div>
        ))}
      </div>
      <button onClick={reset} style={S.btn(true)}>Import Another File</button>
    </div>
  );
}
