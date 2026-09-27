import { useState } from "react";
import axios from "axios";
import { MORNING_SLOTS, AFTERNOON_SLOTS } from "./AppointmentModal";
import "../pages/Chat.css";

const API_BASE = "http://localhost:8001";

function todayLocalISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// Doctor proposes an alternative slot for a pending appointment. Calls the
// existing STEP 2 alternate API; the patient's original request is kept.
export default function AlternateTimeModal({ appointmentId, onClose, onSuggested }) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!appointmentId) return null;

  const canSuggest = date !== "" && slot !== null && !sending;

  async function handleSuggest() {
    if (!canSuggest) return;
    setSending(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/appointment/${appointmentId}/respond`,
        { action: "alternate", alternateDate: date, alternateTime: slot },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSuggested();
    } catch (err) {
      setError(err.response?.data?.error ?? "Failed to suggest alternate time. Please try again.");
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
        aria-label="Suggest alternate time"
      >
        <div className="appt-header">
          <h2>Suggest Alternate Time</h2>
          <button type="button" className="appt-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <label className="appt-label" htmlFor="alt-date">
          Alternative date
        </label>
        <input
          id="alt-date"
          type="date"
          className="chat-input appt-date"
          value={date}
          min={todayLocalISO()}
          onChange={(e) => {
            setDate(e.target.value);
            setSlot(null);
            setError("");
          }}
        />
        {date !== "" && (
          <>
            <p className="appt-label">Alternative time slots</p>
            <div className="appt-slots">
              {[...MORNING_SLOTS, ...AFTERNOON_SLOTS].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`appt-slot ${slot === s ? "appt-slot-active" : ""}`}
                  onClick={() => { setSlot(s); setError(""); }}
                  aria-pressed={slot === s}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {error && <div className="upload-error">{error}</div>}
        <div className="appt-actions">
          <button type="button" className="doctor-back-btn appt-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="send-btn appt-confirm-btn"
            onClick={handleSuggest}
            disabled={!canSuggest}
          >
            {sending ? "Sending..." : "Suggest Time"}
          </button>
        </div>
      </div>
    </div>
  );
}
