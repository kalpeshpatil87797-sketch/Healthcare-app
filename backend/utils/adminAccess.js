const ADMIN_DASHBOARD_ROLES = ["root_owner", "admin"];

function canAccessAdminDashboard(role) {
  return ADMIN_DASHBOARD_ROLES.includes(role);
}

module.exports = { ADMIN_DASHBOARD_ROLES, canAccessAdminDashboard };
