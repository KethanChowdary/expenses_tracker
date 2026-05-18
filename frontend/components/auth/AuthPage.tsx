"use client";
import { useState } from "react";
import { useAuth } from "../../custom_library/authContext";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const auth = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "register") await auth.register(name, email, password);
      else await auth.login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not sign in. Check your details and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div>
          <div className="auth-logo">
            <i className="ti ti-wallet" />
          </div>
          <p className="auth-eyebrow">Personal finance workspace</p>
          <h1 className="auth-title">Track every rupee with your own private account.</h1>
          <p className="auth-copy">
            Sign in to keep transactions, imports, budgets, and insights separated by user.
          </p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-tabs">
            {(["login", "register"] as const).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => { setMode(item); setError(""); }}
                className={mode === item ? "auth-tab active" : "auth-tab"}
              >
                {item === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <label className="auth-label">
              Name
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" className="auth-input" />
            </label>
          )}
          <label className="auth-label">
            Email
            <input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="you@example.com" className="auth-input" />
          </label>
          <label className="auth-label">
            Password
            <input value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === "register" ? 8 : 1} type="password" placeholder={mode === "register" ? "At least 8 characters" : "Your password"} className="auth-input" />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button disabled={saving} className="auth-submit">
            {saving ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
