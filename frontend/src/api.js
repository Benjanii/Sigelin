// frontend/src/api.js
import axios from "axios";
import { getToken, clearToken } from "./auth";

// Permite configurar la URL por entorno (Vite) y cae en localhost por defecto
const BASE_URL = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// ---- NUEVO: si token es inválido/caducó → limpiar y mandar a /login
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      clearToken();
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// =============== HELPERS ===============
export const unwrap = (p) => p.then((r) => r.data);

export function fmtApiError(e) {
  const d = e?.response?.data;
  const detail = d?.detail ?? d?.message ?? e?.message ?? e?.toString();
  if (Array.isArray(detail)) {
    try {
      return detail.map(x => {
        const path = Array.isArray(x?.loc) ? x.loc.join(" > ") : "";
        const msg = x?.msg || JSON.stringify(x);
        return `• ${path}: ${msg}`;
      }).join("\n");
    } catch {
      return JSON.stringify(detail, null, 2);
    }
  }
  if (typeof detail === "string") return detail;
  try { return JSON.stringify(detail, null, 2); } catch { return String(detail); }
}

// =============== AUTH ===============
export async function login(username, password) {
  // 1) JSON
  try {
    const { data } = await api.post("/auth/login", { username, password });
    return data;
  } catch (e) {
    const status = e?.response?.status;
    if (![400, 401, 422].includes(status)) throw e;
  }
  // 2) x-www-form-urlencoded
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);
  const { data } = await api.post("/auth/login", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data;
}

export const me = () => unwrap(api.get("/auth/me"));

// =============== HEALTH ===============
export const health = () => unwrap(api.get("/health"));

// =============== INVENTORY (legacy lectura) ===============
export const getItems = () => unwrap(api.get("/inventory"));
export const addItem = (item) => unwrap(api.post("/inventory", item));
export const updateItem = (code, payload) => unwrap(api.patch(`/inventory/${code}`, payload));
export const deleteItem = (code) => unwrap(api.delete(`/inventory/${code}`));
export const listlocations = () => unwrap(api.get("/locations"));

// =============== ITEMS (colección 'items') & LOCATIONS (colección 'location') ===============
export const getItemsCollection = () => unwrap(api.get("/items"));
export const getLocations = () => unwrap(api.get("/locations"));

// =============== PARTS ===============
export const listParts = (params) => unwrap(api.get("/parts", { params }));

// =============== REPAIRS ===============
export const listRepairs = (params) => unwrap(api.get("/repairs", { params }));
export const getRepair = (id) => unwrap(api.get(`/repairs/${id}`));
export const createRepair = (payload) => unwrap(api.post("/repairs", payload));
export const updateRepair = (id, payload) => unwrap(api.patch(`/repairs/${id}`, payload));
export const deleteRepair = (id) => unwrap(api.delete(`/repairs/${id}`));
export const getRepairStates = () => unwrap(api.get("/repairs/states"));

// =============== PURCHASES ===============
export const listPurchases = (params) => unwrap(api.get("/purchases", { params }));
export const createPurchase = (payload) => unwrap(api.post("/purchases", payload));

export async function decidePurchase(id, bodyOrStatus, reasonMaybe) {
  if (bodyOrStatus && typeof bodyOrStatus === "object") {
    const body = {
      approve: !!bodyOrStatus.approve,
      reason: bodyOrStatus.reason ?? "",
    };
    return unwrap(api.post(`/purchases/${id}/approve`, body));
  }
  const approve = String(bodyOrStatus).toUpperCase() === "APPROVED";
  return unwrap(api.post(`/purchases/${id}/approve`, { approve, reason: reasonMaybe ?? "" }));
}

export const getPendingPurchases = () => unwrap(api.get("/purchases", { params: { status: "PENDING" } }));
export const getPendingPurchasesCount = () =>
  api.get("/purchases/count", { params: { status: "PENDING" } })
     .then(r => r?.data?.count ?? 0);

// =============== REPORTS / DASHBOARD ===============
export const getReportsOverview = async () => {
  try {
    return await unwrap(api.get("/reports/overview"));
  } catch {
    const pendingPurchases = await getPendingPurchasesCount().catch(() => 0);
    return {
      purchases: { pending: pendingPurchases, approved: 0, rejected: 0 },
      repairs: { open: 0, closed: 0 },
      inventory: { total: 0 },
      parts: { total: 0 },
      _fallback: true
    };
  }
};

export default api;
