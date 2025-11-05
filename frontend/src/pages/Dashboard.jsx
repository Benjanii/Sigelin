// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { getReportsOverview, health, listRepairs } from "../api";
import { can, getRoleFromToken } from "../auth";
import { useNavigate } from "react-router-dom";

const NEEDS_REPAIR = new Set(["EN REPARACION"]);

export default function DashboardPage() {
  const role = getRoleFromToken();
  const nav = useNavigate();

  const [err, setErr] = useState("");
  const [status, setStatus] = useState("unknown");

  // KPIs
  const [kpis, setKpis] = useState({ OK: 0, REPAIR: 0, LOWINK: 0, });

  // Datos para secciones
  const [lowStock, setLowStock] = useState([]);
  const [repairsTrend, setRepairsTrend] = useState([]);

  // NUEVO: listado de equipos/computadores en reparación
  const [repairs, setRepairs] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // /health (nuestro wrapper health() ya devuelve data, no data.data)
        try {
          const h = await health();
          setStatus(h?.status ?? "unknown");
        } catch (e) {
          console.warn("health fail", e);
          setStatus("error");
        }

        // /reports/overview (si el endpoint no existe, el wrapper entrega fallback)
        const data = await getReportsOverview();

        // KPIs básicos (usamos repairs.by_state si está disponible)
        const repairsByState = data?.repairs?.by_state || {};
        const repairCount =
          (repairsByState["EN REPARACION"] || 0) +
          (repairsByState["BUENO"] || 0) +
          (repairsByState["MALO"] || 0);

        // “OK/LOWINK/OTHER” quedan de relleno para no romper UI
        setKpis({
          OK: data?.inventory?.ok ?? 0,
          REPAIR: repairCount,
          LOWINK: 0,
          OTHER: 0,
        });

        // No tenemos payload real para lowStock/trend aún
        setLowStock([]);
        setRepairsTrend([]);

        // Carga de reparaciones (para tabla “Equipos en reparación”)
        const all = await listRepairs({});
        const arr = Array.isArray(all) ? all : (all?.items || []);
        // orden por fecha (date/created_at) descendente
        arr.sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
        setRepairs(arr);
      } catch (e) {
        console.error(e);
        setErr("No se pudo cargar el dashboard");
      }
    })();
  }, []);

  // Filtrar sólo las que están en reparación
  const inProgress = useMemo(() => {
    return repairs.filter(r => NEEDS_REPAIR.has(String(r.status || r.state || "").toUpperCase()));
  }, [repairs]);

  // Filtro por búsqueda (QR/codigo/técnico)
  const filteredInProgress = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return inProgress;
    return inProgress.filter(r => {
      const code = (r.equipmentCode || r.device_code || r.inventory_code || r.code || "").toLowerCase();
      const qr = (r.qr || "").toLowerCase();
      const tech = (r.technician || r.created_by || r.author || "").toLowerCase();
      const title = (r.title || "").toLowerCase();
      return code.includes(needle) || qr.includes(needle) || tech.includes(needle) || title.includes(needle);
    });
  }, [inProgress, q]);

  // Ajustar KPI REPAIR según lista real (más confiable)
  useEffect(() => {
    setKpis(k => ({ ...k, REPAIR: filteredInProgress.length }));
  }, [filteredInProgress.length]);

  return (
    <div className="page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="page-title">Dashboard</h1>
        <div className="badge" title="Estado de la API">API: {status}</div>
      </div>

      {err && <div className="card error" style={{ whiteSpace:"pre-wrap", marginBottom: 10 }}>{err}</div>}

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-2">
        <Kpi title="En reparación" value={kpis.REPAIR} />
      </div>

      {/* Acciones rápidas */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          {can("repairs:write") && <button className="btn" onClick={() => nav("/repairs/new")}>Nueva reparación</button>}
          {can("purchases:write") && <button className="btn ghost" onClick={() => nav("/purchases")}>Registrar compra</button>}
          {role === "DIRECTOR" && <button className="btn ghost" onClick={() => nav("/approvals")}>Aprobaciones</button>}
          <button className="btn ghost" onClick={() => nav("/reports")}>Ver reportes</button>
        </div>
      </div>

      {/* NUEVO: Equipos/Computadores en reparación */}
      <section style={{ marginTop: 10 }}>
        <div className="flex justify-between items-center">
          <h2 className="page-title" style={{ margin: 0 }}>Equipos en reparación</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Buscar por QR, código, técnico, título…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <button className="btn ghost" onClick={() => setQ("")}>Limpiar</button>
          </div>
        </div>

        <div className="table-responsive" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>QR</th>
                <th>Código</th>
                <th>Estado</th>
                <th>Técnico</th>
                <th>Fecha</th>
                <th style={{ width: 180 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInProgress.map(r => {
                const id = r.id || r._id;
                const qr = r.qr || "—";
                const code = r.equipmentCode || r.device_code || r.inventory_code || r.code || "—";
                const status = r.status || r.state || "—";
                const tech = r.technician || r.created_by || r.author || "—";
                const date = r.date || r.created_at;
                return (
                  <tr key={id}>
                    <td><code>{qr}</code></td>
                    <td title="Código del equipo">{code}</td>
                    <td><span className="badge">{status}</span></td>
                    <td>{tech}</td>
                    <td>{date ? new Date(date).toLocaleString() : "—"}</td>
                    <td>
                      <button className="btn" onClick={() => nav(`/repairs/report/${id}`)}>Ver informe</button>{" "}
                      {(role === "ADMIN" || role === "TECH") && (
                        <button className="btn ghost" onClick={() => nav(`/repairs/edit/${id}`)}>Editar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredInProgress.length === 0 && (
                <tr><td colSpan={6} style={{ opacity: .7 }}>No hay equipos en reparación que coincidan con el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="card" style={{ textAlign: "left" }}>
      <div className="muted" style={{ fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
