export function formatApptDate(iso) {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return String(iso);
  const [year, month, day] = parts.map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  if (!year || !month || !day || !months[month - 1]) return String(iso);
  return `${day} ${months[month - 1]} ${year}`;
}
