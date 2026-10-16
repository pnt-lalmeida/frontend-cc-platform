import { useMsal } from "@azure/msal-react";
import { NavLink, Outlet } from "react-router-dom";
import { FeaturesProvider, useFeatures } from "../features/FeaturesContext";
import { CampanaAlertas } from "./alertas/CampanaAlertas";

export function AppShell() {
  return (
    <FeaturesProvider>
      <AppShellContenido />
    </FeaturesProvider>
  );
}

function AppShellContenido() {
  const { instance, accounts } = useMsal();
  const { habilitada } = useFeatures();
  const account = instance.getActiveAccount() ?? accounts[0];
  const nombre = account?.name ?? account?.username ?? "";

  function logout() {
    instance.logoutPopup().catch((error) => {
      console.error("Error al cerrar sesión", error);
    });
  }

  const entradas = [
    ...(habilitada("mi_dia") ? [{ to: "/mi-dia", largo: "Mi día", corto: "Mi día" }] : []),
    { to: "/cliente-360", largo: "Cliente 360", corto: "Cliente 360" },
    { to: "/bandeja", largo: "Bandeja de autorización", corto: "Bandeja" },
    ...(habilitada("cobranza_programada")
      ? [{ to: "/cobranza", largo: "Cobranza programada", corto: "Cobranza" }]
      : []),
  ];

  return (
    <div>
      <header
        className="app-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "0 40px",
          height: 64,
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-line)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19 }}>
          Pontyn
        </div>
        {/* En escritorio vive en el header; hasta 720px el CSS (tokens.css) lo
            lleva a una barra fija al pie, con la etiqueta corta (data-corto). */}
        <nav
          className="app-header-nav"
          aria-label="Menú principal"
          data-entradas={entradas.length}
          style={{ display: "flex", gap: 4 }}
        >
          {entradas.map((e) => (
            <NavLink key={e.to} to={e.to} className="app-nav-link" data-corto={e.corto} style={navLinkStyle}>
              <span className="app-nav-largo">{e.largo}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        {habilitada("alertas") && <CampanaAlertas />}
        <div className="app-header-usuario" style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
          {nombre}
        </div>
        <button
          className="app-header-salir"
          onClick={logout}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 12.5,
            color: "var(--color-muted)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </header>
      <main className="app-main" style={{ padding: 28 }}>
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
