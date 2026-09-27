import { useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import "./ProviderPages.css";

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
      <div className="provider-page">
        <header className="provider-page-heading">
          <div>
            <span className="provider-eyebrow">LOCAL CARE</span>
            <h1>Nearby doctors</h1>
            <p>Find available doctors within 10 km of your current location.</p>
          </div>
        <button
          className="provider-primary-button"
          onClick={handleFindNearby}
          disabled={loading}
        >
          {loading ? "Searching..." : "Find Nearby Doctors"}
        </button>
        </header>

        {message && <p className="provider-status" role="status">{message}</p>}

        {searched && !loading && doctors.length > 0 && (
          <div className="provider-results">
            {doctors.map((d) => (
              <article key={d._id} className="provider-result">
                <div className="provider-result-mark" aria-hidden="true">+</div>
                <div className="provider-result-details">
                  <h2>{d.name}</h2>
                  <p className="provider-specialty">{d.specialist}</p>
                  <p className="provider-meta">{d.clinicName}</p>
                  <p className="provider-meta">{d.clinicLocation}</p>
                  {d.degree && <p className="provider-meta">{d.degree}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default NearbyDoctors;
