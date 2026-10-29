import { useLocation } from "react-router-dom";
import { getAdminRoleLabel } from "../adminConstants";
import { getInitials } from "../format";

const PAGE_TITLES = {
  "/admin": "Overview",
  "/admin/users": "Users",
  "/admin/doctors": "Doctor verification",
  "/admin/appointments": "Appointments",
};

export default function AdminTopbar({
  onMenuClick,
  menuExpanded,
  menuButtonRef,
  adminUser,
  onSignOut,
}) {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? "Admin console";
  const roleLabel = getAdminRoleLabel(adminUser?.role);

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <button
          ref={menuButtonRef}
          type="button"
          className="admin-menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation"
          aria-expanded={menuExpanded}
          aria-controls="admin-sidebar"
        >
          ☰
        </button>
        <div className="admin-topbar-heading">
          <p className="admin-topbar-eyebrow">{roleLabel}</p>
          <span className="admin-topbar-title">{title}</span>
        </div>
      </div>

      <div className="admin-topbar-right">
        <span className="admin-role-pill">{roleLabel}</span>
        <span className="admin-avatar admin-avatar-sm" aria-hidden="true">
          {getInitials(adminUser?.name)}
        </span>
        <span className="admin-topbar-name">
          {adminUser?.name || "Administrator"}
        </span>
        <button
          type="button"
          className="admin-signout admin-signout-topbar"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
