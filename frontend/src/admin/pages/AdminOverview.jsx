import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_ORDER,
} from "../adminConstants";
import { getAdminStats } from "../adminApi";
import { formatDateTime, formatNumber, getPercent } from "../format";
import { useAdminRequest } from "../useAdminRequest";
import StatCard from "../components/StatCard";
import { AdminErrorState } from "../components/AdminStates";

const STATS_PARAMS = {};

function OverviewSkeleton() {
  return (
    <div className="admin-page-stack" role="status" aria-label="Loading overview statistics">
      <div className="admin-kpi-grid">
        {[0, 1, 2, 3].map((key) => (
          <div className="admin-stat-card" key={key}>
            <span className="admin-skeleton-line" style={{ width: "48%" }} />
            <span
              className="admin-skeleton-line admin-skeleton-value"
              style={{ width: "62%" }}
            />
            <span className="admin-skeleton-line" style={{ width: "72%" }} />
          </div>
        ))}
      </div>

      <div className="admin-panel-grid">
        {[0, 1].map((key) => (
          <div className="admin-panel" key={key}>
            <span className="admin-skeleton-line" style={{ width: "38%" }} />
            <span
              className="admin-skeleton-line admin-skeleton-value"
              style={{ width: "55%" }}
            />
            <span className="admin-skeleton-line" style={{ width: "92%" }} />
            <span
              className="admin-skeleton-line"
              style={{ width: "76%", marginTop: "12px" }}
            />
          </div>
        ))}
      </div>

      <span className="admin-visually-hidden">Loading overview statistics</span>
    </div>
  );
}

function OverviewContent({ data }) {
  const users = data.users ?? {};
  const roles = users.byRole ?? {};
  const doctors = data.doctors ?? {};
  const appointments = data.appointments ?? {};
  const statuses = appointments.byStatus ?? {};

  const usersTotal = users.total ?? 0;
  const patients = roles.patient ?? 0;
  const doctorAccounts = roles.doctor ?? 0;
  const admins = roles.admin ?? 0;
  const rootOwners = roles.root_owner ?? 0;

  const doctorProfiles = doctors.totalProfiles ?? 0;
  const availableDoctors = doctors.available ?? 0;
  const unavailableDoctors = doctors.unavailable ?? 0;
  const availabilityRate = getPercent(availableDoctors, doctorProfiles);

  const appointmentsTotal = appointments.total ?? 0;

  return (
    <div className="admin-page-stack">
      <div className="admin-kpi-grid">
        <StatCard
          label="Total users"
          value={usersTotal}
          helper="All registered accounts"
          accent="teal"
        />
        <StatCard
          label="Patients"
          value={patients}
          helper="Accounts with the patient role"
          accent="blue"
        />
        <StatCard
          label="Doctor accounts"
          value={doctorAccounts}
          helper="Accounts with the doctor role"
          accent="navy"
        />
        <StatCard
          label="Admin accounts"
          value={admins + rootOwners}
          helper={`${admins} Admin${admins === 1 ? "" : "s"} · ${rootOwners} Root Owner${rootOwners === 1 ? "" : "s"}`}
          accent="amber"
        />
      </div>

      <div className="admin-panel-grid">
        <section className="admin-panel" aria-labelledby="doctor-profiles-heading">
          <header className="admin-panel-header">
            <div>
              <h2 id="doctor-profiles-heading">Doctor profiles</h2>
              <p>Registration records, separate from doctor login accounts.</p>
            </div>
            <span className="admin-panel-total">
              {formatNumber(doctorProfiles)}
            </span>
          </header>

          <div className="admin-panel-body">
            <div className="admin-mini-stats">
              <div className="admin-mini-stat">
                <p className="admin-mini-label">Available</p>
                <p className="admin-mini-value">
                  {formatNumber(availableDoctors)}
                </p>
              </div>
              <div className="admin-mini-stat">
                <p className="admin-mini-label">Unavailable</p>
                <p className="admin-mini-value">
                  {formatNumber(unavailableDoctors)}
                </p>
              </div>
              <div className="admin-mini-stat">
                <p className="admin-mini-label">Availability</p>
                <p className="admin-mini-value">{availabilityRate}%</p>
              </div>
            </div>

            <div className="admin-meter" aria-hidden="true">
              <span
                className="admin-meter-fill"
                style={{ width: `${availabilityRate}%` }}
              />
            </div>

            <p className="admin-panel-note">
              {doctorProfiles === 0
                ? "No doctor profiles recorded yet."
                : `${formatNumber(availableDoctors)} of ${formatNumber(
                    doctorProfiles
                  )} profiles are currently marked available.`}
            </p>
          </div>
        </section>

        <section className="admin-panel" aria-labelledby="appointments-heading">
          <header className="admin-panel-header">
            <div>
              <h2 id="appointments-heading">Appointments by status</h2>
              <p>Every status defined by the appointment schema.</p>
            </div>
            <span className="admin-panel-total">
              {formatNumber(appointmentsTotal)}
            </span>
          </header>

          <div className="admin-panel-body">
            <div className="admin-status-list">
              {APPOINTMENT_STATUS_ORDER.map((status) => {
                const count = statuses[status] ?? 0;
                const percent = getPercent(count, appointmentsTotal);
                const statusClass = status.replace(/_/g, "-");

                return (
                  <div className="admin-status-row" key={status}>
                    <span className="admin-status-name">
                      <span
                        className={`admin-status-dot admin-status-dot-${statusClass}`}
                        aria-hidden="true"
                      />
                      {APPOINTMENT_STATUS_LABELS[status] ?? status}
                    </span>
                    <span className="admin-status-track" aria-hidden="true">
                      <span
                        className={`admin-status-fill admin-status-fill-${statusClass}`}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="admin-status-value">
                      {formatNumber(count)}
                      <span className="admin-status-percent">{percent}%</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {appointmentsTotal === 0 ? (
              <p className="admin-panel-note">No appointments recorded yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { data, error, isLoading, retry } = useAdminRequest(
    getAdminStats,
    STATS_PARAMS
  );

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Dashboard</p>
          <h1>Overview</h1>
          <p className="admin-page-subtitle">
            Live totals from the platform. Statistics are read directly from the
            admin API and are never estimated.
          </p>
        </div>

        <div className="admin-page-actions">
          {data?.generatedAt ? (
            <span className="admin-timestamp">
              Updated {formatDateTime(data.generatedAt)}
            </span>
          ) : null}
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={retry}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
      </header>

      {isLoading ? (
        <OverviewSkeleton />
      ) : error ? (
        <AdminErrorState error={error} onRetry={retry} />
      ) : data ? (
        <OverviewContent data={data} />
      ) : (
        <AdminErrorState error={null} onRetry={retry} />
      )}
    </div>
  );
}
