import { NavLink, useNavigate } from "react-router-dom";
import "./Sidebar.css";

const PATIENT_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/chat", label: "AI Chat", icon: "🩺" },
  { to: "/nearby-doctors", label: "Nearby Doctors", icon: "📍" },
  { to: "/im-doctor", label: "Register as a doctor", icon: "＋" },
  { to: "/medicine", label: "Medicines", icon: "💊" },
  { to: "/look", label: "Health Library", icon: "📚" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

const DOCTOR_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/chat", label: "My Patients", icon: "💬" },
  { to: "/medicine", label: "Medicines", icon: "💊" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

function Sidebar({ isOpen, onClose, role }) {
  const navigate = useNavigate();
  const links = role === "doctor" ? DOCTOR_LINKS : PATIENT_LINKS;

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
    onClose();
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`} aria-hidden={!isOpen}>
        <div className="sidebar-header">
          <span className="sidebar-brand">
            <span className="sidebar-brand-mark" aria-hidden="true">+</span>
            <span>Healthcare App</span>
          </span>
          <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close navigation">
            ✕
          </button>
        </div>
        <nav className="sidebar-links">
          {links.map((l) => (
            <NavLink
              key={l.to + l.label}
              to={l.to}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link-active" : ""}`}
            >
              <span className="sidebar-link-icon" aria-hidden="true">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
            ⏻ Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
