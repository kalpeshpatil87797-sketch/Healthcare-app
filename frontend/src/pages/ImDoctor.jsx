import { useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { reverseGeocode } from "../utils/location";
import { SPECIALTIES } from "../utils/specialties";
import "./auth.css";

function ImDoctor() {
  const [formData, setFormData] = useState({
    name: "",
    clinicName: "",
    degree: "",
    specialistType: "",
    clinicLocation: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [location, setLocation] = useState({ latitude: "", longitude: "" });
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [customSpecialty, setCustomSpecialty] = useState("");

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSuccess("");
  }

  function handleUseLocation() {
    setLocationMsg("");
    if (!("geolocation" in navigator)) {
      setLocationMsg("Geolocation is not supported by this browser. Please enter the clinic location manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ latitude: String(lat), longitude: String(lng) });
        const address = await reverseGeocode(lat, lng);
        setFormData((prev) => ({ ...prev, clinicLocation: address }));
        setLocationMsg("Current location detected and clinic location filled. You can edit it if needed.");
        setLocating(false);
      },
      () => {
        setLocationMsg("Location permission denied or unavailable. Please enter the clinic location manually.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  function handleSpecialtyChange(e) {
    setFormData({ ...formData, specialistType: e.target.value });
    setCustomSpecialty("");
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const { name, clinicName, degree, specialistType, clinicLocation } = formData;
    const resolvedSpecialty =
      specialistType === "Other" ? customSpecialty.trim() : specialistType;
    if (!name.trim() || !clinicName.trim() || !degree.trim() || !resolvedSpecialty || !clinicLocation.trim()) {
      setError("All fields are required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const payload = {
        name: name.trim(),
        clinicName: clinicName.trim(),
        degree: degree.trim(),
        specialistType: resolvedSpecialty,
        clinicLocation: clinicLocation.trim(),
        isAvailable,
      };
      if (location.latitude !== "" && location.longitude !== "") {
        payload.latitude = Number(location.latitude);
        payload.longitude = Number(location.longitude);
      }
      await axios.post("http://localhost:8001/doctor/register", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess("Doctor details submitted successfully");
      setFormData({ name: "", clinicName: "", degree: "", specialistType: "", clinicLocation: "" });
      setCustomSpecialty("");
      setLocation({ latitude: "", longitude: "" });
      setLocationMsg("");
    } catch (err) {
      setError(err.response?.data?.error ?? "Failed to submit doctor details");
    }
  }

  return (
    <Layout>
      <div className="auth-wrapper" style={{ minHeight: "auto", padding: "40px 20px", background: "transparent" }}>
        <div className="auth-card" style={{ maxWidth: "480px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          <h1>Doctor Registration</h1>
          <p className="subtitle">Fill in your professional details</p>

          {error && <div className="error-box">{error}</div>}
          {success && <div className="success-box">{success}</div>}

          <form onSubmit={handleSubmit}>
            <label>Name</label>
            <input type="text" required name="name" placeholder="Dr. John Doe" value={formData.name} onChange={handleChange} />

            <label>Clinic Name</label>
            <input type="text" required name="clinicName" placeholder="City Care Clinic" value={formData.clinicName} onChange={handleChange} />

            <label>Degree</label>
            <input type="text" required name="degree" placeholder="MBBS, MD" value={formData.degree} onChange={handleChange} />

            <label>Type of Doctor / Specialist</label>
            <select required name="specialistType" value={formData.specialistType} onChange={handleSpecialtyChange}>
              <option value="">Select specialty</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="Other">Other</option>
            </select>
            {formData.specialistType === "Other" && (
              <>
                <label>Please specify your speciality</label>
                <input
                  type="text"
                  required
                  name="customSpecialty"
                  placeholder="e.g. Ayurvedic Doctor"
                  value={customSpecialty}
                  onChange={(e) => { setCustomSpecialty(e.target.value); setSuccess(""); }}
                />
              </>
            )}

            <label>Clinic Location</label>
            <div className="location-field">
              <input type="text" required name="clinicLocation" placeholder="City, Area" value={formData.clinicLocation} onChange={handleChange} />
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
            {locationMsg && <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "8px" }}>{locationMsg}</p>}

            <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                style={{ width: "auto" }}
              />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Available for appointments</span>
            </div>

            <button type="submit">Submit</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export default ImDoctor;