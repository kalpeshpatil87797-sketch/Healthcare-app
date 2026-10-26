import { useNavigate } from "react-router-dom";
import { clearSession } from "../adminApi";

const ERROR_COPY = {
  session: {
    title: "Your session has expired",
    description: "Sign in again to continue to the admin console.",
    action: "Sign in again",
  },
  forbidden: {
    title: "Access denied",
    description:
      "This area is restricted to Super Administrators. Sign in with an authorized account to continue.",
    action: "Sign in with another account",
  },
  invalid: {
    title: "Those filters are not valid",
    description: "Reset the filters and try again.",
    action: "Reset filters",
  },
  notFound: {
    title: "That record was not found",
    description: "It may have been removed or changed. Refresh the list to continue.",
    action: "Try again",
  },
  conflict: {
    title: "This record changed",
    description: "Someone else updated it first. Refresh the list and try again.",
    action: "Try again",
  },
  busy: {
    title: "Another update is in progress",
    description: "A status change is already running. Wait a moment and try again.",
    action: "Try again",
  },
  suspended: {
    title: "This account is suspended",
    description: "Contact another Super Admin to restore access.",
    action: "Sign in again",
  },
  server: {
    title: "Something went wrong",
    description: "The admin data could not be loaded right now. Please try again.",
    action: "Try again",
  },
  network: {
    title: "Cannot reach the server",
    description: "Check your connection and try again.",
    action: "Try again",
  },
  canceled: {
    title: "Request canceled",
    description: "The request was canceled before it finished. Please try again.",
    action: "Try again",
  },
};

function StateIcon({ variant }) {
  return (
    <span
      className={`admin-state-icon admin-state-icon-${variant}`}
      aria-hidden="true"
    >
      {variant === "error" ? "!" : "—"}
    </span>
  );
}

export function AdminErrorState({ error, onRetry, onResetFilters }) {
  const navigate = useNavigate();
  const kind = error?.kind ?? "network";
  const copy = ERROR_COPY[kind] ?? ERROR_COPY.network;
  const isAuthError =
    kind === "session" || kind === "forbidden" || kind === "suspended";
  const showReset = kind === "invalid" && typeof onResetFilters === "function";

  function handleAuthAction() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin-state admin-state-error" role="alert">
      <StateIcon variant="error" />
      <div className="admin-state-body">
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      <div className="admin-state-actions">
        {isAuthError ? (
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleAuthAction}
          >
            {copy.action}
          </button>
        ) : showReset ? (
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={onResetFilters}
          >
            Reset filters
          </button>
        ) : (
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={onRetry}
          >
            {copy.action}
          </button>
        )}
        {showReset && onRetry ? (
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="admin-state admin-state-empty">
      <StateIcon variant="empty" />
      <div className="admin-state-body">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <div className="admin-state-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 6, columnHides = [] }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="admin-skeleton-row" aria-hidden="true">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td
              key={columnIndex}
              className={
                columnHides[columnIndex]
                  ? `admin-col-${columnHides[columnIndex]}`
                  : undefined
              }
            >
              <span
                className="admin-skeleton-line"
                style={{
                  width: `${55 + ((rowIndex + columnIndex) % 4) * 12}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminGateLoader() {
  return (
    <div className="admin-shell admin-gate">
      <div className="admin-gate-card" role="status" aria-live="polite">
        <span className="admin-brand-mark" aria-hidden="true">
          +
        </span>
        <span className="admin-gate-spinner" aria-hidden="true" />
        <h1 className="admin-gate-title">Checking admin access</h1>
        <p className="admin-gate-text">
          Verifying your account with the server. This only takes a moment.
        </p>
      </div>
    </div>
  );
}

export function AdminGateError({ onRetry, onSignOut }) {
  return (
    <div className="admin-shell admin-gate">
      <div className="admin-gate-card" role="alert">
        <span className="admin-brand-mark" aria-hidden="true">
          +
        </span>
        <h1 className="admin-gate-title">Could not verify admin access</h1>
        <p className="admin-gate-text">
          The admin console could not reach the server. Check your connection and
          try again.
        </p>
        <div className="admin-gate-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={onRetry}
          >
            Try again
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
