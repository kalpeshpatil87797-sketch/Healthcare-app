import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import "./Home.css";

const API_BASE = "http://localhost:8001";

function Home() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("patient");
  const isDoctor = role === "doctor";

  useEffect(() => {
    async function fetchMe() {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.name) setName(res.data.name);
        if (res.data?.role === "doctor") setRole("doctor");
      } catch {
        // Stay on patient defaults; page remains fully usable.
      }
    }
    fetchMe();
  }, []);

  return (
    <Layout>
      <div className="home-page care-dashboard">
        <section className="care-welcome">
          <div className="care-welcome-copy">
            <span className="care-eyebrow">YOUR CARE HUB</span>
            <h1>{name ? `Welcome back, ${name}` : "Your health, in one place"}</h1>
            <p>Find trusted support, get general health information, and stay connected to care.</p>
            <div className="home-hero-cta">
              <Link to={isDoctor ? "/chat" : "/nearby-doctors"} className="ui-btn ui-btn-primary">
                {isDoctor ? "Open patient chats" : "Find a nearby doctor"}
              </Link>
              <Link to="/chat" className="ui-btn ui-btn-secondary">Ask the health assistant</Link>
            </div>
          </div>
          <aside className="care-note">
            <span className="care-note-mark" aria-hidden="true">+</span>
            <p className="care-note-label">A helpful reminder</p>
            <h2>Small steps count.</h2>
            <p>Use reliable information as a starting point, and speak with a qualified professional about personal medical concerns.</p>
          </aside>
        </section>

        <section className="care-services" aria-labelledby="care-services-title">
          <div className="care-section-heading">
            <div>
              <span className="care-eyebrow">GET STARTED</span>
              <h2 id="care-services-title">What do you need today?</h2>
            </div>
            <span className="care-section-caption">Choose a service to continue</span>
          </div>
          <div className="home-grid">
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
                <Link to="/chat" className="care-service-link">Open patient chats <span aria-hidden="true">→</span></Link>
              </article>
            ) : (
              <article className="ui-card home-card care-service-card">
                <span className="home-card-icon care-icon-doctor" aria-hidden="true">⌖</span>
                <span className="care-service-label">IN YOUR AREA</span>
                <h3>Find a doctor</h3>
                <p>Explore nearby healthcare professionals by specialty.</p>
                <Link to="/nearby-doctors" className="care-service-link">Browse doctors <span aria-hidden="true">→</span></Link>
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
          </div>
        </section>

        <section className="care-safety" aria-label="Health information safety">
          <span className="care-safety-icon" aria-hidden="true">i</span>
          <p><strong>For your safety</strong> This platform provides general health information, not diagnosis or treatment. For urgent or emergency symptoms, seek immediate medical care.</p>
        </section>

        <footer className="home-footer care-footer">
          <span className="home-footer-brand">Healthcare App</span>
          <nav className="home-footer-links" aria-label="Footer navigation">
            <Link to="/chat">Health chat</Link>
            <Link to="/medicine">Medicines</Link>
            <Link to="/nearby-doctors">Nearby doctors</Link>
            <Link to="/profile">Profile</Link>
          </nav>
        </footer>
      </div>
    </Layout>
  );
}

export default Home;
