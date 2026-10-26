import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TRANSITION_LABELS,
} from "../adminConstants";
import {
  formatCalendarDate,
  formatDateTime,
  getInitials,
} from "../format";
import AdminDialog from "./AdminDialog";

const STATUS_ERROR_COPY = {
  INVALID_APPOINTMENT_TRANSITION:
    "That status change is no longer supported from this appointment's current status. Close the dialog, refresh, and try again.",
  APPOINTMENT_STATUS_CHANGED:
    "Another update changed this appointment first. Refresh the list to see the current status.",
  APPOINTMENT_SLOT_TAKEN:
    "That appointment time slot is already occupied. The appointment was not changed.",
  INVALID_APPOINTMENT_STATE:
    "This appointment does not have a valid alternate time to accept.",
  INVALID_APPOINTMENT_STATUS: "That appointment status is not valid.",
  INVALID_APPOINTMENT_ID: "That appointment reference is not valid.",
  APPOINTMENT_NOT_FOUND: "This appointment no longer exists.",
  ACCOUNT_SUSPENDED:
    "Your admin account was suspended. Sign in with another Super Admin account.",
};

function statusErrorMessage(error) {
  if (!error) return "";

  return (
    STATUS_ERROR_COPY[error.code] ||
    error.message ||
    "The appointment status could not be updated. Please try again."
  );
}

function transitionLabel(appointment, nextStatus) {
  if (nextStatus === "accepted" && appointment?.status === "alternate_requested") {
    return "Accept alternate time";
  }

  return APPOINTMENT_TRANSITION_LABELS[nextStatus] ?? nextStatus;
}

function transitionTitle(appointment, nextStatus) {
  if (nextStatus === "accepted") {
    return appointment?.status === "alternate_requested"
      ? "Accept the alternate time?"
      : "Accept this appointment?";
  }
  if (nextStatus === "rejected") return "Reject this appointment?";
  if (nextStatus === "cancelled") return "Cancel this appointment?";
  return "Change this appointment status?";
}

function transitionCopy(appointment, nextStatus) {
  if (nextStatus === "accepted") {
    return appointment?.status === "alternate_requested"
      ? "The appointment will be marked accepted after the alternate-time workflow. The chat card is updated, and no records are deleted."
      : "The appointment will be marked accepted and the chat card will be updated. No appointment, message, account, or doctor record is deleted.";
  }
  if (nextStatus === "rejected") {
    return "The appointment will be marked rejected and the chat card will be updated. No records are deleted.";
  }
  if (nextStatus === "cancelled") {
    return "The appointment will be marked cancelled and the chat card will be updated. No records are deleted.";
  }
  return "Only the appointment status will change. Existing records are preserved.";
}

function DetailField({ label, children, mono = false }) {
  return (
    <div className="admin-detail-field">
      <dt>{label}</dt>
      <dd className={mono ? "admin-detail-mono" : undefined}>{children ?? "—"}</dd>
    </div>
  );
}

export function AppointmentStatusBadge({ status }) {
  const known = Object.prototype.hasOwnProperty.call(
    APPOINTMENT_STATUS_LABELS,
    status
  );
  const normalized = known ? status : "unknown";
  const className = String(normalized).replace(/_/g, "-");

  return (
    <span className={`admin-badge admin-badge-appointment-${className}`}>
      {APPOINTMENT_STATUS_LABELS[normalized] ?? "Unknown"}
    </span>
  );
}

export function AppointmentDetailDialog({ appointment, onClose, onChangeStatus }) {
  const allowedTransitions = appointment?.allowedTransitions ?? [];
  const patientName = appointment?.patient?.name || "Unknown patient";
  const doctorName = appointment?.doctor?.name || "Unknown doctor";
  const hasAlternate = Boolean(
    appointment?.alternateDate || appointment?.alternateTime
  );

  return (
    <AdminDialog
      title="Appointment details"
      description="Review the appointment and use only the status changes supported by the existing patient and doctor workflows."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
          {allowedTransitions.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              className={`admin-btn ${
                nextStatus === "accepted"
                  ? "admin-btn-primary"
                  : "admin-btn-danger"
              }`}
              onClick={() => onChangeStatus(appointment, nextStatus)}
            >
              {transitionLabel(appointment, nextStatus)}
            </button>
          ))}
        </>
      }
    >
      <div className="admin-detail">
        <div className="admin-detail-summary">
          <span className="admin-detail-avatar" aria-hidden="true">
            {getInitials(appointment?.patient?.name)}
          </span>
          <div className="admin-detail-identity">
            <h3>{patientName}</h3>
            <p>with {doctorName}</p>
            <div className="admin-detail-badges">
              <AppointmentStatusBadge status={appointment?.status} />
              <span className="admin-detail-muted">
                {formatCalendarDate(appointment?.appointmentDate)} at{" "}
                {appointment?.appointmentTime || "—"}
              </span>
            </div>
          </div>
        </div>

        <section className="admin-detail-section" aria-label="Appointment schedule">
          <h4>Schedule</h4>
          <dl className="admin-detail-grid">
            <DetailField label="Appointment ID" mono>
              {appointment?._id}
            </DetailField>
            <DetailField label="Date">
              {formatCalendarDate(appointment?.appointmentDate)}
            </DetailField>
            <DetailField label="Time">
              {appointment?.appointmentTime || "—"}
            </DetailField>
            <DetailField label="Requested">
              {formatDateTime(appointment?.requestedAt) || "—"}
            </DetailField>
            <DetailField label="Alternate date">
              {hasAlternate ? formatCalendarDate(appointment?.alternateDate) : "—"}
            </DetailField>
            <DetailField label="Alternate time">
              {hasAlternate ? appointment?.alternateTime || "—" : "—"}
            </DetailField>
            <DetailField label="Last updated">
              {formatDateTime(appointment?.updatedAt) || "—"}
            </DetailField>
          </dl>
        </section>

        <section className="admin-detail-section" aria-label="Patient details">
          <h4>Patient</h4>
          <dl className="admin-detail-grid">
            <DetailField label="Name">
              {appointment?.patient?.name || "—"}
            </DetailField>
            <DetailField label="Email">
              {appointment?.patient?.email || "—"}
            </DetailField>
            <DetailField label="Age">
              {appointment?.patient?.age ?? "—"}
            </DetailField>
          </dl>
        </section>

        <section className="admin-detail-section" aria-label="Doctor details">
          <h4>Doctor</h4>
          <dl className="admin-detail-grid">
            <DetailField label="Name">
              {appointment?.doctor?.name || "—"}
            </DetailField>
            <DetailField label="Specialty">
              {appointment?.doctor?.specialist || "—"}
            </DetailField>
            <DetailField label="Clinic">
              {appointment?.doctor?.clinicName || "—"}
            </DetailField>
            <DetailField label="Registered email">
              {appointment?.doctor?.registeredBy || "—"}
            </DetailField>
          </dl>
        </section>

        <p className="admin-detail-hint">
          {allowedTransitions.length > 0
            ? "Allowed actions follow the existing patient and doctor appointment workflow. Changing the status updates the chat card and never deletes the appointment or changes account state."
            : "This appointment is in a final status for the current workflow, so no further status changes are available."}
        </p>
      </div>
    </AdminDialog>
  );
}

export function ConfirmAppointmentStatusDialog({
  appointment,
  nextStatus,
  onClose,
  onConfirm,
  isSubmitting = false,
  error = null,
}) {
  const danger = nextStatus !== "accepted";
  const patientName = appointment?.patient?.name || "Unknown patient";
  const doctorName = appointment?.doctor?.name || "Unknown doctor";
  const acceptingAlternate =
    nextStatus === "accepted" && appointment?.status === "alternate_requested";
  const displayDate = acceptingAlternate
    ? appointment?.alternateDate || appointment?.appointmentDate
    : appointment?.appointmentDate;
  const displayTime = acceptingAlternate
    ? appointment?.alternateTime || appointment?.appointmentTime
    : appointment?.appointmentTime;

  return (
    <AdminDialog
      title={transitionTitle(appointment, nextStatus)}
      description="Only the appointment status will change. Existing records are preserved."
      onClose={onClose}
      closeDisabled={isSubmitting}
      tone={danger ? "danger" : "default"}
      footer={
        <>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`admin-btn ${
              danger ? "admin-btn-danger" : "admin-btn-primary"
            }`}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : transitionLabel(appointment, nextStatus)}
          </button>
        </>
      }
    >
      <div className="admin-confirm-target">
        <span className="admin-detail-avatar" aria-hidden="true">
          {getInitials(appointment?.patient?.name)}
        </span>
        <div className="admin-detail-identity">
          <strong>
            {patientName} with {doctorName}
          </strong>
          <span className="admin-cell-email">
            {formatCalendarDate(displayDate)} at {displayTime || "—"}
          </span>
          <div className="admin-detail-badges">
            <AppointmentStatusBadge status={appointment?.status} />
            <span aria-hidden="true">→</span>
            <AppointmentStatusBadge status={nextStatus} />
          </div>
        </div>
      </div>

      <p className="admin-dialog-copy">
        {transitionCopy(appointment, nextStatus)}
      </p>
      <p className="admin-detail-hint">
        Account status and doctor approval status never automatically cancel
        appointments. This action is explicit and keeps every record.
      </p>

      {error ? (
        <div className="admin-notice admin-notice-error" role="alert">
          {statusErrorMessage(error)}
        </div>
      ) : null}
    </AdminDialog>
  );
}
