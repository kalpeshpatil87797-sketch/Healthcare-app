import { Link, useNavigate } from "react-router-dom";
import "./Sidebar.css";

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
    onClose();
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <nav className="sidebar-links">
          <Link to="/dashboard" onClick={onClose}>Home</Link>
          <Link to="/chat" onClick={onClose}>Chat</Link>
          <Link to="/medicine" onClick={onClose}>Medicine</Link>
          <Link to="/look" onClick={onClose}>Book</Link>
          <Link to="/nearby-doctors" onClick={onClose}>Nearby Doctors</Link>
          <Link to="/im-doctor" onClick={onClose}>I'm Doctor</Link>
          <Link to="/profile" onClick={onClose}>Profile</Link>
        </nav>
        <button className="sidebar-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>
    </>
  );
}

export default Sidebar;