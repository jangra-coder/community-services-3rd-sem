const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function formatDateTime(value) {
  return value ? dateTime.format(new Date(value)) : '';
}

export function formatDate(value) {
  return value ? dateOnly.format(new Date(value)) : '';
}

export function formatTime(value) {
  return value ? timeOnly.format(new Date(value)) : '';
}

/** "just now", "3 min ago", "2 h ago", or the date for anything older. */
export function formatRelative(value, now = Date.now()) {
  if (!value) return '';
  const diff = Math.max(0, now - new Date(value).getTime());
  const s = Math.round(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(value);
}

/** Describe an event's time span on one line. */
export function formatEventWhen(startsAt, endsAt) {
  if (!startsAt) return '';
  const start = new Date(startsAt);
  if (!endsAt) return dateTime.format(start);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dateOnly.format(start)}, ${timeOnly.format(start)} – ${timeOnly.format(end)}`
    : `${dateTime.format(start)} – ${dateTime.format(end)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** ISO string → value for <input type="datetime-local"> (local time). */
export function toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO string, or null when empty. */
export function fromDatetimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
