import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import "./Layout.css";

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function toggleSidebar() {
    setSidebarOpen(!sidebarOpen);
  }

  return (
    <div>
      <Navbar onMenuClick={toggleSidebar} sidebarOpen={sidebarOpen} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="layout-content">{children}</main>
    </div>
  );
}

export default Layout;