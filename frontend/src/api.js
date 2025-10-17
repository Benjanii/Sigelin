import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
console.log("API base URL =>", BASE_URL); // 👈 debe mostrar http://localhost:8000 en la consola del navegador

const api = axios.create({ baseURL: BASE_URL });

export const health   = () => api.get("/health");
export const getItems = () => api.get("/inventory/");
export const getItem  = (code) => api.get(`/inventory/${code}`);
export const addItem  = (item) => api.post("/inventory/", item);

export default api;
