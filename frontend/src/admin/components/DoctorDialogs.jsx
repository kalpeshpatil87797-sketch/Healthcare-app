import { useEffect, useState } from "react";
import { getAdminDoctor, updateClinicLocationVerification } from "../adminApi";
import {
  DOCTOR_APPROVAL_LABELS,
  DOCTOR_REJECTION_REASON_MAX,
} from "../adminConstants";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  getInitials,
} from "../format";
import { useAdminRequest } from "../useAdminRequest";
import AdminDialog from "./AdminDialog";
import { AccountStatusBadge } from "./UserDialogs";

const fetchDoctorDetail = (params, options) =>
  getAdminDoctor(params.id, options);

const REVIEW_ERROR_COPY = {
  DOCTOR_NOT_PENDING:
    "This application is no longer pending. Close the dialog, refresh the list, and try again.",
  DOCTOR_APPROVAL_CHANGED:
    "Another reviewer resolved this application first. Refresh the list to see the result.",
  INVALID_REJECTION_REASON:
    "Enter a rejection reason between 1 and 500 characters.",
  DOCTOR_NOT_FOUND: "This doctor profile no longer exists.",
  INVALID_APPROVAL_STATUS: "That approval decision is not valid.",
  ACCOUNT_SUSPENDED:
    "Your admin account was suspended. Contact the Root Owner.",
};

const DETAIL_ERROR_COPY = {
  session: "Your session expired. Reload the page and sign in again.",
  suspended: "This admin account is suspended.",
  forbidden: "You no longer have permission to view this profile.",
  notFound: "This doctor profile no longer exists.",
  server: "Doctor details could not be loaded right now.",
  network: "Cannot reach the server. Check your connection and try again.",
  canceled: "The request was canceled. Try again.",
};

function reviewErrorMessage(error) {
  if (!error) return "";

  return (
    REVIEW_ERROR_COPY[error.code] ||
    error.message ||
    "The application could not be updated. Please try again."
  );
}

function detailErrorMessage(error) {
  return DETAIL_ERROR_COPY[error?.kind] || "Doctor details could not be loaded.";
}

export function DoctorApprovalBadge({ status }) {
  const normalized =
    status === "pending" || status === "rejected" ? status : "approved";

  return (
    <span className={`admin-badge admin-badge-approval-${normalized}`}>
      {DOCTOR_APPROVAL_LABELS[normalized]}
    </span>
  );
}

function DetailField({ label, children }) {
  return (
    <div className="admin-detail-field">
      <dt>{label}</dt>
      <dd>{children ?? "—"}</dd>
    </div>
  );
}

function ActivityCount({ label, value }) {
  return (
    <div className="admin-detail-count">
      <span className="admin-detail-count-value">{formatNumber(value)}</span>
      <span className="admin-detail-count-label">{label}</span>
    </div>
  );
}

export function DoctorDetailDialog({ doctorId, onClose, onReview, onLocationUpdated }) {
  const { data, error, isLoading, isRefreshing, retry, refresh } = useAdminRequest(fetchDoctorDetail, {
    id: doctorId,
  });
  const [locationVerificationBusy, setLocationVerificationBusy] = useState(false);
  const [locationVerificationError, setLocationVerificationError] = useState("");
  const [locationVerificationNotice, setLocationVerificationNotice] = useState("");
  const [locationVerifiedOverride, setLocationVerifiedOverride] = useState(null);

  const canReview = data?.approval?.canReview === true;
  const locationVerified =
    locationVerifiedOverride ?? data?.locationVerified === true;
  const hasValidCoordinates =
    Number.isFinite(data?.latitude) &&
    data.latitude >= -90 &&
    data.latitude <= 90 &&
    Number.isFinite(data?.longitude) &&
    data.longitude >= -180 &&
    data.longitude <= 180;

  useEffect(() => {
    const refreshVisibleDetail = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refreshVisibleDetail);
    document.addEventListener("visibilitychange", refreshVisibleDetail);
    return () => {
      window.removeEventListener("focus", refreshVisibleDetail);
      document.removeEventListener("visibilitychange", refreshVisibleDetail);
    };
  }, [refresh]);

  async function toggleLocationVerification() {
    if (!data || locationVerificationBusy) return;
    setLocationVerificationBusy(true);
    setLocationVerificationError("");
    setLocationVerificationNotice("");
    try {
      const response = await updateClinicLocationVerification(
        data._id,
        !locationVerified
      );
      setLocationVerificationNotice(response.message);
      setLocationVerifiedOverride(response.doctor.locationVerified === true);
      refresh();
      onLocationUpdated?.();
    } catch (requestError) {
      setLocationVerificationError(
        requestError.message || "Clinic location verification could not be updated."
      );
    } finally {
      setLocationVerificationBusy(false);
    }
  }

  return (
    <AdminDialog
      title="Doctor profile"
      description="Review the registration details before making a verification decision."
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
          {canReview ? (
            <>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => onReview(data, "rejected")}
              >
                Reject
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => onReview(data, "approved")}
              >
                Approve
              </button>
            </>
          ) : null}
        </>
      }
    >
      {isLoading ? (
        <p className="admin-dialog-loading" role="status">
          <span className="admin-gate-spinner" aria-hidden="true" />
          Loading doctor details…
        </p>
      ) : error ? (
        <div className="admin-dialog-error" role="alert">
          <p>{detailErrorMessage(error)}</p>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <div className="admin-detail">
          <div className="admin-detail-refresh">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={refresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing…" : "Refresh doctor details"}
            </button>
          </div>
          <div className="admin-detail-summary">
            <span className="admin-detail-avatar" aria-hidden="true">
              {getInitials(data.name)}
            </span>
            <div className="admin-detail-identity">
              <h3>{data.name || "Unnamed doctor"}</h3>
              <p>{data.clinicName || "Clinic not provided"}</p>
              <div className="admin-detail-badges">
                <DoctorApprovalBadge status={data.approvalStatus} />
                <span className="admin-detail-muted">
                  {data.isAvailable ? "Available" : "Not available"}
                </span>
              </div>
            </div>
          </div>

          <dl className="admin-detail-grid">
            <DetailField label="Degree">{data.degree || "—"}</DetailField>
            <DetailField label="Specialty">
              {data.specialist || "—"}
            </DetailField>
            <DetailField label="Clinic location">
              {data.clinicLocation || "—"}
            </DetailField>
            <DetailField label="Clinic latitude">
              {data.latitude ?? "Not saved"}
            </DetailField>
            <DetailField label="Clinic longitude">
              {data.longitude ?? "Not saved"}
            </DetailField>
            <DetailField label="Registered email">
              {data.registeredBy || "—"}
            </DetailField>
            <DetailField label="Applied">
              {formatDate(data.submittedAt || data.createdAt)}
            </DetailField>
            <DetailField label="Last updated">
              {formatDateTime(data.updatedAt) || "—"}
            </DetailField>
            <DetailField label="Reviewed at">
              {formatDateTime(data.reviewedAt) || "Not reviewed"}
            </DetailField>
            <DetailField label="Linked account">
              {data.linkedUser ? (
                <span className="admin-detail-inline">
                  {data.linkedUser.email || data.linkedUser.name || "—"}
                  <AccountStatusBadge
                    status={data.linkedUser.accountStatus}
                  />
                </span>
              ) : (
                "No linked account"
              )}
            </DetailField>
          </dl>

          <section className="admin-detail-section" aria-label="Clinic location verification">
            <h4>Clinic location verification</h4>
            <p className="admin-detail-hint">
              {locationVerified
                ? "This saved clinic location is verified and may be shown as a map pin."
                : "This location is unverified and must not be shown as a map pin."}
            </p>
            {locationVerificationNotice ? (
              <p role="status" className="admin-detail-hint">{locationVerificationNotice}</p>
            ) : null}
            {locationVerificationError ? (
              <p role="alert" className="admin-dialog-error">{locationVerificationError}</p>
            ) : null}
            <button
              type="button"
              className={locationVerified
                ? "admin-btn admin-btn-secondary"
                : "admin-btn admin-btn-primary"}
              onClick={toggleLocationVerification}
              disabled={
                locationVerificationBusy ||
                (!locationVerified && !hasValidCoordinates)
              }
            >
              {locationVerificationBusy
                ? "Saving…"
                : locationVerified
                  ? "Revoke location verification"
                  : "Verify clinic location"}
            </button>
            {!locationVerified && !hasValidCoordinates ? (
              <p className="admin-detail-hint">
                Verification is unavailable until valid clinic coordinates are saved.
              </p>
            ) : null}
          </section>

          {data.approvalStatus === "rejected" && data.rejectionReason ? (
            <div className="admin-detail-reason" role="note">
              <strong>Rejection reason</strong>
              <p>{data.rejectionReason}</p>
            </div>
          ) : null}

          <section className="admin-detail-section" aria-label="Linked activity">
            <h4>Linked activity</h4>
            <div className="admin-detail-counts">
              <ActivityCount
                label="Appointments"
                value={data.activity?.appointments}
              />
              <ActivityCount
                label="Connections"
                value={data.activity?.connections}
              />
            </div>
            <p className="admin-detail-hint">
              Approval decisions never delete appointments, messages, connections,
              or the doctor profile.
            </p>
          </section>
        </div>
      ) : null}
    </AdminDialog>
  );
}

export function ReviewDoctorDialog({
  doctor,
  decision,
  onClose,
  onConfirm,
  isSubmitting = false,
  error = null,
}) {
  const [reason, setReason] = useState("");
  const approving = decision === "approved";
  const trimmedReason = reason.trim();
  const reasonValid =
    approving ||
    (trimmedReason.length > 0 &&
      trimmedReason.length <= DOCTOR_REJECTION_REASON_MAX);

  return (
    <AdminDialog
      title={approving ? "Approve this doctor?" : "Reject this application?"}
      description={
        approving
          ? "The profile becomes verified and can appear to patients when available."
          : "The reason is required and will be visible in the doctor's verification details."
      }
      onClose={onClose}
      closeDisabled={isSubmitting}
      tone={approving ? "default" : "danger"}
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
              approving ? "admin-btn-primary" : "admin-btn-danger"
            }`}
            onClick={() => onConfirm(approving ? "" : trimmedReason)}
            disabled={isSubmitting || !reasonValid}
          >
            {isSubmitting
              ? "Saving…"
              : approving
                ? "Approve doctor"
                : "Reject application"}
          </button>
        </>
      }
    >
      <div className="admin-confirm-target">
        <span className="admin-detail-avatar" aria-hidden="true">
          {getInitials(doctor?.name)}
        </span>
        <div className="admin-detail-identity">
          <strong>{doctor?.name || "Unnamed doctor"}</strong>
          <span>{doctor?.clinicName || "Clinic not provided"}</span>
          <div className="admin-detail-badges">
            <DoctorApprovalBadge status={doctor?.approvalStatus} />
          </div>
        </div>
      </div>

      {approving ? (
        <p className="admin-dialog-copy">
          Approving does not create or remove appointments. Existing records stay
          untouched, and pending applications receive no new bookings or
          connections until approval.
        </p>
      ) : (
        <div className="admin-review-field">
          <label htmlFor="admin-doctor-rejection-reason">
            Reason for rejection
          </label>
          <textarea
            id="admin-doctor-rejection-reason"
            className="admin-textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={DOCTOR_REJECTION_REASON_MAX}
            rows={4}
            placeholder="Explain why this application cannot be approved"
            disabled={isSubmitting}
            required
          />
          <span className="admin-review-counter">
            {trimmedReason.length}/{DOCTOR_REJECTION_REASON_MAX}
          </span>
        </div>
      )}

      {error ? (
        <div className="admin-notice admin-notice-error" role="alert">
          {reviewErrorMessage(error)}
        </div>
      ) : null}
    </AdminDialog>
  );
}
