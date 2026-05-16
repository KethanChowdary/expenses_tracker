import { useState } from "react";
import { useAuth } from "../../lib/authContext";

export default function Header({ title }: { title: string }) {
  const month = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (user?.name || user?.email || "U")
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="app-header" style={{
      background: "#0f172a",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "sticky",
      top: 0,
      zIndex: 10,
      borderBottom: "0.5px solid #1e293b",
    }}>
      <div>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{month}</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: 0, letterSpacing: "-0.5px" }}>
          {title}
        </h1>
      </div>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          title={user?.email ?? "Account"}
          aria-label="Account menu"
          aria-expanded={menuOpen}
          style={{
            width: 38,
            height: 38,
            minWidth: 38,
            borderRadius: "50%",
            border: "0.5px solid #6366f1",
            background: "#312e81",
            color: "#c7d2fe",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {initials}
        </button>

        {menuOpen && (
          <div style={{
            position: "absolute",
            top: 46,
            right: 0,
            width: 220,
            background: "#111827",
            border: "0.5px solid #334155",
            borderRadius: 12,
            padding: 10,
            boxShadow: "0 18px 40px rgba(2, 6, 23, 0.35)",
            zIndex: 30,
          }}>
            <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 800, margin: "0 0 2px" }}>
              {user?.name}
            </p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 10px", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email}
            </p>
            <button
              onClick={() => { setMenuOpen(false); void logout(); }}
              style={{
                width: "100%",
                minHeight: 38,
                borderRadius: 9,
                border: "0.5px solid #334155",
                background: "#0f172a",
                color: "#f87171",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
