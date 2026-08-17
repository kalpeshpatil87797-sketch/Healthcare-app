import { Link } from "react-router-dom";
import "./auth.css";

function Landing() {
  return (
    <div className="auth-wrapper">
      <div className="auth-card text-center" style={{ maxWidth: "480px" }}>
        <h1>Healthcare App</h1>
        <p className="subtitle">Manage your health records in one place</p>

        <Link to="/signup">
          <button style={{ marginTop: "10px" }}>Get Started</button>
        </Link>

        <p className="footer-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Landing;