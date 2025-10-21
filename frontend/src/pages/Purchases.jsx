// frontend/src/pages/Purchases.jsx
import { useEffect, useState } from "react";
import { createPurchase, listPurchases, decidePurchase } from "../api";
import api from "../api";
import { getRoleFromToken, can } from "../auth";

const genSku = () => "SKU-" + Date.now(); // SKU autogenerado para "Nuevo producto"

export default function PurchasesPage() {
  const role = getRoleFromToken();

  const [err, setErr] = useState("");
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [rejected, setRejected] = useState([]);

  // catálogos para el selector
  const [parts, setParts] = useState([]);       // repuestos existentes
  const [inventory, setInventory] = useState([]); // equipos del inventario

  // form con selector por fila: select (sku existente, code de equipo o "__new__"), qty y (si es nuevo) sku+name
  const [form, setForm] = useState({
    supplier: "",
    items: [{ select: "", sku: "", qty: 1, name: "" }],
    note: ""
  });

  const refresh = async () => {
    try {
      const p = (await listPurchases({ status: "PENDING" })).data || [];
      const a = (await listPurchases({ status: "APPROVED" })).data || [];
      const r = (await listPurchases({ status: "REJECTED" })).data || [];
      setPending(p); setApproved(a); setRejected(r);
    } catch (e) {
      console.error(e);
      setErr("Error cargando compras");
    }
  };

  // carga catálogos y estados de compras
  useEffect(() => {
    (async () => {
      try {
        const partsRes = await api.get("/parts");
        setParts(Array.isArray(partsRes.data) ? partsRes.data : []);
      } catch (e) {
        console.warn("No se pudo cargar catálogo de repuestos", e);
      }
      try {
        const invRes = await api.get("/inventory");
        setInventory(Array.isArray(invRes.data) ? invRes.data : []);
      } catch (e) {
        console.warn("No se pudo cargar inventario", e);
      }
      await refresh();
    })();
  }, []);

  const addRow = () =>
    setForm(f => ({
      ...f,
      items: [...f.items, { select: "", sku: "", qty: 1, name: "" }],
    }));

  const removeRow = (i) =>
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const setRow = (i, patch) =>
    setForm(f => {
      const items = f.items.slice();
      items[i] = { ...items[i], ...patch };
      return { ...f, items };
    });

  // cambia la selección por fila: parte existente, equipo inventario o nuevo producto
  const onSelectChange = (i, val) => {
    if (val === "__new__") {
      // Nuevo producto → SKU auto y limpiar nombre
      setRow(i, { select: val, sku: genSku(), name: "" });
      return;
    }

    // ¿Es un repuesto existente?
    const foundPart = parts.find(p => p.sku === val);
    if (foundPart) {
      setRow(i, { select: val, sku: foundPart.sku, name: foundPart.name || foundPart.sku });
      return;
    }

    // ¿Es un equipo del inventario? (usamos code como sku para la compra)
    const foundItem = inventory.find(x => x.code === val);
    if (foundItem) {
      setRow(i, {
        select: val,
        sku: foundItem.code,
        name: `${foundItem.type} ${foundItem.code}`
      });
      return;
    }

    // fallback
    setRow(i, { select: val, sku: val, name: "" });
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    try {
      // Validación mínima
      for (const it of form.items) {
        if (!it.qty || Number(it.qty) <= 0) {
          alert("Cada ítem debe tener cantidad ≥ 1");
          return;
        }
        if (!it.select) {
          alert("Selecciona un producto en cada fila (o 'Nuevo producto').");
          return;
        }
        if (it.select === "__new__" && (!it.sku || !it.name)) {
          alert("Para 'Nuevo producto' debes indicar un nombre (el SKU se generó automáticamente).");
          return;
        }
      }

      // Limpiar "select" y armar payload. category: "parts" (compras para repuestos)
      const cleanItems = form.items.map(it => ({
        sku: it.sku,
        qty: Number(it.qty),
        ...(it.select === "__new__" ? { name: it.name } : {})
      }));

      await createPurchase({
        supplier: form.supplier,
        items: cleanItems,
        note: form.note,
        category: "parts",
      });

      // reset
      setForm({ supplier: "", items: [{ select: "", sku: "", qty: 1, name: "" }], note: "" });
      await refresh();
      alert("Solicitud enviada al Director para aprobación.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.detail || "Error al crear compra");
    }
  };

  const approve = async (id) => {
    await decidePurchase(id, "APPROVED", null);
    await refresh();
  };
  const reject = async (id) => {
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    await decidePurchase(id, "REJECTED", reason);
    await refresh();
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Compras</h1>
      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {/* ADMIN registra compras */}
      {can("purchases:write") && (
        <section style={{ marginBottom: 24 }}>
          <h2>Registrar compra (ADMIN)</h2>
          <form onSubmit={submitPurchase} style={{ display: "grid", gap: 12, maxWidth: 900 }}>
            <div>
              <label>Proveedor</label><br />
              <input
                value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}
                required
              />
            </div>

            <div>
              <label>Items</label>
              {form.items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(320px, 1fr) 110px 1.4fr auto",
                    gap: 8,
                    alignItems: "center",
                    margin: "6px 0",
                  }}
                >
                  {/* selector de repuesto existente, equipo inventario o "nuevo" */}
                  <select
                    value={it.select || ""}
                    onChange={e => onSelectChange(i, e.target.value)}
                    required
                  >
                    <option value="">-- seleccionar ítem --</option>

                    <optgroup label="Repuestos existentes">
                      {parts.map(p => (
                        <option key={p.sku} value={p.sku}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Equipos (inventario)">
                      {inventory.map(dev => (
                        <option key={dev.code} value={dev.code}>
                          {dev.code} — {dev.type} ({dev.location})
                        </option>
                      ))}
                    </optgroup>

                    <option value="__new__">+ Nuevo producto… (SKU auto)</option>
                  </select>

                  {/* cantidad */}
                  <input
                    type="number"
                    min="1"
                    value={it.qty || 1}
                    onChange={e => setRow(i, { qty: Number(e.target.value) })}
                    style={{ width: 100 }}
                    required
                  />

                  {/* Si es nuevo producto: pedir Nombre (el SKU ya está autogenerado y editable) */}
                  {it.select === "__new__" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        placeholder="SKU autogenerado"
                        value={it.sku}
                        onChange={e => setRow(i, { sku: e.target.value })}
                        required
                      />
                      <input
                        placeholder="Nombre"
                        value={it.name}
                        onChange={e => setRow(i, { name: e.target.value })}
                        required
                      />
                    </div>
                  ) : (
                    <div style={{ opacity: 0.8 }}>
                      {it.name || (parts.find(p => p.sku === it.sku)?.name) || "—"}
                    </div>
                  )}

                  <button type="button" onClick={() => removeRow(i)}>
                    Quitar
                  </button>
                </div>
              ))}
              <button type="button" onClick={addRow}>+ Agregar fila</button>
            </div>

            <div>
              <label>Nota</label><br />
              <textarea
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div>
              <button type="submit">Solicitar aprobación</button>
            </div>
          </form>
        </section>
      )}

      {/* DIRECTOR aprueba / rechaza */}
      {role === "DIRECTOR" && (
        <section style={{ marginBottom: 24 }}>
          <h2>Pendientes de aprobación (DIRECTOR)</h2>
          <table border="1" cellPadding="8" cellSpacing="0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Proveedor</th>
                <th>Solicitó</th>
                <th>Items</th>
                <th>Nota</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(po => (
                <tr key={po.id}>
                  <td>{po.id}</td>
                  <td>{po.supplier}</td>
                  <td>{po.requested_by}</td>
                  <td>{(po.items || []).map(it => `${it.sku}x${it.qty}`).join(", ")}</td>
                  <td>{po.note || "—"}</td>
                  <td>
                    <button onClick={() => approve(po.id)}>Aprobar</button>{" "}
                    <button onClick={() => reject(po.id)}>Rechazar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Estado de compras */}
      <section>
        <h2>Aprobadas</h2>
        <ul>
          {approved.map(po => (
            <li key={po.id}>
              {po.id} - {po.supplier}
            </li>
          ))}
        </ul>

        <h2>Rechazadas</h2>
        <ul>
          {rejected.map(po => (
            <li key={po.id}>
              {po.id} - {po.rejection_reason || "(sin motivo)"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
