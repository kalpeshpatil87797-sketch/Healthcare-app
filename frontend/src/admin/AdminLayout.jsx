import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { clearSession } from "./adminApi";
import AdminSidebar from "./components/AdminSidebar";
import AdminTopbar from "./components/AdminTopbar";
import "./AdminLayout.css";
import "./AdminPages.css";

const MOBILE_QUERY = "(max-width: 1023px)";

export default function AdminLayout() {
  const outletContext = useOutletContext();
  const adminUser = outletContext?.adminUser ?? null;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const navigate = useNavigate();

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);

    if (
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_QUERY).matches
    ) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }, []);

  const handleNavigate = useCallback(() => {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("admin-main")?.focus();
    });
  }, []);

  const handleSignOut = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    document.body.classList.toggle("admin-nav-open", sidebarOpen);
    return () => document.body.classList.remove("admin-nav-open");
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") closeSidebar();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  return (
    <div className={`admin-shell${sidebarOpen ? " is-nav-open" : ""}`}>
      <a className="admin-skip-link" href="#admin-main">
        Skip to main content
      </a>

      <AdminSidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        onNavigate={handleNavigate}
        adminUser={adminUser}
        onSignOut={handleSignOut}
      />

      <div className="admin-shell-main">
        <AdminTopbar
          onMenuClick={() => setSidebarOpen(true)}
          menuExpanded={sidebarOpen}
          menuButtonRef={menuButtonRef}
          adminUser={adminUser}
          onSignOut={handleSignOut}
        />

        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <Outlet context={{ adminUser }} />
        </main>
      </div>
    </div>
  );
}
