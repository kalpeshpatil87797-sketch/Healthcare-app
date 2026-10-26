import { useMemo, useState } from "react";
import { getAdminUsers, updateUserStatus } from "../adminApi";
import {
  ACCOUNT_STATUS_OPTIONS,
  PAGE_SIZE_OPTIONS,
  USER_ROLE_OPTIONS,
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
  AccountStatusBadge,
  ConfirmStatusDialog,
  RoleBadge,
  UserDetailDialog,
} from "../components/UserDialogs";

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

export default function AdminUsers() {
  const [searchInput, setSearchInput] = useState("");
  const [role, setRole] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  const [detailUserId, setDetailUserId] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changeError, setChangeError] = useState(null);
  const [notice, setNotice] = useState(null);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 350);

  const params = useMemo(() => {
    const next = { page, limit: pageSize, sort, order };

    if (debouncedSearch) next.search = debouncedSearch;
    if (role) next.role = role;
    if (accountStatus) next.accountStatus = accountStatus;

    return next;
  }, [accountStatus, debouncedSearch, order, page, pageSize, role, sort]);

  const { data, meta, error, isLoading, isRefreshing, retry, refresh } =
    useAdminRequest(getAdminUsers, params);

  const hasActiveFilters =
    searchInput.trim() !== "" || role !== "" || accountStatus !== "";
  const pageOutOfRange = Boolean(
    meta && meta.page > Math.max(meta.totalPages, 1)
  );

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (user) => (
        <span className="admin-cell-primary">{user.name || "—"}</span>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (user) => (
        <span className="admin-cell-email">{user.email || "—"}</span>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: "accountStatus",
      label: "Status",
      sortable: false,
      render: (user) => <AccountStatusBadge status={user.accountStatus} />,
    },
    {
      key: "age",
      label: "Age",
      sortable: false,
      hide: "secondary",
      render: (user) => user.age ?? "—",
    },
    {
      key: "phone",
      label: "Phone",
      sortable: false,
      hide: "secondary",
      render: (user) => user.phone || "—",
    },
    {
      key: "createdAt",
      label: "Joined",
      sortable: true,
      hide: "tertiary",
      render: (user) => formatDate(user.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (user) => (
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn-small"
          onClick={() => setDetailUserId(user._id)}
        >
          View
          <span className="admin-visually-hidden"> {user.name || "account"}</span>
        </button>
      ),
    },
  ];

  function handleSearchChange(event) {
    setSearchInput(event.target.value);
    setPage(1);
  }

  function handleRoleChange(event) {
    setRole(event.target.value);
    setPage(1);
  }

  function handleAccountStatusChange(event) {
    setAccountStatus(event.target.value);
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
    setRole("");
    setAccountStatus("");
    setPage(1);
  }

  function closeChangeDialog() {
    if (isSubmitting) return;
    setPendingChange(null);
    setChangeError(null);
  }

  async function handleConfirmStatusChange() {
    if (!pendingChange || isSubmitting) return;

    setIsSubmitting(true);
    setChangeError(null);

    try {
      const result = await updateUserStatus(
        pendingChange.user._id,
        pendingChange.nextStatus
      );
      const name = result?.user?.name || pendingChange.user.name || "Account";
      const suspended = pendingChange.nextStatus === "suspended";

      setNotice({
        tone: suspended ? "warning" : "success",
        message: suspended
          ? `${name} was suspended and signed out. Existing records were kept.`
          : `${name} was reactivated. They must sign in again.`,
      });
      setPendingChange(null);
      setDetailUserId(null);
      refresh();
    } catch (err) {
      setChangeError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  let emptyTitle = "No users yet";
  let emptyDescription =
    "Patient, doctor, and admin accounts will appear here once they register.";
  let emptyActionLabel = null;
  let emptyAction = null;

  if (pageOutOfRange) {
    emptyTitle = "This page is empty";
    emptyDescription =
      "The user list changed while you were browsing. Return to the first page to continue.";
    emptyActionLabel = "Go to page 1";
    emptyAction = () => setPage(1);
  } else if (hasActiveFilters) {
    emptyTitle = "No users match these filters";
    emptyDescription =
      "Try a different search term, role, or account status, or clear the filters to see every account.";
    emptyActionLabel = "Clear filters";
    emptyAction = clearFilters;
  }

  const announcement = error
    ? "Users could not be loaded"
    : isLoading
      ? "Loading users"
      : meta
        ? meta.total === 0
          ? "No users found"
          : `Showing ${formatNumber(meta.total)} users`
        : "";

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">People</p>
          <h1>Users</h1>
          <p className="admin-page-subtitle">
            Search and review every registered account, then suspend or reactivate
            access when needed. Suspending keeps all healthcare records intact.
          </p>
        </div>
        <div className="admin-page-actions">
          <span className="admin-ro-pill">Account status</span>
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
          <label htmlFor="admin-users-search">Search</label>
          <input
            id="admin-users-search"
            className="admin-input"
            type="search"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search by name or email"
            autoComplete="off"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="admin-users-role">Role</label>
          <select
            id="admin-users-role"
            className="admin-select"
            value={role}
            onChange={handleRoleChange}
          >
            {USER_ROLE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="admin-users-status">Status</label>
          <select
            id="admin-users-status"
            className="admin-select"
            value={accountStatus}
            onChange={handleAccountStatusChange}
          >
            {ACCOUNT_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field admin-field-narrow">
          <label htmlFor="admin-users-page-size">Rows per page</label>
          <select
            id="admin-users-page-size"
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
            aria-label="Users table"
            tabIndex={0}
          >
            <table
              className={`admin-table admin-table-users${
                isRefreshing ? " is-refreshing" : ""
              }`}
              aria-busy={isLoading || isRefreshing}
            >
              <caption className="admin-visually-hidden">
                Users with name, email, role, account status, age, phone, join
                date, and account actions
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
                  data.map((user) => (
                    <tr key={user._id}>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={
                            column.hide ? `admin-col-${column.hide}` : undefined
                          }
                        >
                          {column.render(user)}
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
              itemLabel="users"
            />
          ) : null}
        </div>
      )}

      {detailUserId && !pendingChange ? (
        <UserDetailDialog
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onChangeStatus={(user, nextStatus) => {
            setChangeError(null);
            setPendingChange({ user, nextStatus });
          }}
        />
      ) : null}

      {pendingChange ? (
        <ConfirmStatusDialog
          user={pendingChange.user}
          nextStatus={pendingChange.nextStatus}
          onClose={closeChangeDialog}
          onConfirm={handleConfirmStatusChange}
          isSubmitting={isSubmitting}
          error={changeError}
        />
      ) : null}
    </div>
  );
}
