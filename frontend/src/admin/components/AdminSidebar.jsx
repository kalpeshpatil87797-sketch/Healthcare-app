import { NavLink } from "react-router-dom";
import { ADMIN_NAV_ITEMS, getAdminRoleLabel } from "../adminConstants";
import { getInitials } from "../format";

function NavIcon({ name }) {
  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17.5 14.5a5 5 0 0 1 4 4.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "doctors") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <path
          d="M6 3v5.5a4 4 0 0 0 8 0V3M10 12.5V15a5 5 0 0 0 5 5h.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="19" cy="20" r="2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }

  if (name === "appointments") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 13h3M8 16.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export default function AdminSidebar({
  open,
  onClose,
  onNavigate,
  adminUser,
  onSignOut,
}) {
  const roleLabel = getAdminRoleLabel(adminUser?.role);
  return (
    <>
      {open ? (
        <div
          className="admin-sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={`admin-sidebar${open ? " is-open" : ""}`}
        aria-label="Admin navigation"
      >
        <div className="admin-sidebar-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            +
          </span>
          <span className="admin-brand-text">
            <span className="admin-brand-name">Healthcare</span>
            <span className="admin-brand-subtitle">{roleLabel} console</span>
          </span>
          <button
            type="button"
            className="admin-sidebar-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin sections">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? " is-active" : ""}`
              }
            >
              <span className="admin-nav-icon" aria-hidden="true">
                <NavIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <p className="admin-sidebar-note">Accounts, doctors &amp; appointments</p>
          <div className="admin-sidebar-user">
            <span className="admin-avatar" aria-hidden="true">
              {getInitials(adminUser?.name)}
            </span>
            <span className="admin-sidebar-user-text">
              <strong>{adminUser?.name || "Administrator"}</strong>
              <span>{adminUser?.email || adminUser?.role || "Administrator"}</span>
            </span>
          </div>
          <button type="button" className="admin-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
