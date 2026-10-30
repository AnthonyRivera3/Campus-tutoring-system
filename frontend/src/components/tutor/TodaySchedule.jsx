import { useEffect, useState } from "react";
import { apiRequest } from "../../utils/api";
import { dayRange, formatTimeRange } from "../../utils/time";

// The tutor's accepted sessions for today, in order, marked as
// done / in progress / upcoming.
// Data: GET /api/tutor/sessions with today's local start/end.
function TodaySchedule() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const { from, to } = dayRange();

    apiRequest(`/tutor/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Keep the done / in progress labels current
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // The status also picks the CSS class (is-done / is-live / is-upcoming)
  function statusOf(session) {
    if (new Date(session.ends_at) <= now) return "done";
    if (new Date(session.starts_at) <= now) return "live";
    return "upcoming";
  }

  const labels = { done: "Done", live: "In progress", upcoming: "Upcoming" };

  return (
    <section className="tutor-panel">
      <div className="panel-header">
        <div>
          <h2>Today's Schedule</h2>
          <p>
            {now.toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {error && <p className="panel-error">{error}</p>}

      {loading ? (
        <p className="panel-empty">Loading your schedule…</p>
      ) : sessions.length === 0 && !error ? (
        <p className="panel-empty">
          No sessions today. Accepted requests will show up here.
        </p>
      ) : (
        <ol className="schedule-list">
          {sessions.map((session) => {
            const status = statusOf(session);
            return (
              <li key={session.id} className={`schedule-item is-${status}`}>
                <div className="schedule-time">
                  {formatTimeRange(session.starts_at, session.ends_at)}
                </div>

                <div className="schedule-details">
                  <h3>{session.student_name}</h3>
                  <p className="item-meta">
                    {session.course_code
                      ? `${session.course_code} · ${session.course_title}`
                      : "No course specified"}
                  </p>
                  {session.note && <p className="item-note">“{session.note}”</p>}
                </div>

                <span className={`status-pill is-${status}`}>{labels[status]}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default TodaySchedule;
