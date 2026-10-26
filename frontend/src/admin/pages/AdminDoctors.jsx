import { useMemo, useState } from "react";
import { getAdminDoctors, updateDoctorApproval } from "../adminApi";
import {
  AVAILABILITY_OPTIONS,
  DOCTOR_APPROVAL_OPTIONS,
  PAGE_SIZE_OPTIONS,
} from "../adminConstants";
import { formatDate, formatNumber } from "../format";
import { useAdminRequest } from "../useAdminRequest";
import { useDebouncedValue } from "../useDebouncedValue";
import Pagination from "../components/Pagination";
import {
  AdminEmptyState,
  AdminErrorState,
  TableSkeleton,
} from "../components/AdminStates";
import {
  DoctorApprovalBadge,
  DoctorDetailDialog,
  ReviewDoctorDialog,
} from "../components/DoctorDialogs";
import { SPECIALTIES } from "../../utils/specialties";

function AvailabilityBadge({ doctor }) {
  if (doctor.approvalStatus !== "approved") {
    return <span className="admin-cell-sub">Not active</span>;
  }

  const available = doctor.isAvailable !== false;

  return (
    <span
      className={`admin-badge ${
        available ? "admin-badge-available" : "admin-badge-unavailable"
      }`}
    >
      {available ? "Available" : "Unavailable"}
    </span>
  );
}

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

export default function AdminDoctors() {
  const [searchInput, setSearchInput] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [availability, setAvailability] = useState("");
  const [approval, setApproval] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  const [detailDoctorId, setDetailDoctorId] = useState(null);
  const [review, setReview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [notice, setNotice] = useState(null);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 350);

  const params = useMemo(() => {
    const next = { page, limit: pageSize, sort, order };

    if (debouncedSearch) next.search = debouncedSearch;
    if (specialty) next.specialist = specialty;
    if (availability) next.isAvailable = availability;
    if (approval) next.approvalStatus = approval;

    return next;
  }, [
    approval,
    availability,
    debouncedSearch,
    order,
    page,
    pageSize,
    sort,
    specialty,
  ]);

  const { data, meta, error, isLoading, isRefreshing, retry, refresh } =
    useAdminRequest(getAdminDoctors, params);

  const hasActiveFilters =
    searchInput.trim() !== "" ||
    specialty !== "" ||
    availability !== "" ||
    approval !== "";

  const pageOutOfRange = Boolean(
    meta && meta.page > Math.max(meta.totalPages, 1)
  );

  const columns = [
    {
      key: "name",
      label: "Doctor",
      sortable: true,
      render: (doctor) => (
        <div className="admin-cell-stack">
          <span className="admin-cell-primary">{doctor.name || "—"}</span>
          {doctor.degree ? (
            <span className="admin-cell-sub">{doctor.degree}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "clinicName",
      label: "Clinic",
      sortable: false,
      render: (doctor) => doctor.clinicName || "—",
    },
    {
      key: "specialist",
      label: "Specialty",
      sortable: true,
      render: (doctor) => doctor.specialist || "—",
    },
    {
      key: "approvalStatus",
      label: "Approval",
      sortable: false,
      render: (doctor) => (
        <DoctorApprovalBadge status={doctor.approvalStatus} />
      ),
    },
    {
      key: "isAvailable",
      label: "Availability",
      sortable: true,
      render: (doctor) => <AvailabilityBadge doctor={doctor} />,
    },
    {
      key: "clinicLocation",
      label: "Location",
      sortable: false,
      hide: "secondary",
      render: (doctor) => (
        <div className="admin-cell-stack">
          <span className="admin-cell-email">
            {doctor.clinicLocation || "—"}
          </span>
          {doctor.latitude != null && doctor.longitude != null ? (
            <span className="admin-cell-sub">Map pin saved</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "account",
      label: "Account",
      sortable: false,
      hide: "secondary",
      render: (doctor) => (
        <div className="admin-cell-stack">
          <span className="admin-cell-email">
            {doctor.linkedUser?.email || doctor.registeredBy || "—"}
          </span>
          <span className="admin-cell-sub">
            {doctor.linkedUser
              ? doctor.linkedUser.accountStatus === "suspended"
                ? "Linked account suspended"
                : "Linked account"
              : "No linked account"}
          </span>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Added",
      sortable: true,
      hide: "tertiary",
      render: (doctor) => formatDate(doctor.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (doctor) => (
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn-small"
          onClick={() => setDetailDoctorId(doctor._id)}
        >
          View
          <span className="admin-visually-hidden">
            {" "}
            {doctor.name || "doctor"}
          </span>
        </button>
      ),
    },
  ];

  function handleSearchChange(event) {
    setSearchInput(event.target.value);
    setPage(1);
  }

  function handleSpecialtyChange(event) {
    setSpecialty(event.target.value);
    setPage(1);
  }

  function handleAvailabilityChange(event) {
    setAvailability(event.target.value);
    setPage(1);
  }

  function handleApprovalChange(event) {
    setApproval(event.target.value);
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
    setSpecialty("");
    setAvailability("");
    setApproval("");
    setPage(1);
  }

  function openReview(doctor, decision) {
    setReviewError(null);
    setReview({ doctor, decision });
  }

  function closeReview() {
    if (isSubmitting) return;
    setReview(null);
    setReviewError(null);
  }

  async function handleConfirmReview(reason) {
    if (!review || isSubmitting) return;

    setIsSubmitting(true);
    setReviewError(null);

    try {
      const result = await updateDoctorApproval(
        review.doctor._id,
        review.decision,
        reason
      );
      const name = result?.doctor?.name || review.doctor.name || "Doctor";

      setNotice({
        tone: review.decision === "approved" ? "success" : "warning",
        message:
          review.decision === "approved"
            ? `${name} was approved and can now appear to patients when available.`
            : `${name}'s application was rejected. Existing records were preserved.`,
      });
      setReview(null);
      setDetailDoctorId(null);
      refresh();
    } catch (err) {
      setReviewError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  let emptyTitle = "No doctor profiles yet";
  let emptyDescription =
    "Profiles created through doctor registration will appear here for review.";
  let emptyActionLabel = null;
  let emptyAction = null;

  if (pageOutOfRange) {
    emptyTitle = "This page is empty";
    emptyDescription =
      "The doctor list changed while you were browsing. Return to the first page to continue.";
    emptyActionLabel = "Go to page 1";
    emptyAction = () => setPage(1);
  } else if (hasActiveFilters) {
    emptyTitle = "No doctors match these filters";
    emptyDescription =
      "Try a different search term, approval status, specialty, or availability, or clear the filters.";
    emptyActionLabel = "Clear filters";
    emptyAction = clearFilters;
  }

  const announcement = error
    ? "Doctors could not be loaded"
    : isLoading
      ? "Loading doctors"
      : meta
        ? meta.total === 0
          ? "No doctors found"
          : `Showing ${formatNumber(meta.total)} doctors`
        : "";

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Providers</p>
          <h1>Doctor verification</h1>
          <p className="admin-page-subtitle">
            Review pending doctor registrations, approve verified profiles, or
            reject applications with a reason. Existing records are never
            deleted.
          </p>
        </div>
        <div className="admin-page-actions">
          <span className="admin-ro-pill">Super Admin review</span>
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
          <label htmlFor="admin-doctors-search">Search</label>
          <input
            id="admin-doctors-search"
            className="admin-input"
            type="search"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search name, clinic, specialty, or email"
            autoComplete="off"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="admin-doctors-approval">Approval</label>
          <select
            id="admin-doctors-approval"
            className="admin-select"
            value={approval}
            onChange={handleApprovalChange}
          >
            {DOCTOR_APPROVAL_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="admin-doctors-specialty">Specialty</label>
          <select
            id="admin-doctors-specialty"
            className="admin-select"
            value={specialty}
            onChange={handleSpecialtyChange}
          >
            <option value="">All specialties</option>
            {SPECIALTIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="admin-doctors-availability">Availability</label>
          <select
            id="admin-doctors-availability"
            className="admin-select"
            value={availability}
            onChange={handleAvailabilityChange}
          >
            {AVAILABILITY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field admin-field-narrow">
          <label htmlFor="admin-doctors-page-size">Rows per page</label>
          <select
            id="admin-doctors-page-size"
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
            aria-label="Doctor verification table"
            tabIndex={0}
          >
            <table
              className={`admin-table admin-table-doctors${
                isRefreshing ? " is-refreshing" : ""
              }`}
              aria-busy={isLoading || isRefreshing}
            >
              <caption className="admin-visually-hidden">
                Doctor profiles with clinic, specialty, approval status,
                availability, linked account, date added, and review actions
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
                  data.map((doctor) => (
                    <tr key={doctor._id}>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={
                            column.hide ? `admin-col-${column.hide}` : undefined
                          }
                        >
                          {column.render(doctor)}
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
              itemLabel="doctors"
            />
          ) : null}
        </div>
      )}

      {detailDoctorId && !review ? (
        <DoctorDetailDialog
          doctorId={detailDoctorId}
          onClose={() => setDetailDoctorId(null)}
          onReview={openReview}
        />
      ) : null}

      {review ? (
        <ReviewDoctorDialog
          key={`${review.doctor._id}-${review.decision}`}
          doctor={review.doctor}
          decision={review.decision}
          onClose={closeReview}
          onConfirm={handleConfirmReview}
          isSubmitting={isSubmitting}
          error={reviewError}
        />
      ) : null}
    </div>
  );
}
