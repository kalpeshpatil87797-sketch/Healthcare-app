import { formatNumber } from "../format";

export default function StatCard({ label, value, helper, accent = "teal" }) {
  return (
    <article className={`admin-stat-card admin-stat-card-${accent}`}>
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">{formatNumber(value)}</p>
      {helper ? <p className="admin-stat-helper">{helper}</p> : null}
    </article>
  );
}
