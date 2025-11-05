// frontend/src/pages/Login.jsx
import { useState } from "react";
import { login, me } from "../api";
import { extractTokenFromLoginResponse, setToken } from "../auth";
import { useNavigate } from "react-router-dom";

/* Errores legibles */
function fmtError(err) {
  const data = err?.response?.data;
  const detail = data?.detail ?? data?.message ?? err?.message ?? err?.toString();
  if (Array.isArray(detail)) {
    try {
      return detail.map(e => {
        const path = Array.isArray(e?.loc) ? e.loc.join(" > ") : "";
        const msg = e?.msg || JSON.stringify(e);
        return `• ${path}: ${msg}`;
      }).join("\n");
    } catch {
      return JSON.stringify(detail, null, 2);
    }
  }
  if (typeof detail === "string") return detail;
  try { return JSON.stringify(detail, null, 2); } catch { return String(detail); }
}

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const data = await login(username, password);
      const token = extractTokenFromLoginResponse(data);
      if (!token) {
        setErr("El servidor no retornó un token válido.");
        setBusy(false);
        return;
      }
      setToken(token);

      // opcional: ping /auth/me para validar y decidir a qué ruta ir
      try {
        await me();
      } catch {}

      nav("/dashboard");
    } catch (e2) {
      setErr(fmtError(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ display:"grid", placeItems:"center", minHeight:"70vh" }}>
      <div className="card" style={{ width: 380 }}>
        <h1 className="page-title">Iniciar sesión</h1>
        {err && <div className="card error" style={{ whiteSpace:"pre-wrap", marginBottom: 8 }}>{err}</div>}
        <form onSubmit={submit} className="grid gap-2">
          <label>
            Usuario
            <input value={username} onChange={(e)=>setUsername(e.target.value)} autoFocus required />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          </label>
          <button className="btn" disabled={busy} type="submit">
            {busy ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
