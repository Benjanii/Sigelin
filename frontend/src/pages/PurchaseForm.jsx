// frontend/src/pages/PurchaseForm.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { createPurchase, getItems } from "../api";

/* ======== helpers de borrador ======== */
const DRAFT_KEY = "purchaseDraft";
const loadDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || { newItems: [], supplier: "", note: "" };
  } catch {
    return { newItems: [], supplier: "", note: "" };
  }
};
const saveDraft = (d) => localStorage.setItem(DRAFT_KEY, JSON.stringify(d));

/* ======== formateo de errores legibles ======== */
function fmtError(err) {
  if (!err) return "Error desconocido";
  const detail =
    err?.response?.data?.detail ??
    err?.response?.data?.message ??
    err?.message ??
    err?.toString();
  if (typeof detail === "string") return detail;
  try { return JSON.stringify(detail, null, 2); } catch { return String(detail); }
}

export default function PurchaseForm() {
  const navigate = useNavigate();
  const [qs] = useSearchParams();

  // modo de trabajo
  const appendMode = qs.get("append") === "1";     // si viene, agrega al borrador y vuelve
  const defaultDest = qs.get("dest") || "PARTS";   // PARTS | INVENTORY
  const title = useMemo(
    () => (appendMode ? "Agregar nuevo ítem a la compra" : "Nueva compra"),
    [appendMode]
  );

  // modelo del ítem (si appendMode, representará 1 ítem a agregar)
  const [destination] = useState(defaultDest); // viene por query
  const [selectedCode, setSelectedCode] = useState("");     // code del item elegido en el select
  const [displayName, setDisplayName] = useState("");       // ← NOMBRE VISIBLE que se enviará al backend
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");   // solo números
  const [unitPrice, setUnitPrice] = useState("0"); // solo números

  // INVENTORY
  const [location, setLocation] = useState("");

  // lists
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);

  // “crear compra directa”
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  // Cargar ITEMS: /items y fallback /inventory
  useEffect(() => {
    (async () => {
      try {
        let arr = [];
        try {
          const rItems = await api.get("/items");
          arr = Array.isArray(rItems?.data) ? rItems.data : (rItems?.data?.items || []);
        } catch {}
        if (!Array.isArray(arr) || arr.length === 0) {
          try {
            const rInv = await getItems(); // /inventory
            arr = Array.isArray(rInv) ? rInv : (rInv?.items || rInv?.data || []);
          } catch {}
        }
        setInventory(Array.isArray(arr) ? arr : []);
      } catch (e) {
        console.warn("No se pudieron cargar items", e);
        setInventory([]);
      }
    })();
  }, []);

  // Cargar LOCATIONS
  useEffect(() => {
    (async () => {
      try {
        const rLoc = await api.get("/locations");
        const list = Array.isArray(rLoc?.data) ? rLoc.data : (rLoc?.data?.items || []);
        setLocations(list);
        if (!location && list.length > 0) {
          const first = list[0]?.name || list[0]?.code || "";
          if (first) setLocation(first);
        }
      } catch (error) {
        console.error("Error cargando ubicaciones:", error);
        setLocations([]);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sanitizar numéricos
  const onQuantityChange = (e) => setQuantity((e.target.value || "").replace(/[^0-9]/g, ""));
  const onUnitPriceChange = (e) => setUnitPrice((e.target.value || "").replace(/[^0-9]/g, ""));

  // Cuando cambias el equipo en el select, armamos un nombre legible por defecto
  const onSelectItem = (code) => {
    setSelectedCode(code);
    if (!code) {
      setDisplayName("");
      return;
    }
    const it = (Array.isArray(inventory) ? inventory : []).find(x => x.code === code);
    // Nombre preferente: it.name si existe; si no, "Tipo Código"
    const nice = (it?.name && String(it.name).trim())
      ? String(it.name).trim()
      : `${it?.type || "Equipo"} ${it?.code || code}`.trim();
    setDisplayName(nice);
  };

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");

    if (!selectedCode) return setErr("Debes seleccionar un equipo del inventario.");
    if (!displayName.trim()) return setErr("Debes indicar un nombre visible para el equipo.");
    if (!quantity || Number(quantity) <= 0) return setErr("La cantidad debe ser mayor a 0.");

    const itemPayload = {
      destination,              // PARTS o INVENTORY
      is_new_product: true,
      // SKU/QR: backend los genera
      quantity: Number(quantity),
      unit_price: Number(unitPrice || 0),
      new_product: {
        name: displayName.trim(),                    // ←← NOMBRE QUE SE GUARDARÁ EN items
        description: (description || "").trim(),
        ...(destination === "INVENTORY" ? {
          // Opcionalmente puedes también enviar el code seleccionado,
          // solo como referencia; el backend igualmente genera uno nuevo
          // si necesita crear nuevos equipos.
          // code_base: selectedCode,  // si quisieras
          location: (location || "").trim(),
        } : {})
      }
    };

    try {
      setSaving(true);

      if (appendMode) {
        // Guardar en borrador y volver
        const draft = loadDraft();
        draft.newItems = Array.isArray(draft.newItems) ? draft.newItems : [];
        draft.newItems.push({
          destination,
          name: itemPayload.new_product.name,      // persistimos el nombre visible
          description: itemPayload.new_product.description,
          quantity: itemPayload.quantity,
          unit_price: itemPayload.unit_price,
          ...(destination === "INVENTORY" ? { location: itemPayload.new_product.location } : {}),
        });
        saveDraft(draft);
        setOk("Ítem agregado al borrador de compra.");
        navigate("/purchases");
        return;
      }

      // Crear compra directa
      await createPurchase({
        supplier,
        items: [itemPayload],
        note,
        category: "mixed"
      });
      setOk("Compra creada.");
      navigate("/purchases");
    } catch (e) {
      setErr(fmtError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 920, margin: "24px auto" }}>
        <h1 className="page-title">{title}</h1>

        {err && <div className="card error" style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>{err}</div>}
        {ok && <div className="card" style={{ marginBottom: 8, borderColor: "#3fa66a" }}>{ok}</div>}

        <form onSubmit={submit}>
          {!appendMode && (
            <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <legend style={{ padding: "0 6px", opacity: .85 }}>Datos de la compra</legend>
              <div className="grid md:grid-cols-2 gap-2">
                <label>
                  Proveedor
                  <input value={supplier} onChange={(e) => setSupplier(e.target.value)} required />
                </label>
                <label>
                  Nota
                  <input value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
              </div>
            </fieldset>
          )}

          <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <legend style={{ padding: "0 6px", opacity: .85 }}>Datos del ítem</legend>
            <div className="grid md:grid-cols-2 gap-2">
              <label className="md:col-span-2">
                Equipo del inventario *
                <select value={selectedCode} onChange={e=>onSelectItem(e.target.value)} required autoFocus>
                  <option value="">— seleccionar —</option>
                  {(Array.isArray(inventory)?inventory:[]).map(it => (
                    <option key={it.code || it._id} value={it.code}>
                      {(it.type || it.name || "Equipo")} — {it.name}, {it.code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="md:col-span-2">
                Nombre visible *
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </label>

              <label className="md:col-span-2">
                Descripción
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle del equipo / repuesto" />
              </label>
            </div>
          </fieldset>

          {destination === "INVENTORY" && (
            <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <legend style={{ padding: "0 6px", opacity: .85 }}>Configuración de inventario</legend>
              <div className="grid md:grid-cols-3 gap-2">
                <label>
                  Ubicación
                  <select value={location} onChange={(e) => setLocation(e.target.value)} required>
                    <option value="" disabled>Selecciona una ubicación</option>
                    {locations.map((loc, i) => (
                      <option key={`${loc.name || loc.code || i}`} value={loc.name || loc.code}>
                        {loc.name || loc.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
          )}

          <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <legend style={{ padding: "0 6px", opacity: .85 }}>Cantidad y precio</legend>
            <div className="grid md:grid-cols-3 gap-2">
              <label>
                Cantidad
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantity}
                  onChange={onQuantityChange}
                  required
                />
              </label>
              <label>
                Precio unitario
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={unitPrice}
                  onChange={onUnitPriceChange}
                  required
                />
              </label>
              <div className="muted" style={{ alignSelf: "end" }}>
                Total estimado: {Number(quantity || 0) * Number(unitPrice || 0)}
              </div>
            </div>
          </fieldset>

          <div className="mt-3 flex gap-2">
            <button type="button" className="btn" onClick={() => navigate("/purchases")} disabled={saving}>Cancelar</button>
            <button className="btn" type="submit" disabled={saving}>
              {appendMode ? (saving ? "Agregando..." : "Agregar a la compra") : (saving ? "Creando..." : "Crear compra")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================== estilos mínimos para fieldsets (opcional) ================== */
if (typeof document !== "undefined" && !document.getElementById("purchase-form-style")) {
  const style = document.createElement("style");
  style.id = "purchase-form-style";
  style.innerHTML = `
  fieldset legend { font-size: .95rem; }
  .muted { color: var(--text-muted); }
  `;
  document.head.appendChild(style);
}
