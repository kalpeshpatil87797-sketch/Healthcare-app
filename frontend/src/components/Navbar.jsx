import { NavLink, useNavigate } from "react-router-dom";
import "./Navbar.css";

const PATIENT_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/nearby-doctors", label: "Find Doctor", icon: "⌖" },
  { to: "/chat", label: "AI Chat", icon: "🩺" },
  { to: "/medicine", label: "Medicines", icon: "💊" },
  { to: "/look", label: "Health Library", icon: "📚" },
];

const DOCTOR_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/doctor/appointments", label: "Set Appointment", icon: "📅" },
  { to: "/chat", label: "Patients", icon: "💬" },
  { to: "/medicine", label: "Medicines", icon: "💊" },
];

const ADMIN_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/admin", label: "Admin Dashboard", icon: "⚙" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

const ACCOUNT_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

const ROOT_OWNER_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/admin", label: "Root Owner Dashboard", icon: "⚙" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

function Navbar({ onMenuClick, sidebarOpen, role, userName }) {
  const navigate = useNavigate();
  const links =
    role === "doctor"
      ? DOCTOR_LINKS
      : role === "patient"
        ? PATIENT_LINKS
        : role === "root_owner"
          ? ROOT_OWNER_LINKS
            : role === "admin"
              ? ADMIN_LINKS
            : ACCOUNT_LINKS;
  const initial = (userName || "").trim().charAt(0).toUpperCase();

  function goToProfile() {
    navigate("/profile");
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="menu-btn" onClick={onMenuClick} aria-label="Toggle navigation">
          ☰
        </button>
        <div className="navbar-brand">
          <span className="navbar-brand-mark" aria-hidden="true">+</span>
          <span>Healthcare App</span>
        </div>
      </div>
      {!sidebarOpen && (
        <div className="navbar-links">
          {links.map((l) => (
            <NavLink
              key={l.to + l.label}
              to={l.to}
              className={({ isActive }) => `navbar-link${isActive ? " navbar-link-active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
      <div className="navbar-right">
        <button
          type="button"
          className="avatar-btn"
          onClick={goToProfile}
          aria-label="Open profile"
          title={userName || "Profile"}
        >
          {initial || "U"}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
