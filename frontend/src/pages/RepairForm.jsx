import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import api, { createRepair } from "../api";
import { getUsernameFromToken, can } from "../auth";

const LOCATIONS = ["Lab-1","Lab-2","Lab-3","Bodega","Dirección TI","Recepción"];
const EQUIPMENT_TYPES = ["pc","notebook","printer","all-in-one","projector"];

function genCode(){ return "EQ-" + Date.now(); }
function genQR(code){ return "QR-" + code; }

export default function RepairFormPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { id } = useParams(); // si implementas edición por id

  // inventario para elegir equipo existente
  const [items, setItems] = useState([]);
  const [partsList, setPartsList] = useState([]);

  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    useExisting: true,         // true: desde inventario; false: equipo nuevo
    equipmentCode: "",         // si useExisting
    qr: "",
    newType: "pc",             // si es nuevo
    newLocation: LOCATIONS[0], // si es nuevo

    status: "EN_REPARACION",   // estados extendidos
    description: "",
    proposal: "",              // requerido si POR_REPARAR
    partsUsed: [],
    softwareChanges: "",
    hardwareChanges: "",
    technician: getUsernameFromToken() || ""
  });

  const [partSku, setPartSku] = useState("");
  const [partQty, setPartQty] = useState(1);

  useEffect(()=>{ (async ()=>{
    try {
      const inv = (await api.get("/inventory")).data || [];
      setItems(inv);
    } catch {}
    try {
      const { data } = await api.get("/parts");
      setPartsList(Array.isArray(data) ? data : []);
    } catch {}
  })(); }, []);

  // Al elegir equipo existente, completar QR automáticamente
  useEffect(()=>{
    if (form.useExisting && form.equipmentCode) {
      const it = items.find(i => i.code === form.equipmentCode);
      setForm(f => ({ ...f, qr: it?.qr || "" }));
    }
  }, [form.useExisting, form.equipmentCode, items]);

  const addPart = () => {
    if(!partSku || !partQty) return;
    setForm(prev => ({ ...prev, partsUsed: [...prev.partsUsed, { sku: partSku, qty: Number(partQty) }] }));
    setPartSku(""); setPartQty(1);
  };
  const removePart = (i) => {
    setForm(prev => ({ ...prev, partsUsed: prev.partsUsed.filter((_,idx)=>idx!==i) }));
  };

  const onSubmit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      const payload = {
        status: form.status,
        description: form.description,
        softwareChanges: form.softwareChanges,
        hardwareChanges: form.hardwareChanges,
        proposal: form.status === "POR_REPARAR" ? form.proposal : undefined,
        partsUsed: form.partsUsed
      };

      if (form.useExisting) {
        if (!form.equipmentCode) throw new Error("Debes seleccionar un equipo existente");
        payload.equipmentCode = form.equipmentCode;
        payload.qr = form.qr;
      } else {
        payload.newEquipment = true;
        payload.type = form.newType;
        payload.location = form.newLocation;
        // el backend generará code/qr automáticamente, pero si quieres mostrarlo:
        payload.equipmentCode = genCode();
        payload.qr = genQR(payload.equipmentCode);
      }

      const { data } = await createRepair(payload);
      nav(`/repairs/report/${data?.id}`, { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.detail || String(e));
    }
  };

  if (!can("repairs:write")) {
    return <div style={{ padding:24 }}><h2>No tienes permisos para crear reparaciones</h2></div>;
  }

  return (
    <div style={{ padding:24 }}>
      <h1>{id ? "Editar Reparación" : "Nueva Reparación"}</h1>
      {err && <div style={{ color:"crimson" }}>{err}</div>}

      <form onSubmit={onSubmit} style={{ display:"grid", gap:12, maxWidth:720 }}>
        <fieldset style={{ border:"1px solid #ccc", padding:12 }}>
          <legend>Equipo</legend>

          <div>
            <label>
              <input
                type="radio"
                checked={form.useExisting}
                onChange={()=>setForm(f=>({ ...f, useExisting:true }))}
              /> Usar equipo existente
            </label>
            {"  "}
            <label>
              <input
                type="radio"
                checked={!form.useExisting}
                onChange={()=>setForm(f=>({ ...f, useExisting:false }))}
              /> Equipo nuevo
            </label>
          </div>

          {form.useExisting ? (
            <>
              <div>
                <label>Equipo del inventario</label><br/>
                <select value={form.equipmentCode} onChange={e=>setForm({...form, equipmentCode:e.target.value})} required>
                  <option value="">-- seleccionar equipo --</option>
                  {items.map(it => <option key={it.code} value={it.code}>{it.code} — {it.type} ({it.location})</option>)}
                </select>
              </div>
              <div>
                <label>QR (auto)</label><br/>
                <input value={form.qr} readOnly />
              </div>
            </>
          ) : (
            <>
              <div>
                <label>Tipo</label><br/>
                <select value={form.newType} onChange={e=>setForm({...form, newType:e.target.value})}>
                  {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Ubicación</label><br/>
                <select value={form.newLocation} onChange={e=>setForm({...form, newLocation:e.target.value})}>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ opacity:.7 }}><small>El código y QR se generarán automáticamente.</small></div>
            </>
          )}
        </fieldset>

        <div>
          <label>Estado</label><br/>
          <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
            <option value="EN_REPARACION">EN_REPARACION</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="POR_REPARAR">POR_REPARAR</option>
            <option value="MALO">MALO</option>
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        {form.status === "POR_REPARAR" && (
          <div>
            <label>Propuesta (explicar falla y cómo repararla)</label><br/>
            <textarea value={form.proposal} onChange={e=>setForm({...form, proposal:e.target.value})} required />
          </div>
        )}

        <div><label>Descripción (falla / trabajo)</label><br/>
          <textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} required />
        </div>

        <div style={{ marginTop:12 }}>
          <label>Partes usadas</label><br/>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
            <select value={partSku} onChange={e=>setPartSku(e.target.value)}>
              <option value="">-- seleccionar sku --</option>
              {partsList.map(p => <option key={p.sku} value={p.sku}>{p.sku} ({p.stock})</option>)}
            </select>
            <input type="number" value={partQty} min="1" onChange={e=>setPartQty(e.target.value)} style={{ width:80 }} />
            <button type="button" onClick={addPart}>Agregar parte</button>
          </div>
          <ul>
            {form.partsUsed.map((pu,i)=>(
              <li key={i}>{pu.sku} x {pu.qty} <button type="button" onClick={()=>removePart(i)}>Quitar</button></li>
            ))}
          </ul>
        </div>

        <div><label>Cambios software</label><br/>
          <textarea value={form.softwareChanges} onChange={e=>setForm({...form, softwareChanges:e.target.value})} />
        </div>

        <div><label>Cambios hardware</label><br/>
          <textarea value={form.hardwareChanges} onChange={e=>setForm({...form, hardwareChanges:e.target.value})} />
        </div>

        <div style={{ marginTop:12 }}>
          <button type="submit">{id ? "Guardar cambios" : "Finalizar reparación"}</button>
        </div>
      </form>
    </div>
  );
}
