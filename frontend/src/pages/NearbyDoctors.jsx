import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import AppointmentModal from "../components/AppointmentModal";
import DoctorMap from "../components/DoctorMap";
import { formatApptDate } from "../utils/appointmentDate";
import { SPECIALTIES } from "../utils/specialties";
import "./ProviderPages.css";

const API_BASE = "http://localhost:8001";

function authConfig() {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
}

function NearbyDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctorName, setDoctorName] = useState("");
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
  const [actingAppointmentId, setActingAppointmentId] = useState("");
  const [doctorView, setDoctorView] = useState("list");
  const doctorsRequestInFlight = useRef(false);
  const appointmentsRequestInFlight = useRef(false);
  const refreshFunctions = useRef({});

  async function connectAndBook(doctor) {
    setConnectingId(String(doctor._id));
    setError("");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/doctor/connect`,
        { doctorId: doctor._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookingDoctor(doctor);
    } catch (err) {
      setError(err.response?.data?.error ?? "Could not connect with this doctor.");
    } finally {
      setConnectingId("");
    }
  }

  async function loadAppointments() {
    if (appointmentsRequestInFlight.current) return;
    appointmentsRequestInFlight.current = true;
    setLoadingAppointments(true);
    setAppointmentError("");
    try {
      const response = await axios.get(`${API_BASE}/appointment/mine`, authConfig());
      setAppointments(response.data?.appointments ?? []);
    } catch (err) {
      setAppointmentError(err.response?.data?.error ?? "Failed to load your appointments.");
    } finally {
      appointmentsRequestInFlight.current = false;
      setLoadingAppointments(false);
    }
  }

  async function searchDoctors(overrides = {}) {
    if (doctorsRequestInFlight.current) return;
    doctorsRequestInFlight.current = true;
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
      if (doctorName.trim()) params.name = doctorName.trim();
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
      setError(err.response?.data?.error ?? "Failed to search doctors. Please try again.");
    } finally {
      doctorsRequestInFlight.current = false;
      setLoadingDoctors(false);
    }
  }

  useEffect(() => {
    refreshFunctions.current = {
      searchDoctors: () => searchDoctors(),
      loadAppointments,
    };
  });

  useEffect(() => {
    let active = true;
    doctorsRequestInFlight.current = true;
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
        doctorsRequestInFlight.current = false;
        if (active) setLoadingDoctors(false);
      });
    appointmentsRequestInFlight.current = true;
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
        appointmentsRequestInFlight.current = false;
        if (active) setLoadingAppointments(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refreshVisiblePage = () => {
      if (document.visibilityState !== "visible") return;
      refreshFunctions.current.searchDoctors();
      refreshFunctions.current.loadAppointments();
    };
    window.addEventListener("focus", refreshVisiblePage);
    document.addEventListener("visibilitychange", refreshVisiblePage);
    return () => {
      window.removeEventListener("focus", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
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
            Doctor name
            <input
              value={doctorName}
              onChange={(event) => setDoctorName(event.target.value)}
              placeholder="Search by doctor name"
            />
          </label>
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
        <div className="doctor-view-toolbar" aria-label="Doctor results view">
          <p>{loadingDoctors ? "Searching doctors…" : `${doctors.length} available doctor${doctors.length === 1 ? "" : "s"}`}</p>
          <div role="group" aria-label="Choose doctor results view">
            <button
              type="button"
              className="appointment-secondary-button"
              onClick={() => searchDoctors()}
              disabled={loadingDoctors}
            >
              {loadingDoctors ? "Refreshing…" : "Refresh doctors"}
            </button>
            <button
              type="button"
              className={doctorView === "list" ? "appointment-secondary-button is-selected" : "appointment-secondary-button"}
              aria-pressed={doctorView === "list"}
              onClick={() => setDoctorView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={doctorView === "map" ? "appointment-secondary-button is-selected" : "appointment-secondary-button"}
              aria-pressed={doctorView === "map"}
              onClick={() => setDoctorView("map")}
            >
              Map
            </button>
          </div>
        </div>
        {doctorView === "map" ? (
          <DoctorMap
            doctors={doctors}
            onBookDoctor={connectAndBook}
            loading={loadingDoctors}
          />
        ) : loadingDoctors ? (
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
                  <h2>{doctor.name}</h2>
                  <p className="provider-specialty">{doctor.specialist}</p>
                  <p className="provider-meta">{doctor.clinicName}</p>
                  <p className="provider-meta">{doctor.clinicLocation}</p>
                  {doctor.degree && <p className="provider-meta">{doctor.degree}</p>}
                  <button
                    type="button"
                    className="provider-primary-button"
                    onClick={() => connectAndBook(doctor)}
                    disabled={connectingId === String(doctor._id)}
                  >
                    {connectingId === String(doctor._id) ? "Connecting…" : "Connect and book"}
                  </button>
                </div>
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
