import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, me } from "../api";
import { saveToken, getRoleFromToken } from "../auth";

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const { data } = await login(username, password); // { access_token }
      saveToken(data.access_token);
      await me(); // opcional: valida el token con backend
      const role = getRoleFromToken();
      // redirige al inventario (mostrarás/ocultarás botones según rol)
      nav("/inventory", { replace: true });
    } catch (e) {
      console.error(e);
      setErr("Credenciales inválidas");
    }
  };

  return (
    <div style={{ display:"grid", placeItems:"center", minHeight:"100vh" }}>
      <form onSubmit={onSubmit} style={{ padding:24, border:"1px solid #444", borderRadius:8, minWidth:320 }}>
        <h2>Login SIGELIN</h2>
        <div style={{ marginBottom:12 }}>
          <label>Usuario</label><br/>
          <input value={username} onChange={e=>setUsername(e.target.value)} style={{ width:"100%" }} />
        </div>
        <div style={{ marginBottom:12 }}>
          <label>Contraseña</label><br/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:"100%" }} />
        </div>
        {err && <div style={{ color:"crimson", marginBottom:12 }}>{err}</div>}
        <button type="submit" style={{ width:"100%" }}>Ingresar</button>
      </form>
    </div>
  );
}
