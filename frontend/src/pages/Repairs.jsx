// frontend/src/pages/Repairs.jsx
import { useEffect, useMemo, useState } from "react";
import { listRepairs, deleteRepair, getItems } from "../api";
import { getRoleFromToken } from "../auth";
import { useNavigate } from "react-router-dom";

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

export default function RepairsPage() {
  const nav = useNavigate();
  const role = getRoleFromToken();

  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [inventory, setInventory] = useState([]);

  // Mapa: code -> { location, qr, name }
  const invMap = useMemo(() => {
    const m = new Map();
    for (const it of Array.isArray(inventory) ? inventory : []) {
      if (it?.code) {
        m.set(it.code, {
          location: it.location || "",
          qr: it.qr || "",
          name: it.name || ""      // <-- añadimos name
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
      // ordenar por fecha descendente si existe
      arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setRows(arr);
    } catch (e) {
      setErr(fmtError(e));
    } finally {
      setBusy(false);
    }

    // Cargar inventario para obtener ubicaciones/QR/NAME si no vienen en la reparación
    try {
      const items = await getItems();
      const arrItems = Array.isArray(items) ? items : (items?.items || []);
      setInventory(arrItems);
    } catch (e) {
      console.warn("No se pudo cargar inventario para completar ubicaciones/QR/NAME", e);
      setInventory([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function onDelete(id) {
    if (!confirm("¿Eliminar reparación? Esta acción no se puede deshacer.")) return;
    try {
      await deleteRepair(id);
      await load();
    } catch (e) {
      alert(fmtError(e));
    }
  }

  const canWrite = role === "ADMIN" || role === "TECH";

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className="page">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Reparaciones</h1>
        {canWrite && (
          <button className="btn" onClick={() => nav("/repairs/new")}>
            + Nueva reparación
          </button>
        )}
      </div>

      {err && <div className="card error" style={{ whiteSpace:"pre-wrap", marginBottom: 10 }}>{err}</div>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Equipo (QR)</th>
              <th>Nombre</th>{/* <-- nueva columna */}
              <th>Estado</th>
              <th>Creado por</th>
              <th>Fecha</th>
              <th>Ubicación</th>
              <th style={{ width: 260 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const id = r.id || r._id;
              const code = r.equipmentCode || r.device_code || r.inventory_code || r.code || "";
              const qr = r.qr || invMap.get(code)?.qr || "—";
              const name = (r.name && String(r.name).trim()) || invMap.get(code)?.name || "—"; // <-- nombre mostrado
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
                  <td>{name}</td>{/* <-- celda del nombre */}
                  <td><span className="badge">{status}</span></td>
                  <td>{createdBy}</td>
                  <td>{date ? new Date(date).toLocaleString() : "—"}</td>
                  <td>{location}</td>
                  <td>
                    {canWrite && (
                      <>
                        <button className="btn ghost" onClick={() => nav(`/repairs/edit/${id}`)}>Editar</button>{" "}
                      </>
                    )}
                    <button className="btn" onClick={() => nav(`/repairs/report/${id}`)}>
                      Ver informe
                    </button>{" "}
                    {role === "ADMIN" && (
                      <button className="btn ghost" onClick={() => onDelete(id)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={8} style={{ opacity:.7 }}>No hay reparaciones registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* estilos opcionales */
if (typeof document !== "undefined" && !document.getElementById("repairs-style")) {
  const style = document.createElement("style");
  style.id = "repairs-style";
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
