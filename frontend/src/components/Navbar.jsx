import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar({ onMenuClick, sidebarOpen }) {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-brand">Healthcare App</div>
      </div>
      {!sidebarOpen && <div className="navbar-links">
        <Link to="/dashboard">Home</Link>
        <Link to="/chat">Chat</Link>
        <Link to="/medicine">Medicine</Link>
        <Link to="/look">Book</Link>
        <Link to="/profile">Profile</Link>
      </div>}
      <button className="menu-btn" onClick={onMenuClick} aria-label="Toggle navigation">
        ☰
      </button>
    </nav>
  );
}

export default Navbar;