// frontend/src/pages/InventoryForm.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { addItem } from "../api";
import { can } from "../auth";

const LOCATIONS = ["Lab-1","Lab-2","Lab-3","Bodega","Dirección TI","Recepción"];

function genCode() { return "EQ-" + Date.now(); }
function genQR(code) { return "QR-" + code; }

export default function InventoryFormPage() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [code, setCode] = useState(genCode());
  const [qr, setQr] = useState(genQR(genCode())); // genera inicialmente

  // cada vez que cambie el code, regenerar QR coherente
  useEffect(() => { setQr(genQR(code)); }, [code]);

  if (!can("inventory:write")) {
    return <div style={{ padding:24 }}><h2>No tienes permisos</h2></div>;
  }

  const [form, setForm] = useState({
    type: "pc",
    status: "OK",
    location: LOCATIONS[0],
  });

  const onSubmit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      await addItem({ code, qr, ...form });
      alert("Ítem agregado al inventario");
      nav("/inventory", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Error al guardar");
    }
  };

  return (
    <div style={{ padding:24 }}>
      <h1>Agregar Ítem (Inventario)</h1>
      {err && <div style={{ color:"crimson" }}>{err}</div>}

      <form onSubmit={onSubmit} style={{ display:"grid", gap:12, maxWidth:520 }}>
        <div>
          <label>Código (auto)</label><br/>
          <input value={code} readOnly />
        </div>
        <div>
          <label>QR (auto)</label><br/>
          <input value={qr} readOnly />
        </div>
        <div>
          <label>Tipo</label><br/>
          <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
            <option value="pc">pc</option>
            <option value="notebook">notebook</option>
            <option value="printer">printer</option>
          </select>
        </div>
        <div>
          <label>Status</label><br/>
          <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
            <option value="OK">OK</option>
            <option value="REPAIR">REPAIR</option>
            <option value="LOWINK">LOWINK</option>
          </select>
        </div>
        <div>
          <label>Location</label><br/>
          <select value={form.location} onChange={e=>setForm({...form, location:e.target.value})}>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div><button type="submit">Guardar</button></div>
      </form>
    </div>
  );
}
