import { NavLink, useNavigate } from "react-router-dom";
import { clearToken, getRoleFromToken } from "../auth";
import api from "../api";
import { useEffect, useState } from "react";

const LinkItem = ({ to, children, requirePerm }) => {
  // si quieres condicionar por permisos, trae can() aquí
  return (
    <NavLink
      to={to}
      style={({isActive}) => ({
        display:"block", padding:"8px 12px",
        background: isActive ? "#222" : "transparent",
        color:"#eee", textDecoration:"none", borderRadius:6
      })}
    >
      {children}
    </NavLink>
  );
};

function NotificationBell({ role }) {
  const [list, setList] = useState([]);
  const nav = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setList(Array.isArray(data) ? data.filter(n => !n.read) : []);
    } catch {}
  };

  useEffect(()=>{ load(); const id = setInterval(load, 8000); return ()=>clearInterval(id); }, []);

  const onClick = () => {
    // Para el Director, ir a reportes de compra
    if (role === "DIRECTOR") {
      nav("/purchase-reports");
    } else {
      alert("No tienes reportes asignados.");
    }
  };

  return (
    <button onClick={onClick} style={{ position:"relative" }}>
      🔔
      {list.length > 0 && (
        <span style={{
          position:"absolute", top:-6, right:-6, background:"crimson",
          color:"#fff", borderRadius:"50%", fontSize:12, padding:"2px 6px"
        }}>{list.length}</span>
      )}
    </button>
  );
}

export default function Shell({ children }) {
  const nav = useNavigate();
  const role = getRoleFromToken();

  const logout = () => { clearToken(); nav("/login", { replace:true }); };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", minHeight:"100vh", background:"#111", color:"#eee" }}>
      <aside style={{ padding:16, borderRight:"1px solid #333" }}>
        <div style={{ marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:"bold" }}>SIGELIN</div>
            <div style={{ fontSize:12, opacity:0.7 }}>Rol: {role || "N/A"}</div>
          </div>
          <NotificationBell role={role} />
        </div>
        <nav style={{ display:"grid", gap:6 }}>
          <LinkItem to="/dashboard">Dashboard</LinkItem>
          <LinkItem to="/inventory">Inventario</LinkItem>
          <LinkItem to="/repairs">Reparaciones</LinkItem>
          <LinkItem to="/parts">Repuestos</LinkItem>
          <LinkItem to="/purchases">Compras</LinkItem>
          <LinkItem to="/reports">Reportes</LinkItem>
          {role === "ADMIN" && <LinkItem to="/users">Usuarios</LinkItem>}
          {role === "DIRECTOR" && <LinkItem to="/purchase-reports">Reportes de compra</LinkItem>}
        </nav>
        <button onClick={logout} style={{ marginTop:16, width:"100%" }}>Cerrar sesión</button>
      </aside>
      <main style={{ padding:24 }}>
        {children}
      </main>
    </div>
  );
}
