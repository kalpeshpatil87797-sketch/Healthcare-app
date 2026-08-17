import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./auth.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await axios.post("http://localhost:8001/user/forgot-password", { email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error ?? "Something went wrong");
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: "380px" }}>
        <h1>Forgot Password</h1>
        <p className="subtitle">Enter your email to receive a reset link</p>

        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="text" required name="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

          <button type="submit">Send Reset Link</button>
        </form>

        <p className="footer-link">
          Remembered your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;