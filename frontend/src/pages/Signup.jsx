import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./auth.css";

function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    phone: "",
    address: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError("Password must have at least 8 characters, one uppercase letter, one number, and one special character");
      return;
    }

    try {
      await axios.post("http://localhost:8001/user/signup", formData);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.error ?? "Something went wrong");
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: "520px" }}>
        <h1>Create account</h1>
        <p className="subtitle">Sign up to get started</p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input type="text" required name="name" placeholder="Raj Raval" value={formData.name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Age</label>
              <input type="number" required name="age" placeholder="24" min="1" value={formData.age} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" required name="phone" placeholder="9876543210" pattern="[0-9]{10}" value={formData.phone} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" required name="address" placeholder="Your address" value={formData.address} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="text" required name="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" required name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} />
            </div>
          </div>

          <button type="submit">Sign Up</button>
        </form>

        <p className="footer-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;