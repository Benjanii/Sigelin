import { useEffect, useState } from "react";
import { listPurchases, decidePurchase } from "../api";

export default function PurchaseReportsPage() {
  const [pending, setPending] = useState([]);
  const [err, setErr] = useState("");

  const refresh = async () => {
    try {
      const { data } = await listPurchases({ status: "PENDING" });
      setPending(Array.isArray(data) ? data : []);
    } catch (e) { setErr("No se pudo cargar"); }
  };
  useEffect(()=>{ refresh(); }, []);

  const approve = async (id) => { await decidePurchase(id, "APPROVED", null); refresh(); };
  const reject = async (id) => {
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    await decidePurchase(id, "REJECTED", reason);
    refresh();
  };

  return (
    <div>
      <h1>Reportes de compra (pendientes)</h1>
      {err && <div style={{ color:"crimson" }}>{err}</div>}

      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr><th>ID</th><th>Proveedor</th><th>Solicitó</th><th>Items</th><th>Nota</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {pending.map(po => (
            <tr key={po.id}>
              <td>{po.id}</td>
              <td>{po.supplier}</td>
              <td>{po.requested_by}</td>
              <td>{(po.items||[]).map(i=>`${i.sku}x${i.qty}`).join(", ")}</td>
              <td>{po.note || "-"}</td>
              <td>
                <button onClick={()=>approve(po.id)}>Aprobar</button>{" "}
                <button onClick={()=>reject(po.id)}>Rechazar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
