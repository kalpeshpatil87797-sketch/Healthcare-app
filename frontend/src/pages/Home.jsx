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
      <div className="home-page">
        {/* HERO */}
        <section className="home-hero">
          <span className="home-badge">🩺 Healthcare Assistance</span>
          <h1>Healthcare Assistance, Wherever You Are</h1>
          {name && <p className="home-greeting">Welcome back, {name}.</p>}
          <p className="home-hero-sub">
            Get basic health guidance, find nearby doctors, connect with healthcare
            professionals, and access useful medicine information from one place.
          </p>
          <div className="home-hero-cta">
            <Link to="/chat" className="home-btn-primary">Start Health Chat</Link>
            {isDoctor ? (
              <Link to="/chat" className="home-btn-secondary">My Patients</Link>
            ) : (
              <Link to="/nearby-doctors" className="home-btn-secondary">Find Nearby Doctors</Link>
            )}
          </div>
        </section>

        {/* QUICK ACCESS */}
        <section className="home-section">
          <h2>Quick Access</h2>
          <p className="home-section-sub">Jump straight to the service you need.</p>
          <div className="home-grid">
            <div className="home-card">
              <span className="home-card-icon" aria-hidden="true">🩺</span>
              <h3>AI Health Assistant</h3>
              <p>Ask about symptoms and get basic health information.</p>
              <Link to="/chat" className="home-card-btn">Start Chat</Link>
            </div>
            <div className="home-card">
              <span className="home-card-icon" aria-hidden="true">📍</span>
              <h3>Find Nearby Doctors</h3>
              <p>Find available doctors based on location.</p>
              <Link to="/nearby-doctors" className="home-card-btn">Find Doctors</Link>
            </div>
            {isDoctor ? (
              <div className="home-card">
                <span className="home-card-icon" aria-hidden="true">💬</span>
                <h3>My Patients</h3>
                <p>Chat with patients connected to you.</p>
                <Link to="/chat" className="home-card-btn">Open Patient Chats</Link>
              </div>
            ) : (
              <div className="home-card">
                <span className="home-card-icon" aria-hidden="true">💬</span>
                <h3>Doctor Chat</h3>
                <p>Connect with a doctor and communicate through chat.</p>
                <Link to="/chat" className="home-card-btn">Chat with Doctor</Link>
              </div>
            )}
            <div className="home-card">
              <span className="home-card-icon" aria-hidden="true">💊</span>
              <h3>Medicines</h3>
              <p>Browse common medicines and medicine information.</p>
              <Link to="/medicine" className="home-card-btn">Explore Medicines</Link>
            </div>
            {!isDoctor && (
              <div className="home-card">
                <span className="home-card-icon" aria-hidden="true">👩‍⚕️</span>
                <h3>Doctor Registration</h3>
                <p>Doctors can register their professional details.</p>
                <Link to="/im-doctor" className="home-card-btn">I&apos;m a Doctor</Link>
              </div>
            )}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="home-section">
          <h2>How It Works</h2>
          <p className="home-section-sub">Three simple steps to get guidance.</p>
          <div className="home-steps">
            <div className="home-step">
              <span className="home-step-num">1</span>
              <h3>Describe Your Symptoms</h3>
              <p>Use the AI health assistant to describe your symptoms.</p>
            </div>
            <div className="home-step">
              <span className="home-step-num">2</span>
              <h3>Find the Right Healthcare Support</h3>
              <p>Find a suitable doctor or healthcare specialist based on your needs.</p>
            </div>
            <div className="home-step">
              <span className="home-step-num">3</span>
              <h3>Connect &amp; Get Guidance</h3>
              <p>Connect with a doctor through our chat system.</p>
            </div>
          </div>
        </section>

        {/* AI HEALTH ASSISTANT */}
        <section className="home-section home-highlight">
          <span className="home-card-icon" aria-hidden="true">🤖</span>
          <h2>Your First Step Towards Better Health Guidance</h2>
          <p className="home-section-sub">
            Our AI-powered health information and guidance assistant helps you understand
            your symptoms better — it does not provide a confirmed diagnosis.
          </p>
          <ul className="home-list">
            <li>Describe your symptoms in simple words</li>
            <li>Get possible health-condition information</li>
            <li>Understand common causes</li>
            <li>Receive basic home-care precautions</li>
            <li>Get guidance on which doctor or specialist to consult</li>
          </ul>
          <Link to="/chat" className="home-btn-primary">Talk to AI Assistant</Link>
        </section>

        {/* DOCTOR CONNECTION */}
        <section className="home-section">
          <h2>Connect With the Right Doctor</h2>
          <p className="home-section-sub">
            Find available doctors nearby, choose a specialist, and connect with a
            healthcare professional through our chat system. Our directory supports
            specialist-based doctor discovery, from General Physicians to Cardiologists,
            Neurologists, Dermatologists, and more.
          </p>
          {isDoctor ? (
            <Link to="/chat" className="home-btn-primary">Open Patient Chats</Link>
          ) : (
            <Link to="/nearby-doctors" className="home-btn-primary">Find a Doctor</Link>
          )}
        </section>

        {/* MEDICINE INFORMATION */}
        <section className="home-section home-highlight">
          <span className="home-card-icon" aria-hidden="true">💊</span>
          <h2>Explore Medicine Information</h2>
          <p className="home-section-sub">
            Browse medicines organized by common health categories and view available
            medicine and product information for educational purposes. This is an
            information directory, not a pharmacy — medicines are not sold here.
          </p>
          <Link to="/medicine" className="home-btn-primary">View Medicines</Link>
        </section>

        {/* RURAL HEALTHCARE FOCUS */}
        <section className="home-section">
          <h2>Designed to Make Healthcare More Accessible</h2>
          <p className="home-section-sub">
            Built especially for users with limited access to healthcare services:
          </p>
          <ul className="home-list home-list-left">
            <li>Basic healthcare guidance in one place</li>
            <li>Easier access to doctors through nearby discovery</li>
            <li>Simple digital communication with healthcare professionals</li>
            <li>Useful medicine information in plain language</li>
            <li>Lightweight pages designed with limited-connectivity situations in mind</li>
          </ul>
        </section>

        {/* SAFETY NOTICE */}
        <section className="home-disclaimer">
          <p>
            This platform provides general health information and communication tools.
            AI-generated information is not a substitute for professional medical diagnosis
            or treatment. For emergencies or serious symptoms, seek immediate medical attention.
          </p>
        </section>

        {/* FOOTER */}
        <footer className="home-footer">
          <div className="home-footer-brand">Healthcare App</div>
          <div className="home-footer-links">
            <Link to="/chat">Health Chat</Link>
            <Link to="/medicine">Medicines</Link>
            <Link to="/nearby-doctors">Nearby Doctors</Link>
            <Link to="/profile">Profile</Link>
          </div>
          <p className="home-footer-note">For educational purposes. Always consult a qualified healthcare professional.</p>
        </footer>
      </div>
    </Layout>
  );
}

export default Home;
