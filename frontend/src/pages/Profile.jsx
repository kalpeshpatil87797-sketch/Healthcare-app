import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { applyThemePreference, getThemePreference } from "../utils/theme";
import "./auth.css";
import "./ProviderPages.css";

const API_BASE = "http://localhost:8001";

function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaveDoctorError, setLeaveDoctorError] = useState("");
  const [isLeavingDoctor, setIsLeavingDoctor] = useState(false);
  const [theme, setTheme] = useState(getThemePreference);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(res.data);
      } catch (err) {
        setError(err.response?.data?.error ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  function formatUserType(role) {
    const labels = {
      patient: "Patient",
      doctor: "Doctor",
      admin: "Admin",
      root_owner: "Root Owner",
      super_admin: "Super Admin",
    };
    return labels[role] ?? role ?? "Unknown";
  }

  const hasActiveDoctorProfile = Boolean(
    profile?.role === "doctor" &&
    profile?.accountStatus !== "suspended" &&
    profile?.doctorApprovalStatus === "approved" &&
    profile?.doctorProfileActive !== false
  );

  async function handleLeaveDoctorRole() {
    if (!hasActiveDoctorProfile || isLeavingDoctor) return;
    const confirmed = window.confirm(
      "Stop being a doctor? You will lose doctor privileges and continue using the app as a patient. Your doctor profile, appointments, messages, and patient data will be preserved. Any existing appointments will not be canceled automatically."
    );
    if (!confirmed) return;

    setIsLeavingDoctor(true);
    setLeaveDoctorError("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/user/doctor/leave`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.setItem("token", response.data.token);
      setProfile((current) => ({
        ...current,
        role: "patient",
        doctorProfileActive: false,
      }));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setLeaveDoctorError(
        err.response?.data?.error ?? "Could not remove doctor privileges. Please try again."
      );
    } finally {
      setIsLeavingDoctor(false);
    }
  }

  function handleThemeChange(nextTheme) {
    setTheme(applyThemePreference(nextTheme));
  }

  return (
    <Layout>
      <div className="provider-page profile-page">
        <header className="provider-page-heading">
          <div>
            <span className="provider-eyebrow">ACCOUNT</span>
            <h1>Your profile</h1>
            <p>Review your personal information and account type.</p>
          </div>
        </header>
        {loading && <p className="provider-status" role="status">Loading profile...</p>}
        {!loading && error && <div className="provider-error" role="alert">{error}</div>}
        {!loading && !error && profile && (
          <section className="profile-card" aria-label="Profile details">
            <div className="profile-identity">
              <span className="profile-avatar" aria-hidden="true">{profile.name?.trim().charAt(0).toUpperCase()}</span>
              <div>
                <h2>{profile.name}</h2>
                <span className="profile-role">
                  {formatUserType(hasActiveDoctorProfile ? "doctor" : "patient")}
                </span>
              </div>
            </div>
            <dl className="profile-details">
              <div><dt>Age</dt><dd>{profile.age}</dd></div>
              <div><dt>Email</dt><dd>{profile.email}</dd></div>
              <div><dt>Phone number</dt><dd>{profile.phone}</dd></div>
              {profile.role === "doctor" && profile.speciality && (
                <div><dt>Specialty</dt><dd>{profile.speciality}</dd></div>
              )}
            </dl>
          </section>
        )}
        {!loading && !error && hasActiveDoctorProfile ? (
          <section className="profile-appearance" aria-labelledby="doctor-access-title">
            <div>
              <span className="provider-eyebrow">DOCTOR ACCESS</span>
              <h2 id="doctor-access-title">Change account type</h2>
              <p>
                Stop using this account as a doctor. Your account will remain active
                and continue as a patient.
              </p>
              {leaveDoctorError ? (
                <p className="provider-error" role="alert">{leaveDoctorError}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="provider-primary-button"
              onClick={handleLeaveDoctorRole}
              disabled={isLeavingDoctor}
            >
              {isLeavingDoctor ? "Updating…" : "Not a Doctor Anymore"}
            </button>
          </section>
        ) : null}
        <section className="profile-appearance" aria-labelledby="appearance-title">
          <div>
            <span className="provider-eyebrow">DISPLAY</span>
            <h2 id="appearance-title">Appearance</h2>
            <p>Choose the theme that feels comfortable to use.</p>
          </div>
          <div className="theme-segment" role="group" aria-label="Color theme">
            <button
              type="button"
              className={theme === "light" ? "theme-option theme-option-active" : "theme-option"}
              aria-pressed={theme === "light"}
              onClick={() => handleThemeChange("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === "dark" ? "theme-option theme-option-active" : "theme-option"}
              aria-pressed={theme === "dark"}
              onClick={() => handleThemeChange("dark")}
            >
              Dark
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default Profile;
