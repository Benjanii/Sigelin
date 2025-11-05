import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRepair, createRepair, updateRepair, getRepairStates, getItems, getLocations } from "../api";

import { getRoleFromToken, getUsernameFromToken } from "../auth";

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


function needsRepair(status) {
  if (!status) return false;
  const s = String(status).toUpperCase();
  const BAD = new Set(["POR REPARAR","MALO"]);
  return BAD.has(s);
}

export default function RepairFormPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const role = getRoleFromToken();
  const user = getUsernameFromToken();

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [locations, setLocations] = useState([]);
  const [states, setStates] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [invQuery, setInvQuery] = useState("");
  const [onlyNeeds, setOnlyNeeds] = useState(true);

  const [form, setForm] = useState({
    device_code: "",
    title: "",
    description: "",
    diagnostics: "",
    actions: "",
    status: "OPEN",
    created_by: user || "sistema",
    notes: "",
    parts_used: [],
    location: "",
  });

  // para “ver equipo actual” en modo edición
  const invMap = useMemo(() => {
    const m = new Map();
    for (const it of Array.isArray(inventory) ? inventory : []) {
      if (it?.code) m.set(it.code, it);
    }
    return m;
  }, [inventory]);

useEffect(() => {
  (async () => {
    try {
      const data = await getLocations();
      const arr = Array.isArray(data) ? data : (data?.items || data?.data || []);
      setLocations(arr);
    } catch (e) {
      console.warn("No se pudieron cargar ubicaciones", e);
      setLocations([]);
    }
  })();
}, []);
useEffect(() => {
  if (!form.location && form.device_code && Array.isArray(inventory)) {
    const item = inventory.find(x => x.code === form.device_code);
    if (item?.location) {
      setForm(f => ({ ...f, location: item.location }));
    }
  }
}, [inventory, form.device_code]);


  // Carga estados, inventario y (si edita) la reparación
  useEffect(() => {
    (async () => {
      try {
        const s = await getRepairStates();
        const options = Array.isArray(s) ? s : (s?.states || []);
        setStates(options);
      } catch {
        setStates([]);
      }

      try {
        const items = await getItems();
        const arr = Array.isArray(items) ? items : (items?.items || []);
        arr.sort((a,b) => (needsRepair(b.status) ? 1 : 0) - (needsRepair(a.status) ? 1 : 0));
        setInventory(arr);
      } catch (e) {
        console.warn("No se pudo cargar inventario", e);
      }

      if (isEdit) {
        try {
          const r = await getRepair(id);
          setForm(f => ({
            ...f,
            device_code: r.device_code || r.inventory_code || r.equipmentCode || r.code || "",
            title: r.title || "",
            description: r.description || "",
            diagnostics: r.diagnostics || "",
            actions: r.actions || "",
            status: r.status || r.state || f.status,
            created_by: r.created_by || r.technician || f.created_by,
            notes: r.notes || "",
            parts_used: Array.isArray(r.parts_used) ? r.parts_used : [],
            location: r.location || f.location,
          }));
        } catch (e) {
          setErr(fmtError(e));
        }
      }
    })();
  }, [id, isEdit]);

  // Lista filtrada de inventario (solo en “nuevo”)
  const filteredInventory = useMemo(() => {
    const q = invQuery.trim().toLowerCase();
    return inventory
      .filter(it => (onlyNeeds ? needsRepair(it.status) : true))
      .filter(it => {
        if (!q) return true;
        return [it.code, it.type, it.location, it.status]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q));
      })
      .slice(0, 200);
  }, [inventory, invQuery, onlyNeeds]);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");

    if (!form.device_code.trim()) { setErr("Debes seleccionar/ingresar el código del equipo."); return; }

    const payload = {
      device_code: form.device_code.trim(),
      description: form.description.trim(),
      diagnostics: form.diagnostics.trim(),
      actions: form.actions.trim(),
      status: form.status,
      created_by: form.created_by,
      notes: form.notes.trim(),
      parts_used: form.parts_used,
      location: form.location?.trim() || undefined,
    };

    try {
      if (isEdit) {
        await updateRepair(id, payload);
        setOk("Reparación actualizada.");
      } else {
        await createRepair(payload);
        setOk("Reparación registrada.");
      }
      setTimeout(() => nav("/repairs"), 400);
    } catch (e) {
      setErr(fmtError(e));
    }
  }

  const canWrite = role === "ADMIN" || role === "TECH";
  const currentItem = isEdit ? invMap.get(form.device_code) : null;

  const copy = async (text) => { try { await navigator.clipboard.writeText(text); } catch {} };

  return (
    <div className="page">
      <h1 className="page-title">{isEdit ? "Editar reparación" : "Nueva reparación"}</h1>
      {err && <div className="card error" style={{ whiteSpace:"pre-wrap", marginBottom: 8 }}>{err}</div>}
      {ok && <div className="card ok" style={{ marginBottom: 8 }}>{ok}</div>}

      <div
        className="grid"
        style={{ gridTemplateColumns: isEdit ? "1fr" : "minmax(260px, 420px) 1fr", gap: 14 }}
      >
        {/* === Izquierda: SOLO EN NUEVA REPARACIÓN === */}
        {!isEdit && (
          <div className="card" style={{ maxHeight: 560, display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <b>Equipos del inventario</b>
            </div>
            <div className="grid md:grid-cols-2 gap-2" style={{ marginBottom: 8 }}>
              <input
                placeholder="Buscar por código, tipo o ubicación…"
                value={invQuery}
                onChange={e => setInvQuery(e.target.value)}
              />
              <label className="flex items-center" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={onlyNeeds}
                  onChange={e => setOnlyNeeds(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>Solo que necesitan reparación</span>
              </label>
            </div>

            <div className="table-responsive" style={{ flex: 1, overflow: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Código</th>
                    <th>Equipo</th>
                    <th>Estado</th>
                    <th>Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(it => {
                    const isSel = (form.device_code || "") === it.code;
                    const tag = needsRepair(it.status) ? "Necesita reparación" : "OK";
                    return (
                      <tr
                        key={it.code}
                        onClick={() => setForm(f => ({ ...f, device_code: it.code }))}
                        style={{ cursor: "pointer", background: isSel ? "rgba(138,164,255,.10)" : undefined }}
                        title="Seleccionar este equipo"
                      >
                        <td>{it.code}</td>
                        <td>{it.name || "—"}</td>
                        <td><span className="badge">{`${it.status || "—"} (${tag})`}</span></td>
                        <td>{it.location || "—"}</td>
                      </tr>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <tr><td colSpan={4} style={{ opacity:.7 }}>No se encontraron equipos con ese criterio.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Tip: haz click en una fila para completar el <b>código</b> del equipo en el formulario.
            </div>
          </div>
        )}

        {/* Formulario */}
        <div className="grid gap-2" style={{ maxWidth: 960 }}>
          {isEdit && (
            <div className="card" style={{ marginBottom: 6 }}>
              <b>Equipo de esta reparación</b>
              <div style={{ display:"grid", gap:6, marginTop:8 }}>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                  <span className="muted">Código:</span>
                  <b>{form.device_code || "—"}</b>
                  {currentItem?.type && <span className="badge" title="Tipo">{currentItem.type}</span>}
                  {currentItem?.location && <span className="badge" title="Ubicación">{currentItem.location}</span>}
                  {currentItem?.status && <span className="badge" title="Estado">{currentItem.status}</span>}
                  {currentItem?.name && <span className="badge" title="Nombre"> {currentItem.name}</span>}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span className="muted">QR:</span>
                  <code>{currentItem?.qr || "—"}</code>
                  {!!currentItem?.qr && (
                    <button className="btn ghost" type="button" onClick={() => copy(currentItem.qr)} title="Copiar QR" style={{ padding:"6px 10px" }}>
                      Copiar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="grid gap-2">
            <fieldset>
              <legend>Datos del equipo y estado</legend>
              <div className="grid md:grid-cols-3 gap-2">
                <label>
                  Código de equipo (inventario) *
                  <input
                    value={form.device_code}
                    onChange={e => setForm({ ...form, device_code: e.target.value })}
                    placeholder={isEdit ? "" : "Selecciona de la lista o escribe el código…"}
                    required
                    readOnly={isEdit}
                  />
                </label>
                <label>
                  Estado
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>
                  Creado por
                  <input value={form.created_by} onChange={e => setForm({ ...form, created_by: e.target.value })} />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Diagnóstico y acciones</legend>
              <div className="grid md:grid-cols-2 gap-2">
                <label className="md:col-span-2">
                  Descripción
                  <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </label>
                <label className="md:col-span-1">
                  Diagnóstico
                  <textarea rows={3} value={form.diagnostics} onChange={e => setForm({ ...form, diagnostics: e.target.value })} />
                </label>
                <label className="md:col-span-1">
                  Acciones realizadas
                  <textarea rows={3} value={form.actions} onChange={e => setForm({ ...form, actions: e.target.value })} />
                </label>
                <label className="md:col-span-1">
                Ubicación
                <select
                  value={form.location ?? ""}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  required
                >
                  <option value="" disabled>— seleccionar ubicación —</option>
                  {locations.map((loc, i) => {
                    const val = loc.name || loc.value || loc.label || loc.code;
                    return (
                      <option key={val || i} value={val}>{val}</option>
                    );
                  })}
                </select>
              </label>
              </div>
            </fieldset>

            <div className="mt-3 flex gap-2">
              <button type="button" className="btn ghost" onClick={() => history.back()}>Cancelar</button>
              {canWrite && <button className="btn" type="submit">{isEdit ? "Guardar cambios" : "Registrar reparación"}</button>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
