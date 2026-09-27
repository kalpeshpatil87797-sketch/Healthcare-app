import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./auth.css";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must have at least 8 characters, one uppercase letter, one number, and one special character");
      return;
    }

    try {
      await axios.post(`http://localhost:8001/user/reset-password/${token}`, { password });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.error ?? "Something went wrong");
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: "380px" }}>
        <h1>Reset Password</h1>
        <p className="subtitle">Enter your new password</p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>New Password</label>
          <div className="password-field">
            <input type={showPassword ? "text" : "password"} required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label>Confirm Password</label>
          <div className="password-field">
            <input type={showConfirmPassword ? "text" : "password"} required placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-pressed={showConfirmPassword}>
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button type="submit">Reset Password</button>
        </form>

        <p className="footer-link">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;