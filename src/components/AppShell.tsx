import { useMsal } from "@azure/msal-react";
import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  const { accounts } = useMsal();
  const nombre = accounts[0]?.name ?? accounts[0]?.username ?? "";

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "0 40px",
          height: 64,
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19 }}>
          Pontyn
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          <NavLink to="/cliente-360" style={navLinkStyle}>
            Cliente 360
          </NavLink>
          <NavLink to="/bandeja" style={navLinkStyle}>
            Bandeja de autorización
          </NavLink>
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>{nombre}</div>
      </header>
      <main style={{ padding: 28 }}>
        <Outlet />
      </main>
    </div>
  );
}

function navLinkStyle({ isActive }: { isActive: boolean }) {
  return {
    padding: "8px 14px",
    borderRadius: 6,
    textDecoration: "none",
    fontWeight: 500,
    fontSize: 13.5,
    color: isActive ? "var(--color-ink)" : "var(--color-muted)",
    background: isActive ? "var(--color-paper)" : "transparent",
  };
}
