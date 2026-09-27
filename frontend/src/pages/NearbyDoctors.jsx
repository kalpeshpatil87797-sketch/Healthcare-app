import { useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

const API_BASE = "http://localhost:8001";

function NearbyDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Click the button to find doctors near you.");
  const [searched, setSearched] = useState(false);

  function handleFindNearby() {
    setMessage("");
    setSearched(false);
    if (!("geolocation" in navigator)) {
      setMessage("Geolocation is not supported by this browser.");
      return;
    }
    setLoading(true);
    setMessage("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setMessage("Searching nearby doctors...");
          const token = localStorage.getItem("token");
          const res = await axios.get(`${API_BASE}/doctor/nearby`, {
            params: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              radiusKm: 10,
            },
            headers: { Authorization: `Bearer ${token}` },
          });
          setDoctors(res.data.doctors ?? []);
          setSearched(true);
          if ((res.data.doctors ?? []).length === 0) {
            setMessage("No nearby doctors found within 10 km. Try again later.");
          } else {
            setMessage("");
          }
        } catch (err) {
          setSearched(true);
          setMessage(err.response?.data?.error ?? "Failed to fetch nearby doctors.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setSearched(false);
        setMessage("Location permission denied. Please allow location access to find nearby doctors.");
      },
      { timeout: 10000 }
    );
  }

  return (
    <Layout>
      <div style={{ padding: "40px 20px", maxWidth: "720px", margin: "0 auto" }}>
        <h1>Nearby Doctors</h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>Find available doctors within 10 km of your current location.</p>

        <button
          onClick={handleFindNearby}
          disabled={loading}
          style={{ maxWidth: "280px", background: loading ? "#9ca3af" : "#6a5af9" }}
        >
          {loading ? "Searching..." : "Find Nearby Doctors"}
        </button>

        {message && <p style={{ marginTop: "16px", color: "#374151" }}>{message}</p>}

        {searched && !loading && doctors.length > 0 && (
          <div style={{ marginTop: "20px", display: "grid", gap: "12px" }}>
            {doctors.map((d) => (
              <div
                key={d._id}
                style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#fff" }}
              >
                <h3 style={{ margin: "0 0 4px" }}>{d.name}</h3>
                <p style={{ margin: 0, color: "#6a5af9", fontWeight: 600, fontSize: "14px" }}>{d.specialist}</p>
                <p style={{ margin: "8px 0 0", fontSize: "14px" }}>🏥 {d.clinicName}</p>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>📍 {d.clinicLocation}</p>
                {d.degree && <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>{d.degree}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default NearbyDoctors;
