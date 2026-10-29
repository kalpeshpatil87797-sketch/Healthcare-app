import { useMemo, useState } from "react";
import {
  getAdminAppointments,
  updateAppointmentStatus,
} from "../adminApi";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_OPTIONS,
  PAGE_SIZE_OPTIONS,
} from "../adminConstants";
import {
  formatCalendarDate,
  formatDateTime,
  formatNumber,
} from "../format";
import { useAdminRequest } from "../useAdminRequest";
import { useDebouncedValue } from "../useDebouncedValue";
import Pagination from "../components/Pagination";
import {
  AdminEmptyState,
  AdminErrorState,
  TableSkeleton,
} from "../components/AdminStates";
import {
  AppointmentDetailDialog,
  AppointmentStatusBadge,
  ConfirmAppointmentStatusDialog,
} from "../components/AppointmentDialogs";

function SortIndicator({ active, order }) {
  return (
    <span
      className={`admin-sort-indicator${active ? " is-active" : ""}`}
      aria-hidden="true"
    >
      {active ? (order === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
}

export default function AdminAppointments() {
  const [searchInput, setSearchInput] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  const [detailAppointment, setDetailAppointment] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changeError, setChangeError] = useState(null);
  const [notice, setNotice] = useState(null);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 350);

  const params = useMemo(() => {
    const next = { page, limit: pageSize, sort, order };

    if (debouncedSearch) next.search = debouncedSearch;
    if (appointmentStatus) next.status = appointmentStatus;

    return next;
  }, [appointmentStatus, debouncedSearch, order, page, pageSize, sort]);

  const { data, meta, error, isLoading, isRefreshing, retry, refresh } =
    useAdminRequest(getAdminAppointments, params);

  const hasActiveFilters =
    searchInput.trim() !== "" || appointmentStatus !== "";
  const pageOutOfRange = Boolean(
    meta && meta.page > Math.max(meta.totalPages, 1)
  );

  const columns = [
    {
      key: "patient",
      label: "Patient",
      sortable: false,
      render: (appointment) => (
        <div className="admin-cell-stack">
          <span className="admin-cell-primary">
            {appointment.patient?.name || "Record unavailable"}
          </span>
          <span className="admin-cell-email">
            {appointment.patient?.email || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "doctor",
      label: "Doctor",
      sortable: false,
      render: (appointment) => {
        const detail = [
          appointment.doctor?.specialist,
          appointment.doctor?.clinicName,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <div className="admin-cell-stack">
            <span className="admin-cell-primary">
              {appointment.doctor?.name || "Record unavailable"}
            </span>
            {detail ? <span className="admin-cell-sub">{detail}</span> : null}
          </div>
        );
      },
    },
    {
      key: "appointmentDate",
      label: "Schedule",
      sortable: true,
      render: (appointment) => (
        <div className="admin-cell-stack">
          <span className="admin-cell-primary">
            {formatCalendarDate(appointment.appointmentDate)}
          </span>
          <span className="admin-cell-sub">
            {appointment.appointmentTime || "—"}
          </span>
          {appointment.alternateDate || appointment.alternateTime ? (
            <span className="admin-cell-sub">
              Alternate: {formatCalendarDate(appointment.alternateDate)} at{" "}
              {appointment.alternateTime || "—"}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (appointment) => (
        <AppointmentStatusBadge status={appointment.status} />
      ),
    },
    {
      key: "createdAt",
      label: "Requested",
      sortable: true,
      hide: "tertiary",
      render: (appointment) =>
        formatDateTime(appointment.requestedAt) || "—",
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (appointment) => (
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn-small"
          onClick={() => setDetailAppointment(appointment)}
        >
          Manage
          <span className="admin-visually-hidden">
            {" "}
            appointment for {appointment.patient?.name || "patient"}
          </span>
        </button>
      ),
    },
  ];

  function handleSearchChange(event) {
    setSearchInput(event.target.value);
    setPage(1);
  }

  function handleStatusChange(event) {
    setAppointmentStatus(event.target.value);
    setPage(1);
  }

  function handlePageSizeChange(event) {
    setPageSize(Number(event.target.value));
    setPage(1);
  }

  function handleSort(field) {
    if (field === sort) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }

    setPage(1);
  }

  function handlePageChange(nextPage) {
    setPage(Math.max(1, nextPage));
  }

  function clearFilters() {
    setSearchInput("");
    setAppointmentStatus("");
    setPage(1);
  }

  function openStatusChange(appointment, nextStatus) {
    setChangeError(null);
    setPendingChange({ appointment, nextStatus });
  }

  function closeStatusChange() {
    if (isSubmitting) return;
    setPendingChange(null);
    setChangeError(null);
  }

  async function handleConfirmStatusChange() {
    if (!pendingChange || isSubmitting) return;

    setIsSubmitting(true);
    setChangeError(null);

    try {
      const response = await updateAppointmentStatus(
        pendingChange.appointment._id,
        pendingChange.nextStatus
      );
      const patientName =
        pendingChange.appointment.patient?.name || "The patient";
      const statusLabel =
        APPOINTMENT_STATUS_LABELS[pendingChange.nextStatus] ??
        pendingChange.nextStatus;

      setNotice({
        tone:
          pendingChange.nextStatus === "accepted" ? "success" : "warning",
        message: `Appointment for ${patientName} was marked ${statusLabel.toLowerCase()}. ${
          response.notificationWarning ||
          "The chat card was updated and no records were deleted."
        }`,
      });
      setPendingChange(null);
      setDetailAppointment(null);
      refresh();
    } catch (err) {
      setChangeError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  let emptyTitle = "No appointments yet";
  let emptyDescription =
    "Patient requests will appear here with their patient, doctor, schedule, and current status.";
  let emptyActionLabel = null;
  let emptyAction = null;

  if (pageOutOfRange) {
    emptyTitle = "This page is empty";
    emptyDescription =
      "The appointment list changed while you were browsing. Return to the first page to continue.";
    emptyActionLabel = "Go to page 1";
    emptyAction = () => setPage(1);
  } else if (hasActiveFilters) {
    emptyTitle = "No appointments match these filters";
    emptyDescription =
      "Try a different search term or status, or clear the filters to see every appointment.";
    emptyActionLabel = "Clear filters";
    emptyAction = clearFilters;
  }

  const announcement = error
    ? "Appointments could not be loaded"
    : isLoading
      ? "Loading appointments"
      : meta
        ? meta.total === 0
          ? "No appointments found"
          : `Showing ${formatNumber(meta.total)} appointments`
        : "";

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h1>Appointments</h1>
          <p className="admin-page-subtitle">
            Search and review every appointment, then apply only the status
            changes supported by the patient and doctor workflows. Records are
            never deleted.
          </p>
        </div>
        <div className="admin-page-actions">
          <span className="admin-ro-pill">Appointment status</span>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={refresh}
            disabled={isLoading || isRefreshing}
          >
            Refresh
          </button>
        </div>
      </header>

      <p className="admin-visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {notice ? (
        <div
          className={`admin-notice admin-notice-${notice.tone}`}
          role="status"
        >
          <span>{notice.message}</span>
          <button
            type="button"
            className="admin-notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="admin-toolbar">
        <div className="admin-field admin-field-search">
          <label htmlFor="admin-appointments-search">Search</label>
          <input
            id="admin-appointments-search"
            className="admin-input"
            type="search"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search patient, doctor, clinic, email, or date"
            autoComplete="off"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="admin-appointments-status">Status</label>
          <select
            id="admin-appointments-status"
            className="admin-select"
            value={appointmentStatus}
            onChange={handleStatusChange}
          >
            {APPOINTMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field admin-field-narrow">
          <label htmlFor="admin-appointments-page-size">Rows per page</label>
          <select
            id="admin-appointments-page-size"
            className="admin-select"
            value={pageSize}
            onChange={handlePageSizeChange}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-toolbar-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Clear filters
          </button>
        </div>
      </div>

      {error ? (
        <AdminErrorState
          error={error}
          onRetry={retry}
          onResetFilters={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="admin-card admin-table-card">
          <div
            className={`admin-table-scroll${
              isRefreshing ? " is-refreshing" : ""
            }`}
            role="region"
            aria-label="Appointments table"
            tabIndex={0}
          >
            <table
              className={`admin-table admin-table-appointments${
                isRefreshing ? " is-refreshing" : ""
              }`}
              aria-busy={isLoading || isRefreshing}
            >
              <caption className="admin-visually-hidden">
                Appointments with patient, doctor, schedule, status, request
                time, and management actions
              </caption>
              <thead>
                <tr>
                  {columns.map((column) => {
                    const ariaSort =
                      sort === column.key
                        ? order === "asc"
                          ? "ascending"
                          : "descending"
                        : "none";

                    return (
                      <th
                        key={column.key}
                        scope="col"
                        className={
                          column.hide ? `admin-col-${column.hide}` : undefined
                        }
                        aria-sort={column.sortable ? ariaSort : undefined}
                      >
                        {column.sortable ? (
                          <button
                            type="button"
                            className="admin-sort-btn"
                            onClick={() => handleSort(column.key)}
                          >
                            {column.label}
                            <SortIndicator
                              active={sort === column.key}
                              order={order}
                            />
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton
                    rows={6}
                    columns={columns.length}
                    columnHides={columns.map((column) => column.hide)}
                  />
                ) : data && data.length > 0 ? (
                  data.map((appointment) => (
                    <tr key={appointment._id}>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={
                            column.hide
                              ? `admin-col-${column.hide}`
                              : undefined
                          }
                        >
                          {column.render(appointment)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="admin-table-message"
                    >
                      <AdminEmptyState
                        title={emptyTitle}
                        description={emptyDescription}
                        actionLabel={emptyActionLabel}
                        onAction={emptyAction}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && meta && !pageOutOfRange ? (
            <Pagination
              meta={meta}
              onPageChange={handlePageChange}
              disabled={isRefreshing}
              itemLabel="appointments"
            />
          ) : null}
        </div>
      )}

      {detailAppointment && !pendingChange ? (
        <AppointmentDetailDialog
          appointment={detailAppointment}
          onClose={() => setDetailAppointment(null)}
          onChangeStatus={openStatusChange}
        />
      ) : null}

      {pendingChange ? (
        <ConfirmAppointmentStatusDialog
          key={`${pendingChange.appointment._id}-${pendingChange.nextStatus}`}
          appointment={pendingChange.appointment}
          nextStatus={pendingChange.nextStatus}
          onClose={closeStatusChange}
          onConfirm={handleConfirmStatusChange}
          isSubmitting={isSubmitting}
          error={changeError}
        />
      ) : null}
    </div>
  );
}
