import { useEffect, useState } from "react";
import api from "../api";
import { getRoleFromToken } from "../auth";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const role = getRoleFromToken();
  const nav = useNavigate();
  const [inProgress, setInProgress] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      // EN_REPARACION (similar a IN_PROGRESS). Puedes combinar ambos si quieres.
      const a = (await api.get("/repairs?status=IN_PROGRESS")).data || [];
      const b = (await api.get("/repairs?status=EN_REPARACION")).data || [];
      setInProgress([...a, ...b]);
    } catch (e) {
      setErr("No se pudo cargar reparaciones en progreso");
    }
  };

  useEffect(()=>{ load(); }, []);

  const canEdit = role === "ADMIN" || role === "TECH";

  return (
    <div style={{ padding:24 }}>
      <h1>Dashboard</h1>
      {err && <div style={{color:"crimson"}}>{err}</div>}

      <h2>Reparaciones en progreso</h2>
      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            <th>ID</th><th>Equipo</th><th>Técnico</th><th>Estado</th><th>Fecha</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {inProgress.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.equipmentCode} ({r.qr || "-"})</td>
              <td>{r.technician}</td>
              <td>{r.status}</td>
              <td>{r.date}</td>
              <td>
                <button onClick={()=>nav(`/repairs/report/${r.id}`)}>Ver reporte</button>{" "}
                {canEdit && <button onClick={()=>nav(`/repairs/edit/${r.id}`)}>Editar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
