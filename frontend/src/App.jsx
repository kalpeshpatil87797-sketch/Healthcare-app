import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Chat from "./pages/chat";
import Look from "./pages/Look";
import Medicine from "./pages/Medicine";
import ImDoctor from "./pages/ImDoctor";
import NearbyDoctors from "./pages/NearbyDoctors";
import DoctorAppointments from "./pages/DoctorAppointments";
import Profile from "./pages/Profile";
import DoctorVerification from "./pages/DoctorVerification";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./admin/AdminRoute";
import AdminLayout from "./admin/AdminLayout";
import AdminOverview from "./admin/pages/AdminOverview";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminDoctors from "./admin/pages/AdminDoctors";
import AdminAppointments from "./admin/pages/AdminAppointments";

function NotFound() {
  return (
    <main className="auth-wrapper">
      <section className="auth-card" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link to="/">Return to home</Link>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/doctor/verification" element={<ProtectedRoute><DoctorVerification /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/look" element={<ProtectedRoute><Look /></ProtectedRoute>} />
        <Route path="/medicine" element={<ProtectedRoute><Medicine /></ProtectedRoute>} />
        <Route path="/im-doctor" element={<ProtectedRoute><ImDoctor /></ProtectedRoute>} />
        <Route path="/nearby-doctors" element={<ProtectedRoute><NearbyDoctors /></ProtectedRoute>} />
        <Route path="/doctor/appointments" element={<ProtectedRoute><DoctorAppointments /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="doctors" element={<AdminDoctors />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;