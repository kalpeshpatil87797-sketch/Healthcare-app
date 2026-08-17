import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./auth.css";

function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post("http://localhost:8001/user/login", formData);
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error ?? "Invalid Username Or Password");
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: "380px" }}>
        <h1>Welcome back</h1>
        <p className="subtitle">Login to continue</p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="text" required name="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} />

          <label>Password</label>
          <input type="password" required name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} />

          <button type="submit">Login</button>
        </form>

        <p className="footer-link" style={{ marginTop: "8px" }}>
          <Link to="/forgot-password">Forgot Password?</Link>
        </p>

        <p className="footer-link">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;