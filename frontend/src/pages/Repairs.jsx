// frontend/src/pages/Repairs.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listRepairs, deleteRepair } from "../api";
import { getUsernameFromToken, getRoleFromToken } from "../auth";

export default function RepairsPage() {
  const [repairs, setRepairs] = useState([]);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const username = getUsernameFromToken();
  const role = getRoleFromToken();

  // Solo ADMIN o creador pueden editar/eliminar
  const canEdit = (r) => role === "ADMIN" || r.created_by === username;

  const refresh = async () => {
    try {
      const { data } = await listRepairs({});
      setRepairs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErr("Error cargando reparaciones");
    }
  };

  const onDelete = async (id) => {
    if (!confirm("¿Eliminar esta reparación? Esta acción no se puede deshacer.")) return;
    try {
      await deleteRepair(id);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("No tienes permisos o ocurrió un error al eliminar.");
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Reparaciones</h1>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
      { (role === "ADMIN" || role === "TECH") && (
      <button onClick={()=>nav("/repairs/new")} style={{ marginBottom: 12 }}>
        Nueva reparación
      </button>
      )}

      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Técnico</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {repairs.map(r => (
            <tr key={r.id}>
              <td>{r.equipmentCode}</td>
              <td>{r.technician}</td>
              <td>{r.status}</td>
              <td>{r.date}</td>
              <td>
                {canEdit(r) && (
                  <>
                    <button onClick={() => nav(`/repairs/edit/${r.id}`)}>Editar</button>{" "}
                    <button onClick={() => onDelete(r.id)}>Eliminar</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}
