// Date/time helpers for the tutor dashboard. Everything is shown in the
// browser's local timezone; the backend stores UTC timestamps.
// The format functions accept anything `new Date()` does, including the
// ISO strings the API returns (e.g. slot.starts_at).

// "2:30 PM"
export function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Thu, Oct 29"
export function formatDate(value) {
  return new Date(value).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "2:30 PM – 3:30 PM"
export function formatTimeRange(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// Start and end of the local day containing `date`, as ISO strings.
// Used for GET /tutor/sessions?from=...&to=... so "today" means the
// tutor's today, not the server's.
export function dayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

// "YYYY-MM-DD" for today in local time, for <input type="date">.
// (toISOString() would give the UTC date, which is tomorrow in the evening.)
export function todayInputValue() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Same local day?
export function isSameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}
