import { useEffect, useState } from "react";
import { listPurchases, decidePurchase } from "../api";

/*  formateo de errores legibles  */
function fmtError(err) {
  if (!err) return "Error desconocido";
  const data = err?.response?.data;
  const detail = data?.detail ?? data?.message ?? err?.message ?? err?.toString();

  // Pydantic list
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

export default function ApprovalsPage() {
  const [pending, setPending] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    setErr(""); setOk("");
    try {
      const rows = await listPurchases({ status: "PENDING" });
      setPending(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr("No se pudieron cargar las solicitudes pendientes.");
      console.error(e);
    }
  };

  useEffect(() => { load(); }, []);

  async function onApprove(id) {
    setErr(""); setOk("");
    try {
      await decidePurchase(id, { approve: true });
      setOk("Solicitud aprobada correctamente.");
      await load();
    } catch (e) {
      setErr(fmtError(e));
    }
  }

  async function onReject(id) {
    setErr(""); setOk("");
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    try {
      await decidePurchase(id, { approve: false, reason });
      setOk("Solicitud rechazada.");
      await load();
    } catch (e) {
      setErr(fmtError(e));
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Aprobaciones (DIRECTOR)</h1>

      {err && <div className="card error" style={{ whiteSpace: "pre-wrap", margin: "12px 0" }}>{err}</div>}
      {ok && <div className="card" style={{ margin: "12px 0", borderColor: "#3fa66a" }}>{ok}</div>}

      {/*SOLO tabla de solicitudes de COMPRA */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Solicitudes de compra pendientes</h2>
        <div className="table-responsive">
          <table border="1" cellPadding="8" cellSpacing="0" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Proveedor</th>
                <th>Solicitó</th>
                <th>Ítems</th>
                <th>Nota</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(po => (
                <tr key={po.id || po._id}>
                  <td>{po.id || po._id}</td>
                  <td>{po.supplier || "—"}</td>
                  <td>{po.requested_by || po.created_by || "—"}</td>
                  <td>
                    {(po.items || []).map((it, idx) => {
                      const q = it.qty ?? it.quantity ?? 0;
                      const dest = it.destination || (it.is_new_product ? "NEW" : "PARTS");
                      const label = it.is_new_product ? (it.new_product?.name || it.sku) : it.sku;
                      return <div key={idx}>{label} x{q} [{dest}]</div>;
                    })}
                  </td>
                  <td>{po.note || "—"}</td>
                  <td>
                    <button onClick={() => onApprove(po.id || po._id)}>Aprobar</button>{" "}
                    <button onClick={() => onReject(po.id || po._id)}>Rechazar</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={6} style={{ opacity: .7 }}>No hay solicitudes pendientes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================== estilos mínimos opcionales ================== */
if (typeof document !== "undefined" && !document.getElementById("approvals-style")) {
  const style = document.createElement("style");
  style.id = "approvals-style";
  style.innerHTML = `
  .card.error { border-color: #ff6b6b !important; }
  `;
  document.head.appendChild(style);
}
