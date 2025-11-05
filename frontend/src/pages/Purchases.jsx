// frontend/src/pages/Purchases.jsx
import { useEffect, useState } from "react";
import { createPurchase, listPurchases, decidePurchase, fmtApiError } from "../api";
import api from "../api";
import { getRoleFromToken, can } from "../auth";
import { useLocation, useNavigate } from "react-router-dom";

/* ======== helpers de borrador en localStorage ======== */
const DRAFT_KEY = "purchaseDraft";
const loadDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || { newItems: [], supplier:"", note:"" };
  } catch {
    return { newItems: [], supplier:"", note:"" };
  }
};
const saveDraft = (draft) => localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
const clearDraft = () => localStorage.removeItem(DRAFT_KEY);


/* ======== formateo de errores legibles ======== */
function fmtError(err) {
  if (!err) return "Error desconocido";

  const data = err?.response?.data;
  const detail =
    data?.detail ??
    data?.message ??
    err?.message ??
    err?.toString();

  // Si viene una lista de errores (pydantic)
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

export default function PurchasesPage() {
  const role = getRoleFromToken();
  const location = useLocation();
  const navigate = useNavigate();

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [rejected, setRejected] = useState([]);

  // catálogo de repuestos (para seleccionar existentes)
  const [parts, setParts] = useState([]);

  // formulario de repuestos EXISTENTES (en esta misma página)
  const [form, setForm] = useState({
    supplier: "",
    items: [{ select: "", sku: "", qty: "", unit_price: "" }],
    note: ""
  });

  // ítems NUEVOS acumulados (del borrador/localStorage) – aquí llegan los INVENTORY desde PurchaseForm.jsx
  const [newItems, setNewItems] = useState([]);

  const refresh = async () => {
    try {
      const p = await listPurchases({ status: "PENDING" }) || [];
      const a = await listPurchases({ status: "APPROVED" }) || [];
      const r = await listPurchases({ status: "REJECTED" }) || [];
      setPending(p); setApproved(a); setRejected(r);
    } catch (e) {
      console.error(e);
      setErr(fmtApiError(e) || "No se pudo cargar el estado de compras.");
    }
  };

  useEffect(() => {
    // cargar catálogos y estado de compras
    (async () => {
      try {
        const partsRes = await api.get("/parts");
        setParts(Array.isArray(partsRes.data) ? partsRes.data : (partsRes?.data?.items || []));
      } catch (e) {
        console.warn("No se pudo cargar catálogo de repuestos", e);
      }
      await refresh();
    })();

    // hidratar borrador
    const draft = loadDraft();
    setNewItems(draft.newItems || []);
    if (draft.supplier) setForm(f => ({...f, supplier: draft.supplier}));
    if (draft.note) setForm(f => ({...f, note: draft.note}));
  }, []);

  // si url tiene #pending, scrollea
  useEffect(() => {
    if (location.hash === "#pending") {
      const el = document.getElementById("pending");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location]);

  // persistir cambios de supplier/note en borrador
  useEffect(() => {
    const d = loadDraft();
    d.supplier = form.supplier;
    d.note = form.note;
    saveDraft(d);
  }, [form.supplier, form.note]);

  const addRow = () =>
    setForm(f => ({
      ...f,
      items: [...f.items, { select: "", sku: "", qty: "", unit_price: "" }],
    }));

  const removeRow = (i) =>
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const setRow = (i, patch) =>
    setForm(f => {
      const items = f.items.slice();
      items[i] = { ...items[i], ...patch };
      return { ...f, items };
    });

  const onSelectChange = (i, val) => {
    const foundPart = parts.find(p => p.sku === val);
    if (foundPart) {
      setRow(i, { select: val, sku: foundPart.sku });
      return;
    }
    setRow(i, { select: val, sku: val });
  };

  // nuevos (borrador) – vienen desde PurchaseForm.jsx
  const removeNewItem = (idx) => {
    const next = newItems.filter((_, i) => i !== idx);
    setNewItems(next);
    const d = loadDraft(); d.newItems = next; saveDraft(d);
  };

  const goToNewInventory = () => {
    // abre PurchaseForm para INVENTORY; al guardar, agrega al borrador y vuelve
    navigate("/purchases/new?append=1&dest=INVENTORY");
  };

  // decidePurchase con compatibilidad de firmas
  const decide = async (id, action, reason) => {
    try {
      return await decidePurchase(id, { approve: action === "APPROVED", reason });
    } catch {
      return await decidePurchase(id, action, reason);
    }
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");

    try {
      // validaciones
      for (const it of form.items) {
        if (!it.select) continue; // filas vacías no se mandan
        const q = Number(String(it.qty || "").replace(/[^0-9]/g, "") || 0);
        if (q <= 0) {
          setErr("Cada repuesto existente debe tener cantidad ≥ 1");
          return;
        }
      }
      for (const it of newItems) {
        if (!it.name?.trim()) { setErr("Los ítems nuevos requieren Nombre."); return; }
        if (!it.quantity || Number(it.quantity) <= 0) { setErr("Cantidad del nuevo ítem debe ser ≥ 1."); return; }
      }

      // payload unificado
      const itemsPayload = [];

      // repuestos EXISTENTES (en esta página) -> usa 'qty' porque tu backend lo exige
      for (const it of form.items) {
        if (!it.select) continue;
        const q = Number(String(it.qty || "").replace(/[^0-9]/g, "") || 0);
        const price = Number(String(it.unit_price || "").replace(/[^0-9.]/g, "") || 0);
        itemsPayload.push({
          destination: "PARTS",
          is_new_product: false,
          sku: it.sku,
          qty: q,                 // <-- clave que espera tu backend
          unit_price: price,
          // compat opcional: también mandamos 'quantity' por si el backend moderno lo usa
          quantity: q,
          new_product: null
        });
      }

      // ítems NUEVOS (borrador) -> INVENTORY o PARTS
      for (const n of newItems) {
        const q = Number(n.quantity);
        const price = Number(n.unit_price || 0);
        itemsPayload.push({
          destination: n.destination,            // "PARTS" | "INVENTORY"
          is_new_product: true,
          sku: n.sku?.trim() || null,            // backend autogenera si null
          qty: q,                                 // <-- clave que espera tu backend
          unit_price: price,
          // compat opcional:
          quantity: q,
          new_product: {
            name: n.name.trim(),
            sku: n.sku?.trim() || undefined,
            description: n.description?.trim() || "",
            ...(n.destination === "INVENTORY" ? {
              type: n.type?.trim() || "equipo",
              status: n.status?.trim() || "BUENO",
              location: n.location?.trim() || "Bodega",
            } : {})
          }
        });
      }

      if (itemsPayload.length === 0) {
        setErr("Agrega al menos un ítem (existente o nuevo).");
        return;
      }

      await createPurchase({
        supplier: form.supplier,
        items: itemsPayload,
        note: form.note,
        category: "mixed"
      });

      // reset + limpiar borrador
      setForm({ supplier: "", items: [{ select: "", sku: "", qty: "", unit_price: "" }], note: "" });
      setNewItems([]);
      clearDraft();
      await refresh();
      setOk("Solicitud enviada al Director para aprobación.");
    } catch (e) {
      console.error(e);
      setErr(fmtError(e));
    }
  };

  const approve = async (id) => {
    setErr(""); setOk("");
    try {
      await decide(id, "APPROVED", null);
      await refresh();
      setOk("Compra aprobada.");
    } catch (e) {
      setErr(fmtApiError(e));
    }
  };

  const reject = async (id) => {
    setErr(""); setOk("");
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    try {
      await decide(id, "REJECTED", reason);
      await refresh();
      setOk("Compra rechazada.");
    } catch (e) {
      setErr(fmtApiError(e));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Compras</h1>

      {err && <div className="card error" style={{ whiteSpace:"pre-wrap", margin: "12px 0" }}>{err}</div>}
      {ok && <div className="card" style={{ margin: "12px 0", borderColor:"#3fa66a" }}>{ok}</div>}

      {/* ADMIN registra compras */}
      {can("purchases:write") && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h2>Registrar compra (ADMIN)</h2>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Abrir formulario externo para INVENTORY */}
              <button className="btn" type="button" onClick={goToNewInventory}>
                + Nuevo equipo (inventario)
              </button>
            </div>
          </div>

          {/* Nuevos ítems agregados desde el formulario externo */}
          {newItems.length > 0 && (
            <div className="card" style={{ margin: "12px 0" }}>
              <b>Ítems nuevos a comprar</b>
              <ul style={{ marginTop: 8 }}>
                {newItems.map((n, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="badge">{n.destination === "PARTS" ? "REPUESTO" : "INVENTARIO"}</span>
                    <span>{n.name} {n.sku ? `(${n.sku})` : ""} — x{n.quantity} — ${n.unit_price || 0}</span>
                    {n.destination === "INVENTORY" && (
                      <span style={{ opacity:.8 }}>
                        — {n.type || "equipo"} | {n.status || "BUENO"} | {n.location || "Bodega"}
                      </span>
                    )}
                    <button type="button" className="btn" onClick={() => removeNewItem(i)}>Quitar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={submitPurchase} style={{ display: "grid", gap: 12, maxWidth: 960 }}>
            <div>
              <label>Proveedor</label><br />
              <input
                value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}
                required
              />
            </div>

            <div>
              <label>Repuestos existentes</label>
              {form.items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(320px, 1fr) 110px 140px auto",
                    gap: 8,
                    alignItems: "center",
                    margin: "6px 0",
                  }}
                >
                  {/* Selector de repuesto existente */}
                  <select
                    value={it.select || ""}
                    onChange={e => onSelectChange(i, e.target.value)}
                  >
                    <option value="">-- seleccionar repuesto --</option>
                    <optgroup label="Repuestos">
                      {parts.map(p => (
                        <option key={p.sku} value={p.sku}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {/* Cantidad (solo números) */}
                  <input
                    type="text"
                    value={it.qty ?? ""}
                    onChange={e => setRow(i, { qty: (e.target.value || "").replace(/[^0-9]/g, "") })}
                    style={{ width: 100 }}
                    placeholder="Cantidad"
                  />

                  {/* Precio unitario (número con decimales) */}
                  <input
                    type="text"
                    value={it.unit_price ?? ""}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]{0,2}$/.test(val)) {
                        setRow(i, { unit_price: val });
                      }
                    }}
                    style={{ width: 130 }}
                    placeholder="Valor"
                  />

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
          <h2 id="pending">Pendientes de aprobación (DIRECTOR)</h2>
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
                    <td>{po.supplier}</td>
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
                      <button onClick={() => approve(po.id || po._id)}>Aprobar</button>{" "}
                      <button onClick={() => reject(po.id || po._id)}>Rechazar</button>
                    </td>
                  </tr>
                ))}
                {pending.length === 0 && (
                  <tr><td colSpan={6} style={{ opacity:.7 }}>Sin pendientes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Estado de compras */}
      <section>
        <h2>Aprobadas</h2>
        <ul>
          {approved.map(po => (
            <li key={po.id || po._id}>
              {(po.id || po._id)} - {po.supplier}
            </li>
          ))}
        </ul>

        <h2>Rechazadas</h2>
        <ul>
          {rejected.map(po => (
            <li key={po.id || po._id}>
              {(po.id || po._id)} - {po.rejection_reason || po.decision_reason || "(sin motivo)"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ================== estilos mínimos opcionales ================== */
if (typeof document !== "undefined" && !document.getElementById("purchases-banners-style")) {
  const style = document.createElement("style");
  style.id = "purchases-banners-style";
  style.innerHTML = `
  .card.error { border-color: #ff6b6b !important; }
  .badge{
    display:inline-block; padding:2px 8px; border-radius:10px;
    border:1px solid #3b4046; background:#32363b; color:#e6e7e8; font-size:12px;
  }
  `;
  document.head.appendChild(style);
}
