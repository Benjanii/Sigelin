// frontend/src/App.jsx
import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { getRoleFromToken, getToken } from "./auth";

// Páginas
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import InventoryPage from "./pages/Inventory";
import PartsPage from "./pages/Parts";
import PurchasesPage from "./pages/Purchases";
import RepairsPage from "./pages/Repairs";
import RepairFormPage from "./pages/RepairForm";
import RepairReportPage from "./pages/RepairReport";
import Shell from "./layout/Shell";
import ReportsPage from "./pages/Reports";
import ApprovalsPage from "./pages/Approvals";
import PurchaseForm from "./pages/PurchaseForm.jsx";

// --- ErrorBoundary simple ---
function ErrorBoundary({ children }) {
  try {
    return children;
  } catch (e) {
    console.error("Render error:", e);
    return (
      <div style={{ padding: 24, color: "crimson" }}>
        <h2>Ocurrió un error al renderizar</h2>
        <pre>{String(e)}</pre>
      </div>
    );
  }
}

// --- Ruta protegida ---
function ProtectedRoute({ rolesPermitidos, children }) {
  const token = getToken();
  const role = getRoleFromToken();
  if (!token) return <Navigate to="/login" replace />;
  if (rolesPermitidos && !rolesPermitidos.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH", "DIRECTOR"]}>
              <Shell><DashboardPage /></Shell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH", "DIRECTOR"]}>
              <Shell><InventoryPage /></Shell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/parts"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH", "DIRECTOR"]}>
              <Shell><PartsPage /></Shell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH", "DIRECTOR"]}>
              <Shell><ReportsPage /></Shell>
            </ProtectedRoute>
          }
        />

        {/* Compras solo ADMIN */}
        <Route
          path="/purchases"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN"]}>
              <Shell><PurchasesPage /></Shell>
            </ProtectedRoute>
          }
        />

        {/* Form externo para “Nuevo equipo (inventario)” */}
        <Route
          path="/purchases/new"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN"]}>
              <Shell><PurchaseForm /></Shell>
            </ProtectedRoute>
          }
        />

        {/* Reparaciones */}
        <Route
          path="/repairs"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH", "DIRECTOR"]}>
              <Shell><RepairsPage /></Shell>
            </ProtectedRoute>
          }
        />

        {/* Aprobaciones (DIRECTOR) */}
        <Route
          path="/approvals"
          element={
            <ProtectedRoute rolesPermitidos={["DIRECTOR"]}>
              <Shell><ApprovalsPage /></Shell>
            </ProtectedRoute>
          }
        />

        {/* Nueva/Editar reparación */}
        <Route
          path="/repairs/new"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH"]}>
              <Shell><RepairFormPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/repairs/edit/:id"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH"]}>
              <Shell><RepairFormPage /></Shell>
            </ProtectedRoute>
          }
        />

        {/* Reporte legible */}
        <Route
          path="/repairs/report/:id"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN", "TECH", "DIRECTOR"]}>
              <Shell><RepairReportPage /></Shell>
            </ProtectedRoute>
          }
        />

        {/* Redirect raíz */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 simple */}
        <Route
          path="*"
          element={
            <div style={{ padding: 24 }}>
              <h2>Página no encontrada</h2>
              <a href="/dashboard">Ir al dashboard</a>
            </div>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}
