import { useEffect, useState } from "react";
import { health, getItems, addItem } from "./api";

function normalizeItems(data) {
  // Si /inventory/ devuelve un array, úsalo
  if (Array.isArray(data)) return data;
  // Si devuelve objeto con { items: [...] }, úsalo
  if (data && Array.isArray(data.items)) return data.items;
  // Si devuelve error { detail: ... }, log y vacío
  if (data && data.detail) {
    console.error("API detail:", data.detail);
    return [];
  }
  return [];
}

export default function App() {
  const [status, setStatus] = useState("checking...");
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);   // SIEMPRE array
  const [loading, setLoading] = useState(false);

  const refreshItems = async () => {
    setLoading(true);
    try {
      const { data } = await getItems();      // GET /inventory/
      const normalized = normalizeItems(data);
      setItems(normalized);
      if (!Array.isArray(data) && !Array.isArray(data?.items)) {
        setError(prev => (prev ? prev + "\n" : "") + "La API devolvió un formato no esperado. Revisa /inventory/ en el navegador.");
      }
    } catch (e) {
      console.error(e);
      setError(prev => (prev ? prev + "\n" : "") + String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await health();       // GET /health
        setStatus(data.status);
      } catch (e) {
        console.error(e);
        setStatus("error");
        setError(prev => (prev ? prev + "\n" : "") + "Error llamando /health: " + String(e?.message || e));
      }
    })();
    refreshItems();
  }, []);

  const handleAdd = async () => {
    try {
      const newItem = {
        code: `EQ-${Date.now()}`,
        type: "pc",
        status: "OK",
        location: "Lab-3",
        qr: `QR-${Date.now()}`
      };
      await addItem(newItem);      // POST /inventory/
      await refreshItems();
    } catch (e) {
      console.error(e);
      setError(prev => (prev ? prev + "\n" : "") + "Error al agregar: " + String(e?.message || e));
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h1>SIGELIN Frontend</h1>
      <p><strong>API health:</strong> {status}</p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={handleAdd}>Agregar Item (demo)</button>
        <button onClick={refreshItems} style={{ marginLeft: 8 }}>Refrescar</button>
      </div>

      {error && <pre style={{color:"crimson", whiteSpace:"pre-wrap"}}>{error}</pre>}

      {loading ? <p>Cargando...</p> : (
        <table border="1" cellPadding="8" cellSpacing="0">
          <thead>
            <tr>
              <th>Code</th><th>Type</th><th>Status</th><th>Location</th><th>QR</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.code}>
                <td>{it.code}</td>
                <td>{it.type}</td>
                <td>{it.status}</td>
                <td>{it.location}</td>
                <td>{it.qr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
