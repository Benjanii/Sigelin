// frontend/src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listRepairs, getItems } from "../api";
import { getRoleFromToken } from "../auth";

/* Errores legibles */
function fmtError(err) {
  const data = err?.response?.data;
  const detail = data?.detail ?? data?.message ?? err?.message ?? err?.toString();
  if (Array.isArray(detail)) {
    try {
      return detail.map(e => {
        const path = Array.isArray(e?.loc) ? e.loc.join(" > ") : "";
        const msg = e?.msg || JSON.stringify(e);
        return `• ${path}: ${msg}`;
      }).join("\n");
    } catch {
      return JSON.stringify(detail, null, 2);
    }
  }
  if (typeof detail === "string") return detail;
  try { return JSON.stringify(detail, null, 2); } catch { return String(detail); }
}

export default function ReportsPage() {
  const nav = useNavigate();
  const role = getRoleFromToken(); // todos los roles pueden ver

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [inventory, setInventory] = useState([]);

  // filtros UI
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // vacío = todos

  // mapa rápido: code -> { qr, location, type, name }
  const invMap = useMemo(() => {
    const m = new Map();
    for (const it of Array.isArray(inventory) ? inventory : []) {
      if (it?.code) {
        m.set(it.code, {
          qr: it.qr || "",
          location: it.location || "",
          type: it.type || "",
          name: it.name || "",
        });
      }
    }
    return m;
  }, [inventory]);

  async function load() {
    setErr(""); setBusy(true);
    try {
      const data = await listRepairs({});
      const arr = Array.isArray(data) ? data : (data?.items || []);
      // ordenar por fecha desc
      arr.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
      setRows(arr);
    } catch (e) {
      setErr(fmtError(e));
    } finally {
      setBusy(false);
    }

    // inventario para completar QR/ubicación si faltan en el reporte
    try {
      const items = await getItems();
      const arrI = Array.isArray(items) ? items : (items?.items || []);
      setInventory(arrI);
    } catch (e) {
      // opcional
      setInventory([]);
    }
  }

  useEffect(() => { load(); }, []);

  // aplicar filtros/búsqueda
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter(r => {
      const status = (r.status || r.state || "").toString();
      if (statusFilter && status.toUpperCase() !== statusFilter.toUpperCase()) return false;

      if (!query) return true;
      const code = r.equipmentCode || r.device_code || r.inventory_code || r.code || "";
      const qr = r.qr || invMap.get(code)?.qr || "";
      const createdBy = r.technician || r.created_by || r.author || "";
      const location = r.location || invMap.get(code)?.location || "";

      const hay = [
        r.id, code, qr, status, createdBy, location, r.title, r.description
      ].filter(Boolean).some(v => String(v).toLowerCase().includes(query));

      return hay;
    });
  }, [rows, q, statusFilter, invMap]);

  const copy = async (text) => { try { await navigator.clipboard.writeText(text); } catch {} };

  const statusesInData = useMemo(() => {
    const set = new Set();
    rows.forEach(r => { if (r.status) set.add(String(r.status)); else if (r.state) set.add(String(r.state)); });
    return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b)));
  }, [rows]);

  return (
    <div className="page">
      <div className="flex justify-between items-center" style={{ gap: 12, flexWrap: "wrap" }}>
        <h1 className="page-title">Informes de reparación</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={load} disabled={busy}>Recargar</button>
        </div>
      </div>

      {err && <div className="card error" style={{ whiteSpace:"pre-wrap", marginBottom: 10 }}>{err}</div>}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid md:grid-cols-3 gap-2">
          <label>
            Buscar
            <input
              placeholder="ID, código, QR, estado, ubicación…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </label>
          <label>
            Estado
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">— Todos —</option>
              {statusesInData.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Tabla de reportes */}
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Equipo (QR)</th>
              <th>Estado</th>
              <th>Creado por</th>
              <th>Fecha</th>
              <th>Ubicación</th>
              <th style={{ width: 180 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const id = r.id || r._id;
              const code = r.equipmentCode || r.device_code || r.inventory_code || r.code || "";
              const qr = r.qr || invMap.get(code)?.qr || "—";
              const status = r.status || r.state || "—";
              const createdBy = r.technician || r.created_by || r.author || "—";
              const date = r.date || r.created_at;
              const location = r.location || invMap.get(code)?.location || "—";

              return (
                <tr key={id}>
                  <td>{id}</td>
                  <td title={`Código de equipo: ${code || "—"}`}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <code style={{ fontSize: ".95rem" }}>{qr}</code>
                      {qr && qr !== "—" && (
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => copy(qr)}
                          title="Copiar QR"
                          style={{ padding: "6px 10px" }}
                        >
                          Copiar
                        </button>
                      )}
                    </div>
                  </td>
                  <td><span className="badge">{status}</span></td>
                  <td>{createdBy}</td>
                  <td>{date ? new Date(date).toLocaleString() : "—"}</td>
                  <td>{location}</td>
                  <td>
                    {/* TODOS los roles pueden ver informe */}
                    <button className="btn" onClick={() => nav(`/repairs/report/${id}`)}>
                      Ver informe
                    </button>
                  </td>
                </tr>
              );
            })}
            {!busy && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ opacity:.7 }}>No hay informes que coincidan con el filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* estilos opcionales */
if (typeof document !== "undefined" && !document.getElementById("reports-style")) {
  const style = document.createElement("style");
  style.id = "reports-style";
  style.innerHTML = `
  .table-responsive { overflow:auto; }
  table { width:100%; border-collapse:collapse; }
  thead th {
    text-align:left; font-weight:600; padding:10px;
    border-bottom:1px solid var(--line);
  }
  tbody td { padding:8px 10px; border-bottom:1px solid #2b2f33; }
  .btn.ghost { background:#2d3136; border:1px solid #3b4046; }
  `;
  document.head.appendChild(style);
}
