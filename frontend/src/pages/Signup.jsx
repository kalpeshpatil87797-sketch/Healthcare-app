import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { reverseGeocode } from "../utils/location";
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState({ latitude: "", longitude: "" });
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const navigate = useNavigate();

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  function handleUseLocation() {
    setLocationMsg("");
    if (!("geolocation" in navigator)) {
      setLocationMsg("Geolocation is not supported by this browser. Please enter your address manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ latitude: String(lat), longitude: String(lng) });
        const address = await reverseGeocode(lat, lng);
        setFormData((prev) => ({ ...prev, address }));
        setLocationMsg("Current location detected and address filled. You can edit it if needed.");
        setLocating(false);
      },
      () => {
        setLocationMsg("Location permission denied or unavailable. Please enter your address manually.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!formData.address.trim()) {
      setError("Address is required");
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError("Password must have at least 8 characters, one uppercase letter, one number, and one special character");
      return;
    }

    try {
      const payload = { ...formData };
      if (location.latitude !== "" && location.longitude !== "") {
        payload.latitude = Number(location.latitude);
        payload.longitude = Number(location.longitude);
      }
      await axios.post("http://localhost:8001/user/signup", payload);
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
              <div className="location-field">
                <input type="text" required name="address" placeholder="Your address" value={formData.address} onChange={handleChange} />
                <button
                  type="button"
                  className="location-pin-btn"
                  onClick={handleUseLocation}
                  disabled={locating}
                  title={locating ? "Getting location..." : "Use my current location"}
                  aria-label="Use my current location"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </button>
              </div>
              {locationMsg && <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "6px" }}>{locationMsg}</p>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="text" required name="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-field">
                <input type={showPassword ? "text" : "password"} required name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
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