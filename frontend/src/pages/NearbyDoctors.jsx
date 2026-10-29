import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import AppointmentModal from "../components/AppointmentModal";
import "./ProviderPages.css";

const API_BASE = "http://localhost:8001";

function authConfig() {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
}

function NearbyDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [specialty, setSpecialty] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [appointmentError, setAppointmentError] = useState("");
  const [searched, setSearched] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [connectingId, setConnectingId] = useState("");

  async function connectAndBook(doctor) {
    setConnectingId(String(doctor._id));
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/doctor/connect`,
        { doctorId: doctor._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookingDoctor(doctor);
    } catch (err) {
      setMessage(err.response?.data?.error ?? "Could not connect with this doctor.");
    } finally {
      setConnectingId("");
    }
  }

  async function loadAppointments() {
    setLoadingAppointments(true);
    setAppointmentError("");
    try {
      const response = await axios.get(`${API_BASE}/appointment/mine`, authConfig());
      setAppointments(response.data?.appointments ?? []);
    } catch (err) {
      setAppointmentError(err.response?.data?.error ?? "Failed to load your appointments.");
    } finally {
      setLoadingAppointments(false);
    }
  }

  async function searchDoctors(overrides = {}) {
    const selectedLocation = overrides.location ?? location;
    const selectedCoordinates =
      Object.prototype.hasOwnProperty.call(overrides, "coordinates")
        ? overrides.coordinates
        : coordinates;
    setLoadingDoctors(true);
    setError("");
    setSearched(true);
    try {
      const params = {};
      if (specialty) params.specialty = specialty;
      if (selectedLocation.trim()) {
        params.location = selectedLocation.trim();
      } else if (selectedCoordinates) {
        params.latitude = selectedCoordinates.latitude;
        params.longitude = selectedCoordinates.longitude;
        params.radiusKm = 25;
      }
      const endpoint =
        selectedLocation.trim() || !selectedCoordinates
          ? `${API_BASE}/doctor/search`
          : `${API_BASE}/doctor/nearby`;
      const response = await axios.get(endpoint, { ...authConfig(), params });
      setDoctors(response.data?.doctors ?? []);
    } catch (err) {
      setDoctors([]);
      setError(err.response?.data?.error ?? "Failed to search doctors. Please try again.");
    } finally {
      setLoadingDoctors(false);
    }
  }

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/doctor/search`, authConfig())
      .then((response) => {
        if (active) {
          setDoctors(response.data?.doctors ?? []);
          setSearched(true);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.error ?? "Failed to load doctors.");
          setSearched(true);
        }
      })
      .finally(() => {
        if (active) setLoadingDoctors(false);
      });
    axios.get(`${API_BASE}/appointment/mine`, authConfig())
      .then((response) => {
        if (active) setAppointments(response.data?.appointments ?? []);
      })
      .catch((err) => {
        if (active) {
          setAppointmentError(err.response?.data?.error ?? "Failed to load your appointments.");
        }
      })
      .finally(() => {
        if (active) setLoadingAppointments(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleUseLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser. Search by clinic location instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const nextCoordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setCoordinates(nextCoordinates);
        setLocation("");
        await searchDoctors({ coordinates: nextCoordinates, location: "" });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("Location permission was denied or unavailable. Search by clinic location instead.");
      },
      { timeout: 10000 }
    );
  }

  async function handleStartBooking(doctor) {
    setConnectingDoctorId(String(doctor._id));
    setError("");
    try {
      await axios.post(
        `${API_BASE}/doctor/connect`,
        { doctorId: doctor._id },
        authConfig()
      );
      setBookingDoctor(doctor);
    } catch (err) {
      setError(err.response?.data?.error ?? "Could not connect with this doctor.");
    } finally {
      setConnectingDoctorId("");
    }
  }

  async function updatePatientAppointment(id, action) {
    setActingAppointmentId(String(id));
    setAppointmentError("");
    try {
      await axios.patch(
        `${API_BASE}/appointment/${id}/${action}`,
        {},
        authConfig()
      );
      await loadAppointments();
    } catch (err) {
      setAppointmentError(err.response?.data?.error ?? "Could not update this appointment.");
    } finally {
      setActingAppointmentId("");
    }
  }

  function doctorForAppointment(appointment) {
    return {
      _id: appointment.doctorId,
      name: appointment.doctorName,
      specialist: appointment.specialist,
      clinicName: appointment.clinicName,
    };
  }

  return (
    <Layout>
      <div className="provider-page appointment-page">
        <header className="provider-page-heading">
          <div>
            <span className="provider-eyebrow">SMART APPOINTMENTS</span>
            <h1>Find a doctor & book</h1>
            <p>Search approved, available doctors and choose an open appointment time.</p>
          </div>
        </header>

        <form
          className="appointment-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setCoordinates(null);
            searchDoctors({ coordinates: null });
          }}
        >
          <label>
            Specialty
            <select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
              <option value="">All specialties</option>
              {SPECIALTIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            City, area, or clinic location
            <input
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setCoordinates(null);
              }}
              placeholder="Search clinic location"
            />
          </label>
          <div className="appointment-filter-actions">
            <button type="submit" className="provider-primary-button" disabled={loadingDoctors}>
              {loadingDoctors ? "Searching..." : "Search doctors"}
            </button>
            <button
              type="button"
              className="appointment-secondary-button"
              onClick={handleUseLocation}
              disabled={locating || loadingDoctors}
            >
              {locating ? "Finding location..." : "Use my location"}
            </button>
          </div>
        </form>

        {error && <p className="provider-error" role="alert">{error}</p>}
        {loadingDoctors ? (
          <p className="provider-status" role="status">Loading available doctors...</p>
        ) : doctors.length === 0 ? (
          <div className="appointment-empty">
            <h2>{searched ? "No available doctors found" : "Search for a doctor"}</h2>
            <p>Try another specialty or location, or search nearby using your current location.</p>
          </div>
        ) : (
          <div className="provider-results">
            {doctors.map((doctor) => (
              <article key={doctor._id} className="provider-result appointment-doctor-card">
                <div className="provider-result-mark" aria-hidden="true">+</div>
                <div className="provider-result-details">
                  <h2>{d.name}</h2>
                  <p className="provider-specialty">{d.specialist}</p>
                  <p className="provider-meta">{d.clinicName}</p>
                  <p className="provider-meta">{d.clinicLocation}</p>
                  {d.degree && <p className="provider-meta">{d.degree}</p>}
                  <button
                    type="button"
                    className="provider-primary-button"
                    onClick={() => connectAndBook(d)}
                    disabled={connectingId === String(d._id)}
                  >
                    {connectingId === String(d._id) ? "Connecting…" : "Connect and book"}
                  </button>
                </div>
                <button
                  type="button"
                  className="provider-primary-button appointment-book-button"
                  onClick={() => handleStartBooking(doctor)}
                  disabled={Boolean(connectingDoctorId)}
                >
                  {connectingDoctorId === String(doctor._id) ? "Preparing..." : "Book appointment"}
                </button>
              </article>
            ))}
          </div>
        )}

        <section className="appointment-list-section" aria-labelledby="patient-appointments-title">
          <div className="appointment-list-heading">
            <div>
              <span className="provider-eyebrow">YOUR BOOKINGS</span>
              <h2 id="patient-appointments-title">My appointments</h2>
            </div>
            <button
              type="button"
              className="appointment-secondary-button"
              onClick={loadAppointments}
              disabled={loadingAppointments}
            >
              {loadingAppointments ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {appointmentError && <p className="provider-error" role="alert">{appointmentError}</p>}
          {loadingAppointments ? (
            <p className="provider-status" role="status">Loading your appointments...</p>
          ) : appointments.length === 0 ? (
            <p className="appointment-empty">You have no appointment requests yet.</p>
          ) : (
            <div className="appointment-records">
              {appointments.map((appointment) => {
                const busy = actingAppointmentId === String(appointment._id);
                return (
                  <article className="appointment-record" key={appointment._id}>
                    <div className="appointment-record-main">
                      <h3>{appointment.doctorName || "Doctor"}</h3>
                      <p>{appointment.specialist}{appointment.clinicName ? ` · ${appointment.clinicName}` : ""}</p>
                      <p>{formatApptDate(appointment.appointmentDate)} at {appointment.appointmentTime}</p>
                      {appointment.status === "alternate_requested" && appointment.alternateDate && (
                        <p className="appointment-alternate">
                          Suggested: {formatApptDate(appointment.alternateDate)} at {appointment.alternateTime}
                        </p>
                      )}
                    </div>
                    <span className={`appointment-status appointment-status-${appointment.status}`}>
                      {appointment.status.replaceAll("_", " ")}
                    </span>
                    <div className="appointment-record-actions">
                      {appointment.status === "pending" && (
                        <button
                          type="button"
                          className="appointment-secondary-button"
                          disabled={busy}
                          onClick={() => updatePatientAppointment(appointment._id, "cancel")}
                        >
                          Cancel request
                        </button>
                      )}
                      {appointment.status === "alternate_requested" && (
                        <>
                          <button
                            type="button"
                            className="provider-primary-button"
                            disabled={busy}
                            onClick={() => updatePatientAppointment(appointment._id, "accept-alternate")}
                          >
                            Accept suggested time
                          </button>
                          <button
                            type="button"
                            className="appointment-secondary-button"
                            disabled={busy}
                            onClick={() => setBookingDoctor(doctorForAppointment(appointment))}
                          >
                            Choose another time
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {bookingDoctor ? (
        <AppointmentModal
          doctor={bookingDoctor}
          onClose={() => setBookingDoctor(null)}
        />
      ) : null}
    </Layout>
  );
}

export default NearbyDoctors;
