import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { AvailabilitySettings } from "../components/AppointmentDashboard";
import AlternateTimeModal from "../components/AlternateTimeModal";
import { formatApptDate } from "../utils/appointmentDate";
import "./Home.css";
import "./ProviderPages.css";

const API_BASE = "http://localhost:8001";

function authConfig() {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
}

function todayLocalISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] = useState(false);
  const [availabilityEditorOpen, setAvailabilityEditorOpen] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [actingAppointmentId, setActingAppointmentId] = useState("");
  const [alternateAppointmentId, setAlternateAppointmentId] = useState("");
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  async function loadAppointments() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE}/appointment/doctor`, authConfig());
      setAppointments(response.data?.appointments ?? []);
      setAccessDenied(false);
    } catch (err) {
      setAppointments([]);
      setAccessDenied(err.response?.status === 403);
      setError(
        err.response?.data?.error ??
          "Could not load appointments. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`${API_BASE}/user/me`, authConfig()),
      axios.get(`${API_BASE}/appointment/doctor`, authConfig()),
    ])
      .then(([profile, response]) => {
        if (!active) return;
        if (profile.data?.effectiveRole !== "doctor") {
          setAccessDenied(true);
          setError("Appointment management is available only to approved, active doctors.");
          setAppointments([]);
          return;
        }
        setIsAvailable(profile.data?.doctorAvailability === true);
        setAvailabilityDraft(profile.data?.doctorAvailability === true);
        setAppointments(response.data?.appointments ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setAccessDenied(err.response?.status === 403);
        setError(
          err.response?.data?.error ??
            "Could not load your doctor appointments."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveAvailability(event) {
    event.preventDefault();
    setUpdatingAvailability(true);
    setError("");
    setAvailabilityNotice("");
    try {
      const response = await axios.patch(
        `${API_BASE}/doctor/availability`,
        { isAvailable: availabilityDraft },
        authConfig()
      );
      const savedAvailability = response.data?.isAvailable === true;
      setIsAvailable(savedAvailability);
      setAvailabilityDraft(savedAvailability);
      setAvailabilityNotice(
        savedAvailability
          ? "Availability saved. Patients can now find and book you."
          : "Availability saved. You will no longer appear as bookable to patients."
      );
      setAvailabilityEditorOpen(false);
    } catch (err) {
      setError(err.response?.data?.error ?? "Failed to update availability.");
    } finally {
      setUpdatingAvailability(false);
    }
  }

  async function respondToAppointment(id, action) {
    setActingAppointmentId(String(id));
    setError("");
    try {
      await axios.patch(
        `${API_BASE}/appointment/${id}/respond`,
        { action },
        authConfig()
      );
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.error ?? "Failed to update appointment.");
    } finally {
      setActingAppointmentId("");
    }
  }

  const today = todayLocalISO();
  const upcoming = appointments.filter((appointment) => appointment.appointmentDate >= today);
  const past = appointments.filter((appointment) => appointment.appointmentDate < today);

  function renderAppointments(items, emptyText) {
    if (items.length === 0) return <p className="appointment-empty">{emptyText}</p>;
    return (
      <div className="appointment-records">
        {items.map((appointment) => {
          const busy = actingAppointmentId === String(appointment._id);
          return (
            <article className="appointment-record" key={appointment._id}>
              <div className="appointment-record-main">
                <h3>{appointment.patientName || "Patient"}</h3>
                <p>{appointment.patientAge ? `Age ${appointment.patientAge}` : "Patient details are limited to authorized information."}</p>
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
              {appointment.status === "pending" && (
                <div className="appointment-record-actions">
                  <button
                    type="button"
                    className="provider-primary-button"
                    disabled={busy}
                    onClick={() => respondToAppointment(appointment._id, "accept")}
                  >
                    {busy ? "Updating..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    className="appointment-secondary-button"
                    disabled={busy}
                    onClick={() => setAlternateAppointmentId(appointment._id)}
                  >
                    Suggest another time
                  </button>
                  <button
                    type="button"
                    className="appointment-danger-button"
                    disabled={busy}
                    onClick={() => respondToAppointment(appointment._id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <Layout>
      <div className="provider-page appointment-page">
        <header className="provider-page-heading">
          <div>
            <span className="provider-eyebrow">DOCTOR WORKSPACE</span>
            <h1>Set Appointment</h1>
            <p>Manage your appointment availability and review patient requests.</p>
          </div>
          <button
            type="button"
            className="appointment-secondary-button"
            onClick={loadAppointments}
            disabled={loading || accessDenied}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {error && (
          <div className={accessDenied ? "appointment-access-notice" : "provider-error"} role="alert">
            <p>{error}</p>
            {accessDenied && (
              <p>Pending or rejected doctor applications continue to use patient services while awaiting approval.</p>
            )}
          </div>
        )}

        {!accessDenied && (loading ? (
          <p className="provider-status" role="status">Loading appointment requests...</p>
        ) : (
          <>
            <section className="doctor-availability-panel" aria-labelledby="doctor-availability-title">
              <div>
                <span className="provider-eyebrow">BOOKING STATUS</span>
                <h2 id="doctor-availability-title">
                  {isAvailable ? "Accepting appointment requests" : "Not accepting new appointment requests"}
                </h2>
                <p>
                  Saved setting: {isAvailable ? "Available for booking" : "Not available for booking"}.
                  Configure your weekly hours, breaks, and unavailable dates below.
                </p>
              </div>
              <button
                type="button"
                className="provider-primary-button doctor-availability-button"
                onClick={() => {
                  setAvailabilityDraft(isAvailable);
                  setAvailabilityNotice("");
                  setError("");
                  setAvailabilityEditorOpen((open) => !open);
                }}
                disabled={updatingAvailability}
                aria-expanded={availabilityEditorOpen}
                aria-controls="doctor-availability-editor"
              >
                {availabilityEditorOpen ? "Close availability settings" : "Set Availability"}
              </button>
            </section>
            {availabilityNotice && (
              <p className="doctor-availability-notice" role="status">{availabilityNotice}</p>
            )}
            {availabilityEditorOpen && (
              <div id="doctor-availability-editor" className="doctor-availability-editor">
                <form onSubmit={saveAvailability}>
                  <label className="doctor-availability-toggle">
                    <input
                      type="checkbox"
                      checked={availabilityDraft}
                      onChange={(event) => setAvailabilityDraft(event.target.checked)}
                      disabled={updatingAvailability}
                    />
                    <span>Accept patient bookings</span>
                  </label>
                  <div className="doctor-availability-actions">
                    <button
                      type="submit"
                      className="provider-primary-button"
                      disabled={updatingAvailability || availabilityDraft === isAvailable}
                    >
                      {updatingAvailability ? "Saving..." : "Save booking status"}
                    </button>
                    <button
                      type="button"
                      className="appointment-secondary-button"
                      disabled={updatingAvailability}
                      onClick={() => {
                        setAvailabilityDraft(isAvailable);
                        setAvailabilityEditorOpen(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </form>
                <AvailabilitySettings onUpdated={loadAppointments} />
                <p className="doctor-availability-help">
                  Changes to your working hours and exceptions update future bookable slots.
                  Existing appointments are preserved.
                </p>
              </div>
            )}

            <section className="appointment-list-section" aria-labelledby="upcoming-appointments-title">
              <div className="appointment-list-heading">
                <div>
                  <span className="provider-eyebrow">SCHEDULE</span>
                  <h2 id="upcoming-appointments-title">Upcoming appointments</h2>
                </div>
              </div>
              {renderAppointments(upcoming, "No upcoming appointments or requests.")}
            </section>
            <section className="appointment-list-section" aria-labelledby="past-appointments-title">
              <div className="appointment-list-heading">
                <div>
                  <span className="provider-eyebrow">HISTORY</span>
                  <h2 id="past-appointments-title">Past appointments</h2>
                </div>
              </div>
              {renderAppointments(past, "No past appointments.")}
            </section>
          </>
        ))}
      </div>
      {alternateAppointmentId && (
        <AlternateTimeModal
          appointmentId={alternateAppointmentId}
          onClose={() => setAlternateAppointmentId("")}
          onSuggested={() => {
            setAlternateAppointmentId("");
            loadAppointments();
          }}
        />
      )}
    </Layout>
  );
}

export default DoctorAppointments;
