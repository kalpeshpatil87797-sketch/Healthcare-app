// Appointment request card rendered inside the EXISTING Doctor Chat for
// messages with type "appointment". Same card both sides; action buttons
// only for the doctor on pending requests, status line for the patient.
const STATUS_LABEL = {
  pending: "Pending",
  accepted: "Accepted",
  alternate_requested: "Alternate Suggested",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function formatApptDate(iso) {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return String(iso);
  const [y, m, d] = parts.map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  if (!y || !m || !d || !months[m - 1]) return String(iso);
  return `${d} ${months[m - 1]} ${y}`;
}

export default function AppointmentCard({
  msg,
  isDoctorView,
  patientName,
  acting,
  onAccept,
  onReject,
  onAlternate,
  onAcceptAlternate,
  onChooseAnother,
}) {
  if (!msg) return null;
  const status = msg.appointmentStatus ?? "pending";
  const date = formatApptDate(msg.appointmentDate);
  const appointmentId = msg.appointmentId;
  const busy = acting === String(appointmentId);

  return (
    <div className="appt-card">
      <div className="appt-card-header">
        <span className="appt-card-icon" aria-hidden="true">📅</span>
        <strong>Appointment Request</strong>
        <span className={`appt-status appt-status-${status}`}>{STATUS_LABEL[status] ?? status}</span>
      </div>
      {isDoctorView && (
        <p className="appt-card-row">
          <span>Patient:</span> <strong>{patientName || msg.senderEmail}</strong>
        </p>
      )}
      <p className="appt-card-row">
        <span>Requested Date:</span> <strong>{date}</strong>
      </p>
      <p className="appt-card-row">
        <span>Requested Time:</span> <strong>{msg.appointmentTime}</strong>
      </p>

      {status === "alternate_requested" && msg.alternateDate && (
        <div className="appt-alternate-box">
          {isDoctorView ? (
            <p className="appt-card-row">
              <span>Suggested:</span>{" "}
              <strong>{formatApptDate(msg.alternateDate)} at {msg.alternateTime}</strong>
            </p>
          ) : (
            <>
              <p className="appt-alternate-note">Doctor suggested an alternate appointment time.</p>
              <p className="appt-card-row">
                <span>Original request:</span> <strong>{date} at {msg.appointmentTime}</strong>
              </p>
              <p className="appt-card-row">
                <span>Doctor's suggested time:</span>{" "}
                <strong>{formatApptDate(msg.alternateDate)} at {msg.alternateTime}</strong>
              </p>
            </>
          )}
        </div>
      )}

      {isDoctorView ? (
        status === "pending" ? (
          <div className="appt-card-actions">
            <button
              type="button"
              className="appt-card-btn appt-card-accept"
              disabled={busy}
              onClick={() => onAccept(appointmentId)}
            >
              {busy ? "..." : "Accept"}
            </button>
            <button
              type="button"
              className="appt-card-btn appt-card-alternate"
              disabled={busy}
              onClick={() => onAlternate(appointmentId)}
            >
              Alternate Time
            </button>
            <button
              type="button"
              className="appt-card-btn appt-card-reject"
              disabled={busy}
              onClick={() => onReject(appointmentId)}
            >
              Reject
            </button>
          </div>
        ) : null
      ) : status === "pending" ? (
        <p className="appt-card-status-line">Status: Waiting for doctor confirmation</p>
      ) : status === "alternate_requested" ? (
        <div className="appt-card-actions">
          <button
            type="button"
            className="appt-card-btn appt-card-accept"
            disabled={busy}
            onClick={() => onAcceptAlternate(appointmentId)}
          >
            {busy ? "..." : "Accept New Time"}
          </button>
          <button
            type="button"
            className="appt-card-btn appt-card-alternate"
            disabled={busy}
            onClick={() => onChooseAnother()}
          >
            Choose Another Time
          </button>
        </div>
      ) : null}
    </div>
  );
}
