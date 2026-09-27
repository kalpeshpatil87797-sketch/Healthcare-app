import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Chat from "./pages/chat";
import Look from "./pages/Look";
import Medicine from "./pages/Medicine";
import ImDoctor from "./pages/ImDoctor";
import NearbyDoctors from "./pages/NearbyDoctors";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

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
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/look" element={<ProtectedRoute><Look /></ProtectedRoute>} />
        <Route path="/medicine" element={<ProtectedRoute><Medicine /></ProtectedRoute>} />
        <Route path="/im-doctor" element={<ProtectedRoute><ImDoctor /></ProtectedRoute>} />
        <Route path="/nearby-doctors" element={<ProtectedRoute><NearbyDoctors /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;