import axios from "axios";

const API_BASE = "http://localhost:8001";
const TOKEN_KEY = "token";
const REQUEST_TIMEOUT_MS = 15000;
export const ADMIN_ACCESS_INVALID_EVENT = "admin:access-invalid";

export class AdminRequestError extends Error {
  constructor(kind, { message, code, status } = {}) {
    super(message || kind);
    this.name = "AdminRequestError";
    this.kind = kind;
    this.code = code ?? null;
    this.status = status ?? null;
  }
}

function toAdminError(error) {
  if (error instanceof AdminRequestError) return error;
  if (axios.isCancel(error)) return new AdminRequestError("canceled");

  const status = error?.response?.status;
  const payload = error?.response?.data;
  const code = typeof payload?.code === "string" ? payload.code : null;
  const message = typeof payload?.error === "string" ? payload.error : null;
  const details = { status, code, message };

  if (code === "ACCOUNT_SUSPENDED") {
    return new AdminRequestError("suspended", details);
  }
  if (code === "SESSION_REVOKED") {
    return new AdminRequestError("session", details);
  }
  if (status === 400) return new AdminRequestError("invalid", details);
  if (status === 401) return new AdminRequestError("session", details);
  if (status === 403) return new AdminRequestError("forbidden", details);
  if (status === 404) return new AdminRequestError("notFound", details);
  if (status === 409) return new AdminRequestError("conflict", details);
  if (status === 503) return new AdminRequestError("busy", details);
  if (typeof status === "number" && status >= 500) {
    return new AdminRequestError("server", details);
  }

  return new AdminRequestError("network", details);
}

async function request(path, { method = "get", params, body, signal } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new AdminRequestError("session");
  }

  try {
    const response = await axios.request({
      url: `${API_BASE}${path}`,
      method,
      params,
      data: body,
      signal,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.data;
  } catch (error) {
    const adminError = toAdminError(error);
    if (
      adminError.kind === "session" ||
      adminError.kind === "suspended" ||
      (adminError.kind === "forbidden" && adminError.code === "FORBIDDEN")
    ) {
      window.dispatchEvent(
        new CustomEvent(ADMIN_ACCESS_INVALID_EVENT, {
          detail: { kind: adminError.kind },
        })
      );
    }
    throw adminError;
  }
}

export function getAdminStats({ signal } = {}) {
  return request("/admin/stats", { signal });
}

export function getAdminUsers(params, { signal } = {}) {
  return request("/admin/users", { params, signal });
}

export function getAdminUser(id, { signal } = {}) {
  return request(`/admin/users/${id}`, { signal });
}

export function updateUserStatus(id, status, { signal } = {}) {
  return request(`/admin/users/${id}/status`, {
    method: "patch",
    body: { status },
    signal,
  });
}

export function updateUserRole(id, role, { signal } = {}) {
  return request(`/admin/users/${id}/role`, {
    method: "patch",
    body: { role },
    signal,
  });
}

export function getAdminDoctors(params, { signal } = {}) {
  return request("/admin/doctors", { params, signal });
}

export function getAdminAppointments(params, { signal } = {}) {
  return request("/admin/appointments", { params, signal });
}

export function updateAppointmentStatus(id, status, { signal } = {}) {
  return request(`/admin/appointments/${id}/status`, {
    method: "patch",
    body: { status },
    signal,
  });
}

export function getAdminDoctor(id, { signal } = {}) {
  return request(`/admin/doctors/${id}`, { signal });
}

export function updateDoctorApproval(id, status, reason, { signal } = {}) {
  const body = { status };
  if (status === "rejected") body.reason = reason;

  return request(`/admin/doctors/${id}/approval`, {
    method: "patch",
    body,
    signal,
  });
}

export function removeDoctorProfile(id, { signal } = {}) {
  return request(`/admin/doctors/${id}/remove`, {
    method: "patch",
    body: {},
    signal,
  });
}

export function getCurrentUser({ signal } = {}) {
  return request("/user/me", { signal });
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}
