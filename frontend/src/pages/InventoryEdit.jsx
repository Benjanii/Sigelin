import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { updateItem, getItems } from "../api";
import { can } from "../auth";

export default function InventoryEditPage() {
  const { code } = useParams();
  const [form, setForm] = useState({ type:"pc", status:"OK", location:"" });
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = (await getItems()).data || [];
        const found = list.find(x => x.code === code);
        if (found) {
          setForm({ type: found.type || "pc", status: found.status || "OK", location: found.location || "" });
        } else {
          setErr("Item no encontrado");
        }
      } catch (e) { setErr("No se pudo cargar el item"); }
    })();
  }, [code]);

  if (!can("inventory:write")) {
    return <div style={{ padding:24 }}><h2>No tienes permisos</h2></div>;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await updateItem(code, form); 
      alert("Actualizado");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Error al actualizar");
    }
  };

  return (
    <div style={{ padding:24 }}>
      <h1>Editar Item: {code}</h1>
      {err && <div style={{ color:"crimson" }}>{err}</div>}
      <form onSubmit={onSubmit} style={{ display:"grid", gap:12, maxWidth:480 }}>
        <div>
          <label>Type</label><br/>
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
          <input value={form.location} onChange={e=>setForm({...form, location:e.target.value})}/>
        </div>

        <div><button type="submit">Guardar</button></div>
      </form>
    </div>
  );
}
