import { useState, useEffect } from "react";
import axios from "axios";
import { MORNING_SLOTS, AFTERNOON_SLOTS } from "../utils/appointmentSlots";
import "../pages/Chat.css";

const API_BASE = "http://localhost:8001";

// STEP 2 — Confirm calls POST /appointment/book and creates a pending
// appointment. No chat messages are sent here (that is STEP 3).
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

// "Book an Appointment" popup for a connected doctor. The backend confirms
// the booking and returns its persisted appointment details.
// onBooked (optional) lets the opener refresh right away so the new
// appointment card appears without a manual reload.
export default function AppointmentModal({ doctor, onClose, onBooked }) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [bookError, setBookError] = useState("");
  const [availability, setAvailability] = useState(null);
  const availabilityKey = doctor?._id && date ? `${doctor._id}:${date}` : "";
  const currentAvailability =
    availability?.key === availabilityKey ? availability : null;
  const availableSlots = currentAvailability?.slots ?? [];
  const checkingSlots = Boolean(availabilityKey && !currentAvailability);
  const availabilityError = currentAvailability?.error ?? "";

  useEffect(() => {
    if (!doctor?._id || !date) {
      return undefined;
    }

    let active = true;
    const token = localStorage.getItem("token");
    axios.get(`${API_BASE}/appointment/availability`, {
      params: { doctorId: doctor._id, date },
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (active) {
          setAvailability({
            key: `${doctor._id}:${date}`,
            slots: response.data?.availableSlots ?? [],
            error: "",
          });
        }
      })
      .catch((err) => {
        if (active) {
          setAvailability({
            key: `${doctor._id}:${date}`,
            slots: [],
            error:
              err.response?.data?.error ?? "Failed to check appointment availability.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [doctor?._id, date]);

  if (!doctor) return null;

  const minDate = todayLocalISO();
  const canConfirm =
    date !== "" &&
    slot !== null &&
    availableSlots.includes(slot) &&
    !checkingSlots &&
    !availabilityError &&
    !sending;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSending(true);
    setBookError("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/appointment/book`,
        {
          doctorId: doctor._id,
          appointmentDate: date,
          appointmentTime: slot,
          visitReason: visitReason.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBooking(response.data?.appointment ?? null);
      setBookingWarning(response.data?.notificationWarning ?? "");
      setConfirmed(true);
      onBooked?.(response.data?.appointment);
    } catch (err) {
      const message = err.response?.data?.error ?? "Failed to book appointment. Please try again.";
      if (err.response?.status === 409) {
        // Occupied slot: stay on the form so another time can be picked.
        setSlot(null);
        setAvailability((current) =>
          current?.key === availabilityKey
            ? { ...current, slots: current.slots.filter((available) => available !== slot) }
            : current
        );
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
            <p className="appt-confirm-title">Appointment confirmed</p>
            <p className="appt-confirm-sub">
              Confirmation ID: {booking?._id || "Unavailable"}
            </p>
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
              <div className="appt-summary-row">
                <span>Visit reason:</span>
                <strong>{visitReason}</strong>
              </div>
            </div>
            {bookingWarning ? <p role="status">{bookingWarning}</p> : null}
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
                setSlots([]);
                setLoadingSlots(Boolean(e.target.value));
                setAvailabilityMessage("");
                setBookError("");
              }}
            />

            <label className="appt-label" htmlFor="appt-reason">
              Reason for visit
            </label>
            <textarea
              id="appt-reason"
              className="chat-input"
              value={visitReason}
              maxLength={500}
              rows={3}
              onChange={(event) => setVisitReason(event.target.value)}
              placeholder="Briefly describe what you would like help with"
            />

            {date !== "" && (
              <>
                <p className="appt-label">Available time slots</p>
                {checkingSlots && <p role="status">Checking available times...</p>}
                {availabilityError && <p className="upload-error" role="alert">{availabilityError}</p>}
                {!checkingSlots && !availabilityError && availableSlots.length === 0 && (
                  <p role="status">No appointment slots are available on this date.</p>
                )}
                {!checkingSlots && !availabilityError && availableSlots.some((s) => MORNING_SLOTS.includes(s)) && (
                  <>
                    <p className="appt-slot-group">Morning</p>
                    <div className="appt-slots">
                      {MORNING_SLOTS.filter((s) => availableSlots.includes(s)).map((s) => (
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
                {!checkingSlots && !availabilityError && availableSlots.some((s) => AFTERNOON_SLOTS.includes(s)) && (
                  <>
                    <p className="appt-slot-group">Afternoon</p>
                    <div className="appt-slots">
                      {AFTERNOON_SLOTS.filter((s) => availableSlots.includes(s)).map((s) => (
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
                {sending ? "Booking..." : "Confirm appointment"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
