import { formatNumber } from "../format";

export default function Pagination({
  meta,
  onPageChange,
  disabled = false,
  itemLabel = "items",
}) {
  if (!meta) return null;

  const { page, limit, total, totalPages, hasPrevPage, hasNextPage } = meta;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(page * limit, total);
  const lastPage = Math.max(totalPages, 1);

  return (
    <div className="admin-pagination">
      <p className="admin-pagination-summary">
        Showing{" "}
        <strong>
          {start}–{end}
        </strong>{" "}
        of <strong>{formatNumber(total)}</strong> {itemLabel}
      </p>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || !hasPrevPage}
        >
          Previous
        </button>
        <span className="admin-pagination-page">
          Page {page} of {lastPage}
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || !hasNextPage}
        >
          Next
        </button>
      </div>
    </div>
  );
}
