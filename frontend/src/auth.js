// frontend/src/auth.js
export { logout as clearToken };
// Clave de almacenamiento local
const TOKEN_KEY = "sigelin_token";

// Intenta extraer un JWT válido desde distintas formas de respuesta
export function extractTokenFromLoginResponse(data) {
  // casos comunes: { access_token }, { token }, { jwt }
  return (
    data?.access_token ||
    data?.token ||
    data?.jwt ||
    null
  );
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

// Decodifica payload de JWT sin verificar firma (solo lectura de claims)
export function decodeJwt(jwt) {
  try {
    const [, payload] = jwt.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Devuelve el ROL desde el JWT.
 * Ajusta los claims si en tu backend usan otros nombres.
 */
export function getRoleFromToken() {
  const t = getToken();
  if (!t) return null;
  const payload = decodeJwt(t);
  return payload?.role || payload?.roles?.[0] || payload?.scope || null;
}

/**
 * Devuelve el usuario (username) desde el JWT para prellenar "created_by", etc.
 * Busca en los claims más comunes: sub, username, email.
 */
export function getUsernameFromToken() {
  const t = getToken();
  if (!t) return null;
  const payload = decodeJwt(t);
  return payload?.sub || payload?.username || payload?.email || null;
}

// Permisos simples por rol (ajústalo a tus needs reales)
const CAPABILITIES = {
  ADMIN: new Set([
    "purchases:write",
    "repairs:write",
    "parts:write",
    "inventory:read",
  ]),
  TECH: new Set([
    "repairs:write",
    "inventory:read",
  ]),
  DIRECTOR: new Set([
    "purchases:approve",
    "inventory:read",
  ]),
};

/** can("permiso") -> boolean */
export function can(cap) {
  const role = getRoleFromToken();
  if (!role) return false;
  const caps = CAPABILITIES[role] || new Set();
  return caps.has(cap);
}
