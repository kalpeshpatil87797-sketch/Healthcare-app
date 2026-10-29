import { getAdminUser } from "../adminApi";
import {
  ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
} from "../adminConstants";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  getInitials,
} from "../format";
import { useAdminRequest } from "../useAdminRequest";
import AdminDialog from "./AdminDialog";

const fetchUserDetail = (params, options) => getAdminUser(params.id, options);

const STATUS_CHANGE_REASON = {
  self: "You cannot change your own account status.",
  admin_account: "Only the Root Owner can change an Admin account's status.",
  privileged_account: "This privileged account is protected from dashboard status changes.",
};

const STATUS_ERROR_COPY = {
  SELF_STATUS_CHANGE_FORBIDDEN: "You cannot change your own account status.",
  ROOT_OWNER_PROTECTED: "The Root Owner account cannot be changed through the dashboard.",
  PRIVILEGED_ACCOUNT_PROTECTED: "Admins cannot change another Admin account's status.",
  ACCOUNT_STATUS_CHANGED:
    "This account changed while you were updating it. Close the dialog, refresh the list, and try again.",
  ADMIN_ACTION_BUSY:
    "Another account update is already running. Wait a moment and try again.",
  ACCOUNT_SUSPENDED:
    "Your admin account was suspended. Contact the Root Owner.",
  INVALID_ACCOUNT_STATUS: "That account status is not valid.",
};

const ROLE_CHANGE_REASON = {
  self: "The Root Owner cannot change their own role.",
  root_owner_only: "Only the Root Owner can manage admin roles.",
  privileged_account: "This privileged role cannot be changed through the dashboard.",
  suspended_account: "Reactivate this account before changing its role.",
  saved_role_missing: "This Admin has no verified saved patient or doctor role. Repair it through the reviewed migration process.",
};

const ROLE_ERROR_COPY = {
  SELF_ROLE_CHANGE_FORBIDDEN: "The Root Owner cannot change their own role.",
  ROOT_OWNER_REQUIRED: "Only the Root Owner can manage admin roles.",
  ROOT_OWNER_PROTECTED: "The Root Owner role cannot be changed through the dashboard.",
  USER_ROLE_CHANGED:
    "This account role changed while you were updating it. Refresh and try again.",
  USER_ROLE_MISMATCH:
    "The account must be restored to its saved normal role.",
  ROLE_CHANGE_NOT_ALLOWED:
    "Only normal accounts can be promoted to Admin, and Admins can only be restored to their saved role.",
  LEGACY_ROLE_REQUIRES_MIGRATION:
    "This legacy account must be migrated through the explicit bootstrap process.",
  ADMIN_ROLE_MISSING:
    "This Admin has no verified saved patient or doctor role. Repair it through the reviewed migration process.",
  INVALID_USER_ROLE: "That account role is not valid.",
  ADMIN_ACTION_BUSY:
    "Another account update is running. Wait a moment and try again.",
  ACCOUNT_SUSPENDED:
    "Your admin account was suspended. Contact the Root Owner.",
};

function roleChangeErrorMessage(error) {
  if (!error) return "";
  return (
    ROLE_ERROR_COPY[error.code] ||
    error.message ||
    "The account role could not be updated. Please try again."
  );
}

export function RoleBadge({ role }) {
  const variant =
    role === "patient" || role === "doctor" || role === "admin" ||
    role === "root_owner" || role === "super_admin"
      ? role.replace(/_/g, "-")
      : "unknown";

  return (
    <span className={`admin-badge admin-badge-role-${variant}`}>
      {ROLE_LABELS[role] ?? "Unknown"}
    </span>
  );
}

export function AccountStatusBadge({ status }) {
  const suspended = status === "suspended";

  return (
    <span
      className={`admin-badge ${
        suspended ? "admin-badge-suspended" : "admin-badge-active"
      }`}
    >
      {ACCOUNT_STATUS_LABELS[status] ?? "Active"}
    </span>
  );
}

function statusChangeErrorMessage(error) {
  if (!error) return "";

  return (
    STATUS_ERROR_COPY[error.code] ||
    error.message ||
    "The account status could not be updated. Please try again."
  );
}

const DETAIL_ERROR_COPY = {
  session: "Your session expired. Reload the page and sign in again.",
  suspended: "This admin account is suspended.",
  forbidden: "You no longer have permission to view this account.",
  notFound: "This account no longer exists.",
  server: "Account details could not be loaded right now.",
  network: "Cannot reach the server. Check your connection and try again.",
  canceled: "The request was canceled. Try again.",
};

function detailErrorMessage(error) {
  return DETAIL_ERROR_COPY[error?.kind] || "Account details could not be loaded.";
}

function DetailField({ label, children, mono = false }) {
  return (
    <div className="admin-detail-field">
      <dt>{label}</dt>
      <dd className={mono ? "admin-detail-mono" : undefined}>{children ?? "—"}</dd>
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

export function UserDetailDialog({
  userId,
  canManageRoles = false,
  onClose,
  onChangeStatus,
  onChangeRole,
  onRemoveDoctor,
}) {
  const { data, error, isLoading, retry } =
    useAdminRequest(fetchUserDetail, { id: userId });

  const nextStatus = data?.accountStatus === "suspended" ? "active" : "suspended";
  const changeAllowed = Boolean(data) && data.statusChange?.allowed !== false;
  const reason = data?.statusChange?.reason
    ? STATUS_CHANGE_REASON[data.statusChange.reason]
    : null;
  const roleChangeAllowed = Boolean(data) && data.roleChange?.allowed !== false;
  const roleChangeReason = data?.roleChange?.reason
    ? ROLE_CHANGE_REASON[data.roleChange.reason]
    : null;
  const nextRole = data?.roleChange?.targetRole;
  const canRemoveDoctor = Boolean(
    data?.doctorProfile &&
    data.doctorProfile.approvalStatus === "approved" &&
    data.doctorProfile.isActive !== false
  );

  const footer = (
    <>
      <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
        Close
      </button>
      {data ? (
        <button
          type="button"
          className={`admin-btn ${
            nextStatus === "suspended"
              ? "admin-btn-danger"
              : "admin-btn-primary"
          }`}
          onClick={() => onChangeStatus(data, nextStatus)}
          disabled={!changeAllowed}
          title={!changeAllowed ? reason : undefined}
        >
          {nextStatus === "suspended" ? "Suspend account" : "Reactivate account"}
        </button>
      ) : null}
      {canManageRoles && data && nextRole ? (
        <button
          type="button"
          className={`admin-btn ${
            nextRole === "admin"
              ? "admin-btn-primary"
              : "admin-btn-danger"
          }`}
          onClick={() => onChangeRole(data, nextRole)}
          disabled={!roleChangeAllowed}
          title={!roleChangeAllowed ? roleChangeReason : undefined}
        >
          {nextRole === "admin"
            ? "Promote to Admin"
            : `Demote to ${ROLE_LABELS[nextRole] ?? nextRole}`}
        </button>
      ) : null}
      {canRemoveDoctor ? (
        <button
          type="button"
          className="admin-btn admin-btn-danger"
          onClick={() => onRemoveDoctor(data)}
        >
          Remove Doctor
        </button>
      ) : null}
    </>
  );

  return (
    <AdminDialog
      title="Account details"
      description="Review the account and its activity before changing access."
      onClose={onClose}
      footer={footer}
    >
      {isLoading ? (
        <p className="admin-dialog-loading" role="status">
          <span className="admin-gate-spinner" aria-hidden="true" />
          Loading account details…
        </p>
      ) : error ? (
        <div className="admin-dialog-error" role="alert">
          <p>{detailErrorMessage(error)}</p>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={retry}>
            Try again
          </button>
        </div>
      ) : data ? (
        <div className="admin-detail">
          <div className="admin-detail-summary">
            <span className="admin-detail-avatar" aria-hidden="true">
              {getInitials(data.name)}
            </span>
            <div className="admin-detail-identity">
              <h3>{data.name || "Unnamed account"}</h3>
              <p className="admin-cell-email">{data.email || "—"}</p>
              <div className="admin-detail-badges">
                <RoleBadge role={data.role} />
                <AccountStatusBadge status={data.accountStatus} />
              </div>
            </div>
          </div>

          {!changeAllowed && reason ? (
            <p className="admin-dialog-note">{reason}</p>
          ) : null}
          {canManageRoles && !roleChangeAllowed && roleChangeReason ? (
            <p className="admin-dialog-note">{roleChangeReason}</p>
          ) : null}

          <dl className="admin-detail-grid">
            <DetailField label="Account ID" mono>
              {data._id}
            </DetailField>
            <DetailField label="Age">{data.age ?? "—"}</DetailField>
            <DetailField label="Phone">{data.phone || "—"}</DetailField>
            <DetailField label="Joined">{formatDate(data.createdAt)}</DetailField>
            <DetailField label="Last updated">
              {formatDateTime(data.updatedAt) || "—"}
            </DetailField>
            <DetailField label="Address">{data.address || "—"}</DetailField>
          </dl>

          {data.doctorProfile ? (
            <section className="admin-detail-section" aria-label="Doctor profile">
              <h4>Doctor profile</h4>
              <dl className="admin-detail-grid">
                <DetailField label="Clinic">
                  {data.doctorProfile.clinicName || "—"}
                </DetailField>
                <DetailField label="Specialty">
                  {data.doctorProfile.specialist || "—"}
                </DetailField>
                <DetailField label="Clinic location">
                  {data.doctorProfile.clinicLocation || "—"}
                </DetailField>
                <DetailField label="Profile availability">
                  {data.doctorProfile.isAvailable === false
                    ? "Unavailable"
                    : "Available"}
                </DetailField>
                <DetailField label="Doctor profile status">
                  {data.doctorProfile.isActive === false
                    ? "Removed"
                    : data.doctorProfile.approvalStatus === "pending"
                      ? "Pending approval"
                      : data.doctorProfile.approvalStatus === "rejected"
                        ? "Rejected"
                        : "Active"}
                </DetailField>
              </dl>
            </section>
          ) : null}

          <section className="admin-detail-section" aria-label="Linked activity">
            <h4>Linked activity</h4>
            <div className="admin-detail-counts">
              <ActivityCount
                label="Appointments as patient"
                value={data.activity?.appointmentsAsPatient}
              />
              <ActivityCount
                label="Appointments as doctor"
                value={data.activity?.appointmentsAsDoctor}
              />
              <ActivityCount
                label="Patient connections"
                value={data.activity?.patientConnections}
              />
              <ActivityCount
                label="Doctor connections"
                value={data.activity?.doctorConnections}
              />
            </div>
            <p className="admin-detail-hint">
              Account status changes never delete appointments, messages, connections,
              or doctor profiles.
            </p>
          </section>
        </div>
      ) : null}
    </AdminDialog>
  );
}

export function ConfirmRemoveDoctorDialog({
  user,
  doctorProfile,
  onClose,
  onConfirm,
  isSubmitting = false,
  error = null,
}) {
  return (
    <AdminDialog
      title="Remove this doctor?"
      description="The user will lose doctor privileges, but their account and patient access will remain active."
      onClose={onClose}
      closeDisabled={isSubmitting}
      tone="danger"
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
            className="admin-btn admin-btn-danger"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Removing…" : "Remove Doctor"}
          </button>
        </>
      }
    >
      <div className="admin-confirm-target">
        <span className="admin-detail-avatar" aria-hidden="true">
          {getInitials(user?.name)}
        </span>
        <div className="admin-detail-identity">
          <strong>{user?.name || "Unnamed account"}</strong>
          <span className="admin-cell-email">{user?.email || "—"}</span>
          <span>{doctorProfile?.clinicName || "Doctor profile"}</span>
        </div>
      </div>
      <p className="admin-dialog-note" role="note">
        The doctor profile will be marked inactive and unavailable. User identity,
        patient access, appointments, messages, and connections will be preserved.
        Existing appointments are not canceled; arrange their follow-up separately.
        Doctor access can return only after a new application is submitted and approved.
      </p>
      {error ? (
        <div className="admin-notice admin-notice-error" role="alert">
          {error.message || "The doctor profile could not be removed. Please try again."}
        </div>
      ) : null}
    </AdminDialog>
  );
}

export function ConfirmStatusDialog({
  user,
  nextStatus,
  onClose,
  onConfirm,
  isSubmitting = false,
  error = null,
}) {
  const suspending = nextStatus === "suspended";

  return (
    <AdminDialog
      title={suspending ? "Suspend this account?" : "Reactivate this account?"}
      description={
        suspending
          ? "The account will be signed out immediately and blocked from protected actions."
          : "Access will be restored, and the account holder must sign in again."
      }
      onClose={onClose}
      closeDisabled={isSubmitting}
      tone={suspending ? "danger" : "default"}
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
              suspending ? "admin-btn-danger" : "admin-btn-primary"
            }`}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving…"
              : suspending
                ? "Suspend account"
                : "Reactivate account"}
          </button>
        </>
      }
    >
      <div className="admin-confirm-target">
        <span className="admin-detail-avatar" aria-hidden="true">
          {getInitials(user?.name)}
        </span>
        <div className="admin-detail-identity">
          <strong>{user?.name || "Unnamed account"}</strong>
          <span className="admin-cell-email">{user?.email || "—"}</span>
          <div className="admin-detail-badges">
            <RoleBadge role={user?.role} />
            <span aria-hidden="true">→</span>
            <AccountStatusBadge status={nextStatus} />
          </div>
        </div>
      </div>

      <p className="admin-dialog-copy">
        {suspending
          ? "Existing appointments, messages, connections, and doctor profiles are kept. The account cannot sign in, book, connect, or send messages while suspended."
          : "This account's previous sessions stay revoked. The user must sign in again to get a new session."}
      </p>

      {error ? (
        <div className="admin-notice admin-notice-error" role="alert">
          {statusChangeErrorMessage(error)}
        </div>
      ) : null}
    </AdminDialog>
  );
}

export function ConfirmRoleChangeDialog({
  user,
  nextRole,
  onClose,
  onConfirm,
  isSubmitting = false,
  error = null,
}) {
  const promoting = nextRole === "admin";

  return (
    <AdminDialog
      title={promoting ? "Promote this account to Admin?" : "Revoke Admin access?"}
      description={
        promoting
          ? "This grants operational access to user, doctor, and appointment management."
          : "This removes Admin access and restores the account's saved patient or doctor role."
      }
      onClose={onClose}
      closeDisabled={isSubmitting}
      tone={promoting ? "default" : "danger"}
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
              promoting ? "admin-btn-primary" : "admin-btn-danger"
            }`}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving…"
              : promoting
                ? "Promote to Admin"
                  : `Revoke Admin access and restore ${ROLE_LABELS[nextRole] ?? nextRole}`}
          </button>
        </>
      }
    >
      <div className="admin-confirm-target">
        <span className="admin-detail-avatar" aria-hidden="true">
          {getInitials(user?.name)}
        </span>
        <div className="admin-detail-identity">
          <strong>{user?.name || "Unnamed account"}</strong>
          <span className="admin-cell-email">{user?.email || "—"}</span>
          <div className="admin-detail-badges">
            <RoleBadge role={user?.role} />
            <span aria-hidden="true">→</span>
            <RoleBadge role={nextRole} />
          </div>
        </div>
      </div>

      <p className="admin-dialog-note" role="note">
        {promoting
          ? "Only promote a trusted, verified account. The role change is audited, active sessions are revoked, and existing healthcare records are preserved."
          : "This removes Admin access, revokes active sessions, and restores the saved role. No account or healthcare records are deleted."}
      </p>

      {error ? (
        <div className="admin-notice admin-notice-error" role="alert">
          {roleChangeErrorMessage(error)}
        </div>
      ) : null}
    </AdminDialog>
  );
}
