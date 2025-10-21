// frontend/src/pages/PartForm.jsx
import { useEffect, useState } from "react";
import api, { listPurchases } from "../api";
import { can } from "../auth";
import { useNavigate } from "react-router-dom";

const UNITS = ["unidad","par","caja","bolsa","kit"];
const CATEGORIES = ["almacenamiento","memoria","cooling","impresora","cableado","otro"];

export default function PartFormPage() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [approvedPOs, setApprovedPOs] = useState([]);
  const [po, setPo] = useState("");           // purchaseId
  const [poItems, setPoItems] = useState([]); // items de esa PO
  const [sku, setSku] = useState("");         // sku elegido de la PO

  // especificaciones de la "tabla"
  const [form, setForm] = useState({
    name: "",
    minStock: 0,
    unit: "unidad",
    category: "otro",
    location: "",
    description: ""
  });

  useEffect(()=>{ (async ()=>{
    try {
      const { data } = await listPurchases({ status: "APPROVED" });
      setApprovedPOs(Array.isArray(data) ? data : []);
    } catch(e) { setErr("No se pudieron cargar compras aprobadas"); }
  })(); }, []);

  useEffect(()=>{
    const match = approvedPOs.find(x => x.id === po);
    setPoItems(match ? (match.items || []) : []);
    setSku("");
  }, [po, approvedPOs]);

  if (!can("parts:write")) {
    // TECH y DIRECTOR verán solo Parts.jsx; no deberían llegar aquí
    return <div style={{ padding:24 }}><h2>No tienes permisos</h2></div>;
  }

  const onSubmit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      if (!po || !sku) { setErr("Debes elegir compra aprobada y SKU"); return; }
      // POST /parts  (ver backend)
      await api.post("/parts", {
        purchaseId: po,
        sku,
        ...form
      });
      alert("Repuesto agregado con especificaciones");
      nav("/parts", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Error al guardar repuesto");
    }
  };

  const selectedItem = poItems.find(i => i.sku === sku);

  return (
    <div style={{ padding:24 }}>
      <h1>Agregar repuesto (desde compra aprobada)</h1>
      {err && <div style={{ color:"crimson" }}>{err}</div>}

      <form onSubmit={onSubmit} style={{ display:"grid", gap:12, maxWidth:640 }}>
        <div>
          <label>Compra aprobada</label><br/>
          <select value={po} onChange={e=>setPo(e.target.value)} required>
            <option value="">-- seleccionar PO --</option>
            {approvedPOs.map(p => <option key={p.id} value={p.id}>{p.id} — {p.supplier}</option>)}
          </select>
        </div>

        <div>
          <label>SKU de la compra</label><br/>
          <select value={sku} onChange={e=>setSku(e.target.value)} required disabled={!po}>
            <option value="">-- seleccionar SKU --</option>
            {poItems.map(i => <option key={i.sku} value={i.sku}>{i.sku} (x{i.qty})</option>)}
          </select>
        </div>

        <div>
          <label>Nombre</label><br/>
          <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label>Stock mínimo</label><br/>
            <input type="number" min="0" value={form.minStock} onChange={e=>setForm({...form, minStock:Number(e.target.value)})} />
          </div>
          <div>
            <label>Unidad</label><br/>
            <select value={form.unit} onChange={e=>setForm({...form, unit:e.target.value})}>
              {UNITS.map(u=> <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label>Categoría</label><br/>
            <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
              {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Ubicación (bodega/estante)</label><br/>
            <input value={form.location} onChange={e=>setForm({...form, location:e.target.value})} />
          </div>
        </div>

        <div>
          <label>Descripción</label><br/>
          <textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
        </div>

        <div>
          <button type="submit">Guardar repuesto</button>
        </div>

        {selectedItem && (
          <div style={{ opacity:0.7 }}>
            <small>Referencia: esta PO trae {selectedItem.qty} unidad(es) de {selectedItem.sku}.</small>
          </div>
        )}
      </form>
    </div>
  );
}
