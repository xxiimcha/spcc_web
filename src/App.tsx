import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SystemSettingsProvider } from "./contexts/SystemSettingsContext";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Professors = lazy(() => import("./pages/Professors"));
const Subjects = lazy(() => import("./pages/Subjects"));
const Scheduling = lazy(() => import("./pages/Scheduling"));
const Login = lazy(() => import("./pages/Login"));
const Admin = lazy(() => import("./pages/Admin"));
const Settings = lazy(() => import("./pages/Settings"));
const Sections = lazy(() => import("./pages/Sections"));
const Rooms = lazy(() => import("./pages/Rooms"));
// 👇 NEW: the create-schedule page
const ScheduleNew = lazy(() => import("./pages/ScheduleNew"));

// Protected Route Component
const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/pages/login" />;
  }

  if (!allowedRoles.includes(user?.role || "")) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

// Main App Routes Component
const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <Routes>
        <Route path="/pages/login" element={<Login />} />

        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            isAuthenticated && user?.role === "admin" ? (
              <AdminLayout>
                <Routes>
                  <Route index element={<Admin />} />
                  <Route path="settings" element={<Settings />} />
                </Routes>
              </AdminLayout>
            ) : (
              <Navigate to="/pages/login" />
            )
          }
        />

        {/* School Head Routes - Root level */}
        <Route
          path="/*"
          element={
            isAuthenticated && user?.role === "school_head" ? (
              <AppLayout>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="professors" element={<Professors />} />
                  <Route path="rooms" element={<Rooms />} />
                  <Route path="subjects" element={<Subjects />} />
                  <Route path="sections" element={<Sections />} />
                  <Route path="scheduling" element={<Scheduling />} />
                  <Route path="scheduling/new" element={<ScheduleNew />} />
                </Routes>
              </AppLayout>
            ) : isAuthenticated && user?.role === "admin" ? (
              <Navigate to="/admin" />
            ) : (
              <Navigate to="/pages/login" />
            )
          }
        />

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <SystemSettingsProvider>
        <AppRoutes />
      </SystemSettingsProvider>
    </AuthProvider>
  );
}

export default App;
