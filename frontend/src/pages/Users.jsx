import { useEffect, useState } from "react";
import api from "../api";

export default function UsersPage(){
  const [users, setUsers] = useState([]);
  const refresh = async () => {
    const { data } = await api.get("/admin/users"); // crea endpoint protegido admin-only
    setUsers(Array.isArray(data) ? data : []);
  };
  useEffect(()=>{ refresh(); }, []);

  return (
    <div>
      <h1>Usuarios</h1>
      <table border="1" cellPadding="8" cellSpacing="0">
        <thead><tr><th>Usuario</th><th>Rol</th></tr></thead>
        <tbody>{users.map((u,i)=>(
          <tr key={i}><td>{u.username}</td><td>{u.role}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
