import api from "../api";
import { useState } from "react";

export default function ReportsPage(){
  const [data, setData] = useState(null);
  const load = async () => {
    const { data } = await api.get("/reports/overview"); // crea este endpoint en backend
    setData(data);
  };
  return (
    <div>
      <h1>Reportes</h1>
      <button onClick={load}>Cargar reportes</button>
      <pre style={{background:"#111",color:"#0f0",padding:12}}>{data ? JSON.stringify(data,null,2) : "—"}</pre>
    </div>
  );
}
