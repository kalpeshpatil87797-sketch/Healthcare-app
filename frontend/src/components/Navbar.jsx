import { NavLink, useNavigate } from "react-router-dom";
import "./Navbar.css";

const PATIENT_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/chat", label: "AI Chat", icon: "🩺" },
  { to: "/medicine", label: "Medicines", icon: "💊" },
  { to: "/look", label: "Health Library", icon: "📚" },
];

const DOCTOR_LINKS = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/chat", label: "Patients", icon: "💬" },
  { to: "/medicine", label: "Medicines", icon: "💊" },
];

function Navbar({ onMenuClick, sidebarOpen, role, userName }) {
  const navigate = useNavigate();
  const isDoctor = role === "doctor";
  const links = isDoctor ? DOCTOR_LINKS : PATIENT_LINKS;
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
