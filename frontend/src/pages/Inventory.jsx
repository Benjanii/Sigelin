import { useEffect, useState } from "react";
import { getItems, addItem } from "../api";
import { getRoleFromToken, clearToken } from "../auth";
import { useNavigate } from "react-router-dom";

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const role = getRoleFromToken();

  const refresh = async () => {
    try {
      const { data } = await getItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErr("No se pudo cargar inventario");
    }
  };

  const handleAdd = async () => {
  try {
    const newItem = { code:`EQ-${Date.now()}`, type:"pc", status:"OPEN", location:"Lab-3", qr:`QR-${Date.now()}` };
    // 1) agregamos item
    await addItem(newItem);
    // 2) abrimos nueva pestaña a la ruta de formulario para ese equipo
    const url = `${window.location.origin}/repairs/new?code=${encodeURIComponent(newItem.code)}&qr=${encodeURIComponent(newItem.qr)}`;
    window.open(url, "_blank"); // abre en nueva pestaña
    await refresh();
  } catch (e) {
    console.error(e);
    setErr("No tienes permisos o hubo un error al agregar");
  }
  };

  const logout = () => {
    clearToken();
    nav("/login", { replace: true });
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1>Inventario</h1>
        <button onClick={logout}>Cerrar sesión</button>
      </div>
      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr><th>Code</th><th>Type</th><th>Status</th><th>Location</th><th>QR</th></tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.code}>
              <td>{it.code}</td><td>{it.type}</td><td>{it.status}</td><td>{it.location}</td><td>{it.qr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
