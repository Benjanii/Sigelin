// frontend/src/layout/Shell.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getRoleFromToken, clearToken } from "../auth";
import NotificationBell from "../components/NotificationBell";

export default function Shell({ children }) {
  const role = getRoleFromToken();
  const loc = useLocation();
  const nav = useNavigate();

  const LinkItem = ({ to, children }) => (
    <Link
      to={to}
      style={{
        padding: "10px 14px",
        display: "block",
        textDecoration: "none",
        color: loc.pathname.startsWith(to) ? "#e6eefc" : "#bfcbd6",
        background: loc.pathname.startsWith(to) ? "rgba(107,140,255,0.08)" : "transparent",
        borderRadius: 8,
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {children}
    </Link>
  );

  const logout = () => {
    clearToken();
    nav("/login", { replace: true });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", gap: 16 }}>
      <aside className="panel" style={{ padding: 18, borderRight: "1px solid rgba(255,255,255,0.02)", height: "100vh", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>SIGELIN</h3>
          {/* Campanita solo para DIRECTOR */}
          {role === "DIRECTOR" && <NotificationBell />}
        </div>

        <div style={{ marginBottom: 12, fontSize: 13 }} className="muted">Rol: {role}</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <LinkItem to="/dashboard">Dashboard</LinkItem>
          <LinkItem to="/inventory">Inventario</LinkItem>
          <LinkItem to="/reports">Reportes</LinkItem>
          <LinkItem to="/parts">Repuestos</LinkItem>
          <LinkItem to="/repairs">Reparaciones</LinkItem>
          {/* Compras solo ADMIN */}
          {role === "ADMIN" && <LinkItem to="/purchases">Compras</LinkItem>}
        </nav>
        <button onClick={logout} style={{ marginTop: 16, width: "100%" }}>Cerrar sesión</button>
      </aside>

      <main style={{ padding: 20 }}>
        <div className="panel" style={{ padding: 18 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
