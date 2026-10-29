import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import AppointmentDashboard from "../components/AppointmentDashboard";
import "./Home.css";

const API_BASE = "http://localhost:8001";

function Home() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("unknown");
  const isPatient = role === "patient";
  const isDoctor = role === "doctor";
  const isCareUser = isPatient || isDoctor;
  const isPrivilegedAdmin = role === "root_owner" || role === "super_admin";

  useEffect(() => {
    async function fetchMe() {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.name) setName(res.data.name);
        const status = res.data?.doctorApprovalStatus;
        setRole(
          ["patient", "doctor"].includes(res.data?.role) &&
            status === "approved" &&
            res.data?.doctorProfileActive !== false
            ? "doctor"
            : "patient"
        );
      } catch {
        // Keep privileged and patient features hidden until the role is known.
      }
    }
    fetchMe();
  }, []);

  if (isPrivilegedAdmin) return <Navigate to="/admin" replace />;

  return (
    <Layout>
      <div className="home-page care-dashboard">
        <section className="care-welcome">
          <div className="care-welcome-copy">
            <span className="care-eyebrow">YOUR CARE HUB</span>
            <h1>{name ? `Welcome back, ${name}` : "Your health, in one place"}</h1>
            <p>
              {isDoctor
                ? "Manage your appointment availability and stay connected to patients."
                : isPatient
                  ? "Find trusted support, get general health information, and stay connected to care."
                  : `Your ${role.replaceAll("_", " ")} account is active.`}
            </p>
            {isCareUser && (
              <div className="home-hero-cta">
                <Link to={isDoctor ? "/doctor/appointments" : "/nearby-doctors"} className="ui-btn ui-btn-primary">
                  {isDoctor ? "Set Appointment" : "Find a doctor & book"}
                </Link>
                <Link to="/chat" className="ui-btn ui-btn-secondary">Ask the health assistant</Link>
              </div>
            )}
          </div>
          <aside className="care-note">
            <span className="care-note-mark" aria-hidden="true">+</span>
            <p className="care-note-label">A helpful reminder</p>
            <h2>Small steps count.</h2>
            <p>Use reliable information as a starting point, and speak with a qualified professional about personal medical concerns.</p>
          </aside>
        </section>

        <AppointmentDashboard role={role} />

        <section className="care-services" aria-labelledby="care-services-title">
          <div className="care-section-heading">
            <div>
              <span className="care-eyebrow">GET STARTED</span>
              <h2 id="care-services-title">What do you need today?</h2>
            </div>
            <span className="care-section-caption">Choose a service to continue</span>
          </div>
          {!isCareUser ? (
            <div className="appointment-empty">
              <h2>Account workspace</h2>
              <p>Your current role is <strong>{role.replaceAll("_", " ")}</strong>. Patient and doctor tools are not shown for this account.</p>
              <Link to="/profile" className="care-service-link">View account profile <span aria-hidden="true">→</span></Link>
            </div>
          ) : <div className="home-grid">
            <article className="ui-card home-card care-service-card">
              <span className="home-card-icon care-icon-chat" aria-hidden="true">✳</span>
              <span className="care-service-label">GENERAL GUIDANCE</span>
              <h3>Health assistant</h3>
              <p>Share a concern and explore general health information.</p>
              <Link to="/chat" className="care-service-link">Start a conversation <span aria-hidden="true">→</span></Link>
            </article>
            {isDoctor ? (
              <article className="ui-card home-card care-service-card">
                <span className="home-card-icon care-icon-doctor" aria-hidden="true">↗</span>
                <span className="care-service-label">CARE CONNECTIONS</span>
                <h3>Patient conversations</h3>
                <p>Continue a conversation with your connected patients.</p>
                <Link to="/doctor/appointments" className="care-service-link">Manage appointments <span aria-hidden="true">→</span></Link>
              </article>
            ) : (
              <article className="ui-card home-card care-service-card">
                <span className="home-card-icon care-icon-doctor" aria-hidden="true">⌖</span>
                <span className="care-service-label">IN YOUR AREA</span>
                <h3>Find a doctor & book</h3>
                <p>Search approved doctors, check available appointment slots, and manage your bookings.</p>
                <Link to="/nearby-doctors" className="care-service-link">Find a doctor <span aria-hidden="true">→</span></Link>
              </article>
            )}
            <article className="ui-card home-card care-service-card">
              <span className="home-card-icon care-icon-medicine" aria-hidden="true">＋</span>
              <span className="care-service-label">REFERENCE</span>
              <h3>Medicine information</h3>
              <p>Browse the medicine directory by health category.</p>
              <Link to="/medicine" className="care-service-link">Explore medicines <span aria-hidden="true">→</span></Link>
            </article>
            <article className="ui-card home-card care-service-card">
              <span className="home-card-icon care-icon-medicine" aria-hidden="true">📚</span>
              <span className="care-service-label">REFERENCE</span>
              <h3>Health Library</h3>
              <p>Read trusted health topics, exercises, and wellness guidance.</p>
              <Link to="/look" className="care-service-link">Explore the library <span aria-hidden="true">→</span></Link>
            </article>
            {!isDoctor && (
              <article className="ui-card home-card care-service-card">
                <span className="home-card-icon care-icon-profile" aria-hidden="true">＋</span>
                <span className="care-service-label">JOIN OUR NETWORK</span>
                <h3>Register as a doctor</h3>
                <p>Share your professional details to join the care network.</p>
                <Link to="/im-doctor" className="care-service-link">Start registration <span aria-hidden="true">→</span></Link>
              </article>
            )}
            {isDoctor && (
              <article className="ui-card home-card care-service-card">
                <span className="home-card-icon care-icon-profile" aria-hidden="true">◎</span>
                <span className="care-service-label">YOUR ACCOUNT</span>
                <h3>Professional profile</h3>
                <p>Review your healthcare professional information.</p>
                <Link to="/profile" className="care-service-link">View profile <span aria-hidden="true">→</span></Link>
              </article>
            )}
          </div>}
        </section>

        <section className="care-safety" aria-label="Health information safety">
          <span className="care-safety-icon" aria-hidden="true">i</span>
          <p><strong>For your safety</strong> This platform provides general health information, not diagnosis or treatment. For urgent or emergency symptoms, seek immediate medical care.</p>
        </section>

        <footer className="home-footer care-footer">
          <span className="home-footer-brand">Healthcare App</span>
          <nav className="home-footer-links" aria-label="Footer navigation">
            {isCareUser && <Link to="/chat">Health chat</Link>}
            {isCareUser && <Link to="/medicine">Medicines</Link>}
            {isDoctor ? (
              <Link to="/doctor/appointments">Set Appointment</Link>
            ) : isPatient ? (
              <Link to="/nearby-doctors">Find a doctor</Link>
            ) : null}
            <Link to="/profile">Profile</Link>
          </nav>
        </footer>
      </div>
    </Layout>
  );
}

export default Home;
