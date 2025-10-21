// frontend/src/pages/Parts.jsx
import { useEffect, useState } from "react";
import api from "../api";
import { getRoleFromToken } from "../auth";
import { useNavigate } from "react-router-dom";

export default function PartsPage() {
  const role = getRoleFromToken();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [parts, setParts] = useState([]);

  const refresh = async () => {
    try {
      const { data } = await api.get("/parts");
      setParts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e); setErr("No se pudo cargar repuestos");
    }
  };

  useEffect(()=>{ refresh(); }, []);

  return (
    <div style={{ padding:24 }}>
      <h1>Repuestos</h1>
      {err && <div style={{ color:"crimson" }}>{err}</div>}

      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            <th>SKU</th><th>Nombre</th><th>Stock</th><th>Stock mínimo</th><th>Unidad</th><th>Categoría</th><th>Ubicación</th>
          </tr>
        </thead>
        <tbody>
          {parts.map(p=>(
            <tr key={p.sku}>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td>{p.stock}</td>
              <td>{p.minStock ?? 0}</td>
              <td>{p.unit || "-"}</td>
              <td>{p.category || "-"}</td>
              <td>{p.location || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
