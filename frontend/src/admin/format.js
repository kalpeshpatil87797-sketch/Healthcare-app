const numberFormatter = new Intl.NumberFormat();

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? numberFormatter.format(value)
    : "—";
}

export function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return dateFormatter.format(date);
}

export function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return dateTimeFormatter.format(date);
}

export function getPercent(count, total) {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0;

  return Math.min(100, Math.max(0, Math.round((count / total) * 100)));
}

export function formatPercent(count, total) {
  return `${getPercent(count, total)}%`;
}

export function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "A";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Appointment dates are timezone-free calendar days (YYYY-MM-DD), so they are
// formatted from their parts instead of passing through Date().
export function formatCalendarDate(value) {
  if (typeof value !== "string") return "—";

  const parts = value.split("-");
  if (parts.length !== 3) return value || "—";

  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day || !CALENDAR_MONTHS[month - 1]) return value || "—";

  return `${day} ${CALENDAR_MONTHS[month - 1]} ${year}`;
}
