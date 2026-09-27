import { useState } from "react";
import axios from "axios";
import "../pages/Chat.css";

const API_BASE = "http://localhost:8001";

// STEP 2 — Confirm calls POST /appointment/book and creates a pending
// appointment. No chat messages are sent here (that is STEP 3).
// Example slots shown after a date is picked; real availability comes later.
export const MORNING_SLOTS = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"];
export const AFTERNOON_SLOTS = ["02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"];

// Today's date in local YYYY-MM-DD for the date input minimum (no past dates).
function todayLocalISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatPickedDate(iso) {
  if (!iso) return "";
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "Book an Appointment" popup for a connected doctor. Confirm sends the
// booking request to the backend; success only reveals a frontend summary.
// onBooked (optional) lets the opener refresh right away so the new
// appointment card appears without a manual reload.
export default function AppointmentModal({ doctor, onClose, onBooked }) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [bookError, setBookError] = useState("");

  if (!doctor) return null;

  const minDate = todayLocalISO();
  const canConfirm = date !== "" && slot !== null && !sending;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSending(true);
    setBookError("");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/appointment/book`,
        { doctorId: doctor._id, appointmentDate: date, appointmentTime: slot },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConfirmed(true);
      onBooked?.();
    } catch (err) {
      const message = err.response?.data?.error ?? "Failed to book appointment. Please try again.";
      if (err.response?.status === 409) {
        // Occupied slot: stay on the form so another time can be picked.
        setSlot(null);
        setBookError(`${message} Please select another time.`);
      } else {
        setBookError(message);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="appt-overlay" onClick={onClose}>
      <div
        className="appt-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Book an Appointment"
      >
        <div className="appt-header">
          <h2>Book an Appointment</h2>
          <button type="button" className="appt-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="appt-doctor">
          <span className="dm-avatar" aria-hidden="true">
            {(doctor.name || "?").trim().charAt(0).toUpperCase()}
          </span>
          <div className="appt-doctor-info">
            <strong>{doctor.name}</strong>
            <span className="appt-doctor-specialist">{doctor.specialist}</span>
            {doctor.clinicName && <span className="appt-doctor-clinic">🏥 {doctor.clinicName}</span>}
          </div>
        </div>

        {confirmed ? (
          <div className="appt-confirm-box">
            <span className="appt-confirm-icon" aria-hidden="true">✅</span>
            <p className="appt-confirm-title">Appointment request sent</p>
            <p className="appt-confirm-sub">Waiting for doctor confirmation.</p>
            <div className="appt-summary">
              <div className="appt-summary-row">
                <span>Doctor:</span>
                <strong>{doctor.name}</strong>
              </div>
              <div className="appt-summary-row">
                <span>Date:</span>
                <strong>{formatPickedDate(date)}</strong>
              </div>
              <div className="appt-summary-row">
                <span>Time:</span>
                <strong>{slot}</strong>
              </div>
            </div>
            <div className="appt-actions">
              <button type="button" className="send-btn appt-done-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="appt-label" htmlFor="appt-date">
              Select a date
            </label>
            <input
              id="appt-date"
              type="date"
              className="chat-input appt-date"
              value={date}
              min={minDate}
              onChange={(e) => {
                setDate(e.target.value);
                setSlot(null);
                setBookError("");
              }}
            />

            {date !== "" && (
              <>
                <p className="appt-label">Available time slots</p>
                <p className="appt-slot-group">Morning</p>
                <div className="appt-slots">
                  {MORNING_SLOTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`appt-slot ${slot === s ? "appt-slot-active" : ""}`}
                      onClick={() => { setSlot(s); setBookError(""); }}
                      aria-pressed={slot === s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="appt-slot-group">Afternoon</p>
                <div className="appt-slots">
                  {AFTERNOON_SLOTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`appt-slot ${slot === s ? "appt-slot-active" : ""}`}
                      onClick={() => { setSlot(s); setBookError(""); }}
                      aria-pressed={slot === s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {date !== "" && slot !== null && (
              <div className="appt-selected">
                Selected: <strong>{formatPickedDate(date)}</strong> at <strong>{slot}</strong>
              </div>
            )}

            {bookError && <div className="upload-error">{bookError}</div>}

            <div className="appt-actions">
              <button type="button" className="doctor-back-btn appt-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="send-btn appt-confirm-btn"
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {sending ? "Booking..." : "Confirm Appointment"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
