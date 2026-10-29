export const SUPER_ADMIN_ROLE = "super_admin";
export const ROOT_OWNER_ROLE = "root_owner";

export function getAdminRoleLabel(role) {
  return role === ROOT_OWNER_ROLE ? "Root Owner" : "Super Admin";
}

export const ROLE_LABELS = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Admin",
  root_owner: "Root Owner",
  super_admin: "Super admin",
};

export const USER_ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "patient", label: "Patients" },
  { value: "doctor", label: "Doctors" },
  { value: "admin", label: "Admins" },
  { value: "root_owner", label: "Root Owners" },
  { value: "super_admin", label: "Super admins" },
];

export const ACCOUNT_STATUS_LABELS = {
  active: "Active",
  suspended: "Suspended",
};

export const ACCOUNT_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export const PAGE_SIZE_OPTIONS = [20, 50, 100];

export const USER_SORT_FIELDS = ["createdAt", "name", "email", "role"];
export const DOCTOR_SORT_FIELDS = ["createdAt", "name", "specialist", "isAvailable"];

export const APPOINTMENT_STATUS_ORDER = [
  "pending",
  "accepted",
  "alternate_requested",
  "rejected",
  "cancelled",
  "completed",
];

export const APPOINTMENT_STATUS_LABELS = {
  pending: "Pending",
  accepted: "Confirmed",
  alternate_requested: "Alternate requested",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const APPOINTMENT_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...APPOINTMENT_STATUS_ORDER.map((status) => ({
    value: status,
    label: APPOINTMENT_STATUS_LABELS[status],
  })),
];

export const APPOINTMENT_TRANSITION_LABELS = {
  accepted: "Confirm appointment",
  rejected: "Reject appointment",
  cancelled: "Cancel appointment",
  completed: "Mark completed",
};

export const AVAILABILITY_OPTIONS = [
  { value: "", label: "All availability" },
  { value: "true", label: "Available" },
  { value: "false", label: "Unavailable" },
];

export const DOCTOR_APPROVAL_LABELS = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export const DOCTOR_APPROVAL_OPTIONS = [
  { value: "", label: "All approvals" },
  { value: "pending", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export const DOCTOR_REJECTION_REASON_MAX = 500;

export const ADMIN_NAV_ITEMS = [
  { to: "/admin", label: "Overview", icon: "overview", end: true },
  { to: "/admin/users", label: "Users", icon: "users", end: false },
  { to: "/admin/doctors", label: "Verification", icon: "doctors", end: false },
  { to: "/admin/appointments", label: "Appointments", icon: "appointments", end: false },
];
