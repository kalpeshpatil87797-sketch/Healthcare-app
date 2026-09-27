import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import "./auth.css";

const API_BASE = "http://localhost:8001";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    return role === "doctor" ? "Doctor" : "Patient";
  }

  return (
    <Layout>
      <div style={{ padding: "40px 20px", maxWidth: "560px", margin: "0 auto" }}>
        <h1>Profile</h1>
        {loading && <p style={{ color: "#374151" }}>Loading profile...</p>}
        {!loading && error && <div className="error-box">{error}</div>}
        {!loading && !error && profile && (
          <div
            style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", marginTop: "16px" }}
          >
            <p style={{ margin: "8px 0", fontSize: "15px" }}><strong>Name:</strong> {profile.name}</p>
            <p style={{ margin: "8px 0", fontSize: "15px" }}><strong>Age:</strong> {profile.age}</p>
            <p style={{ margin: "8px 0", fontSize: "15px" }}><strong>Email:</strong> {profile.email}</p>
            <p style={{ margin: "8px 0", fontSize: "15px" }}><strong>Phone Number:</strong> {profile.phone}</p>
            <p style={{ margin: "8px 0", fontSize: "15px" }}><strong>User Type:</strong> {formatUserType(profile.role)}</p>
            {profile.role === "doctor" && profile.speciality && (
              <p style={{ margin: "8px 0", fontSize: "15px" }}><strong>Speciality:</strong> {profile.speciality}</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Profile;
