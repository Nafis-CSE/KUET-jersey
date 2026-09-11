import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import { getToken } from "./api.js";

function RequireAdmin({ children }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith("/admin");

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="mark">2K24</span>
          <span>
            <strong>KUET CSE</strong>
            <em>Batch Jersey Collection</em>
          </span>
        </Link>
        {!isAdmin ? (
          <Link className="ghost" to="/admin">
            Admin
          </Link>
        ) : (
          <Link className="ghost" to="/">
            Public site
          </Link>
        )}
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
