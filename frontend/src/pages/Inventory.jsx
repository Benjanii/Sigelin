import { useEffect, useState } from "react";
import api from "../api";

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/inventory")
      .then(r => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(e => setErr(e?.response?.data?.detail || e.message));
  }, []);

  if (err) return <div className="card error">Error: {String(err)}</div>;
  return (
    <div className="page">
      <h1 className="page-title">Inventario</h1>

      {/* Sin botones de agregar/editar/eliminar */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Código (QR)</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.code}>
                  <td>{it.code}</td>
                  <td>{it.name}</td>
                  <td>{it.status}</td>
                  <td>{it.location}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="muted">Sin registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted small">
        La creación/edición del inventario se gestiona exclusivamente desde la base de datos (por política).
      </p>
    </div>
  );
}
