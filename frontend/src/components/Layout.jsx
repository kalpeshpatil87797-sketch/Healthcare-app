import { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import "./Layout.css";

const API_BASE = "http://localhost:8001";

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState("patient");
  const [userName, setUserName] = useState("");

  // Same role-detection pattern used across the app (/user/me).
  useEffect(() => {
    async function fetchMe() {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.role === "doctor") setRole("doctor");
        if (res.data?.name) setUserName(res.data.name);
      } catch {
        // Patient defaults keep navigation fully usable.
      }
    }
    fetchMe();
  }, []);

  function toggleSidebar() {
    setSidebarOpen(!sidebarOpen);
  }

  return (
    <div>
      <Navbar
        onMenuClick={toggleSidebar}
        sidebarOpen={sidebarOpen}
        role={role}
        userName={userName}
      />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
      />
      <main className="layout-content">{children}</main>
    </div>
  );
}

export default Layout;
