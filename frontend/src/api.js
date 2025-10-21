import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const api = axios.create({ baseURL: BASE_URL });

// Adjunta token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Endpoints
export const getReportsOverview = () => api.get("/reports/overview");
export const health    = () => api.get("/health");
export const getItems  = () => api.get("/inventory/");
export const addItem   = (item) => api.post("/inventory/", item);
export const login     = (username, password) => api.post("/auth/login", { username, password });
export const me        = () => api.get("/auth/me");
export const createRepair = (payload) => api.post("/repairs/", payload);
export const listRepairs = (params) => api.get("/repairs", { params });
export const getRepair = (id) => api.get(`/repairs/${id}`);
export const updateRepair = (id, payload) => api.patch(`/repairs/${id}`, payload);
export const deleteRepair = (id) => api.delete(`/repairs/${id}`);
export const listPurchases = (params) => api.get("/purchases", { params });
export const createPurchase = (payload) => api.post("/purchases", payload);
export const decidePurchase = (id, decision, reason) =>
  api.patch(`/purchases/${id}/decision`, null, { params: { decision, reason } });
export const updateItem = (code, payload) => api.patch(`/inventory/${code}`, payload);
export const deleteItem = (code) => api.delete(`/inventory/${code}`);
export default api;
