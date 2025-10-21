// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import InventoryPage from "./pages/Inventory";
import RepairsPage from "./pages/Repairs";      // <-- SOLO una vez
import RepairFormPage from "./pages/RepairForm";
import PartsPage from "./pages/Parts";
import PurchasesPage from "./pages/Purchases";
import ReportsPage from "./pages/Reports";
import UsersPage from "./pages/Users";
import Shell from "./layout/Shell";
import InventoryFormPage from "./pages/InventoryForm";
import InventoryEditPage from "./pages/InventoryEdit";
import PurchaseReportsPage from "./pages/PurchaseReports";
import RepairReportPage from "./pages/RepairReport";
import PartFormPage from "./pages/PartForm";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","TECH","DIRECTOR"]}>
              <Shell><DashboardPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","TECH","DIRECTOR"]}>
              <Shell><InventoryPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/repairs"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","TECH","DIRECTOR"]}>
              <Shell><RepairsPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/repairs/new"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","TECH","DIRECTOR"]}>
              <Shell><RepairFormPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/parts"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","TECH","DIRECTOR"]}>
              <Shell><PartsPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchases"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN"]}>
              <Shell><PurchasesPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","TECH","DIRECTOR"]}>
              <Shell><ReportsPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","DIRECTOR"]}>
              <Shell><UsersPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
        path="/inventory/new"
        element={
            <ProtectedRoute rolesPermitidos={["ADMIN"]}>
              <Shell><InventoryFormPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/edit/:code"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN"]}>
              <Shell><InventoryEditPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase-reports"
          element={
            <ProtectedRoute rolesPermitidos={["DIRECTOR"]}>
              <Shell><PurchaseReportsPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/repairs/report/:id"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN","TECH","DIRECTOR"]}>
              <Shell><RepairReportPage /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/parts/new"
          element={
            <ProtectedRoute rolesPermitidos={["ADMIN"]}>
              <Shell><PartFormPage /></Shell>
            </ProtectedRoute>
          }
        />
        {/* Redirecciones */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
