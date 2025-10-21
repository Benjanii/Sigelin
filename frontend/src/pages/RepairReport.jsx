import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getRepair } from "../api";

const statusLabel = (st) => (st==="CLOSED" ? "LISTO" : "EN PROCESO");

export default function RepairReportPage() {
  const { id } = useParams();
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState("");

  useEffect(()=>{ (async ()=>{
    try { const { data } = await getRepair(id); setRep(data); }
    catch(e){ setErr("No se pudo cargar el reporte"); }
  })(); }, [id]);

  const onPrint = () => window.print();

  if (err) return <div style={{padding:24, color:"crimson"}}>{err}</div>;
  if (!rep) return <div style={{padding:24}}>Cargando...</div>;

  return (
    <div style={{ padding: 24, background:"#fff", color:"#000" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1>Reporte de Reparación</h1>
        <button onClick={onPrint}>Imprimir</button>
      </div>
      <table border="1" cellPadding="8" cellSpacing="0" style={{ width:"100%", marginTop:12 }}>
        <tbody>
          <tr><th align="left" style={{width:"220px"}}>Estado</th><td>{statusLabel(rep.status)} ({rep.status})</td></tr>
          <tr><th align="left">ID</th><td>{rep.id}</td></tr>
          <tr><th align="left">Equipo</th><td>{rep.equipmentCode} — QR: {rep.qr || "-"}</td></tr>
          <tr><th align="left">Técnico</th><td>{rep.technician}</td></tr>
          <tr><th align="left">Fecha</th><td>{rep.date}</td></tr>
          <tr><th align="left">Descripción</th><td>{rep.description}</td></tr>
          {rep.proposal && <tr><th align="left">Propuesta</th><td>{rep.proposal}</td></tr>}
          <tr><th align="left">Software</th><td>{rep.softwareChanges || "—"}</td></tr>
          <tr><th align="left">Hardware</th><td>{rep.hardwareChanges || "—"}</td></tr>
          <tr>
            <th align="left">Partes usadas</th>
            <td>
              {(rep.partsUsed||[]).length ? (
                <ul>{rep.partsUsed.map((p,i)=><li key={i}>{p.sku} x {p.qty}</li>)}</ul>
              ) : "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
