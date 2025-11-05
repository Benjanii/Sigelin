// frontend/src/pages/RepairReport.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getRepair, getItems } from "../api";

/* Utilidad: errores legibles */
function fmtError(err) {
  const data = err?.response?.data;
  const detail = data?.detail ?? data?.message ?? err?.message ?? err?.toString();
  if (typeof detail === "string") return detail;
  try { return JSON.stringify(detail, null, 2); } catch { return String(detail); }
}

/* Fila visual simple */
function Row({ label, value }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gap: 12,
      padding: "8px 0",
      borderBottom: "1px solid var(--line)"
    }}>
      <div style={{ opacity: .8 }}>{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}

export default function RepairReportPage() {
  const { id } = useParams();
  const [rep, setRep] = useState(null);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await getRepair(id);
        setRep(r);
      } catch (e) {
        setErr(fmtError(e));
      }
      try {
        const inv = await getItems(); // devuelve array
        setItems(Array.isArray(inv) ? inv : (inv?.items || []));
      } catch (e) {
        // si falla inventario, igual mostramos el informe sin nombre/ubicación
        console.warn("No se pudo cargar inventario", e);
        setItems([]);
      }
    })();
  }, [id]);

  // Mapeos y datos derivados
  const deviceCode = useMemo(() => (
    rep?.equipmentCode || rep?.device_code || rep?.inventory_code || rep?.code || ""
  ), [rep]);

  const itemInfo = useMemo(() => {
    if (!deviceCode) return null;
    return (items || []).find(it => it?.code === deviceCode) || null;
  }, [items, deviceCode]);

  const deviceQR   = rep?.qr || itemInfo?.qr || "";
  const deviceType = itemInfo?.type || "";
  const deviceName = itemInfo?.name || "";               // ← nombre guardado en /items
  const deviceLoc  = (rep?.location || itemInfo?.location || ""); // preferimos lo del reporte si existe
  const deviceStatus = rep?.status || rep?.state || "";

  const createdAt = rep?.created_at || rep?.date;
  const updatedAt = rep?.updated_at;

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  if (err) {
    return (
      <div className="page">
        <h1 className="page-title">Informe de reparación</h1>
        <div className="card error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>
      </div>
    );
  }

  if (!rep) {
    return (
      <div className="page">
        <h1 className="page-title">Informe de reparación</h1>
        <div className="card">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Informe de reparación</h1>

      <div className="card" style={{ maxWidth: 980 }}>
        <Row label="ID" value={rep.id || rep._id} />

        {/* Equipo (código / tipo) */}
        <Row
          label="Equipo"
          value={
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <b title="Código del equipo">{deviceCode || "—"}</b>
              {deviceType && <span className="badge" title="Tipo">{deviceType}</span>}
            </div>
          }
        />

        {/* Nombre del equipo (desde colección items.name) */}
        <Row label="Nombre del equipo" value={deviceName || "—"} />

        {/* Ubicación (desde repairs.location o items.location) */}
        <Row label="Ubicación" value={deviceLoc || "—"} />

        {/* QR en su propia fila */}
        <Row
          label="Código QR"
          value={
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <code>{deviceQR || "—"}</code>
              {deviceQR && (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => copy(deviceQR)}
                  title="Copiar QR"
                  style={{ padding:"6px 10px" }}
                >
                  Copiar
                </button>
              )}
            </div>
          }
        />

        <Row label="Estado de la reparación" value={<span className="badge">{deviceStatus || "—"}</span>} />
        <Row label="Creado por" value={rep.technician || rep.created_by || rep.author || "—"} />
        <Row label="Fecha de creación" value={createdAt ? new Date(createdAt).toLocaleString() : "—"} />
        {updatedAt && <Row label="Última actualización" value={new Date(updatedAt).toLocaleString()} />}

        {/* Bloques de texto */}
        {rep.title && <Row label="Título" value={rep.title} />}
        {rep.description && <Row label="Descripción" value={<pre style={{ margin:0, whiteSpace:"pre-wrap" }}>{rep.description}</pre>} />}
        {rep.diagnostics && <Row label="Diagnóstico" value={<pre style={{ margin:0, whiteSpace:"pre-wrap" }}>{rep.diagnostics}</pre>} />}
        {rep.actions && <Row label="Acciones realizadas" value={<pre style={{ margin:0, whiteSpace:"pre-wrap" }}>{rep.actions}</pre>} />}
        {rep.notes && <Row label="Notas" value={<pre style={{ margin:0, whiteSpace:"pre-wrap" }}>{rep.notes}</pre>} />}
        {(Array.isArray(rep.parts_used) && rep.parts_used.length > 0) && (
          <Row
            label="Repuestos utilizados"
            value={
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {rep.parts_used.map((p, i) => (
                  <li key={i}>{typeof p === "string" ? p : JSON.stringify(p)}</li>
                ))}
              </ul>
            }
          />
        )}
      </div>
    </div>
  );
}

/* estilos mínimos */
if (typeof document !== "undefined" && !document.getElementById("repair-report-style")) {
  const style = document.createElement("style");
  style.id = "repair-report-style";
  style.innerHTML = `
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;border:1px solid #3b4046;background:#32363b;color:#e6e7e8;font-size:12px}
  `;
  document.head.appendChild(style);
}
