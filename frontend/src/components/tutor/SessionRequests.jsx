import { useEffect, useState } from "react";
import { apiRequest } from "../../utils/api";
import { formatDate, formatTimeRange } from "../../utils/time";

// Pending requests from students. Accepting one books the time (and the
// backend declines any other requests for that same time).
// Data: GET /api/tutor/requests, PATCH /api/tutor/requests/:id
//
// onCountChange(count) is optional; TutorDashboard uses it for the tab badge.
function SessionRequests({ onCountChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Id of the request being answered. All buttons are disabled meanwhile
  // so the tutor can't fire off two answers at once.
  const [busyId, setBusyId] = useState(null);

  function load() {
    return apiRequest("/tutor/requests")
      .then((rows) => {
        setRequests(rows);
        onCountChange?.(rows.length);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // Only on first render; load() is redefined every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(id, status) {
    setBusyId(id);
    setError("");

    try {
      await apiRequest(`/tutor/requests/${id}`, {
        method: "PATCH",
        body: { status },
      });
      // Reload rather than removing one row, since accepting can also
      // auto-decline other requests for the same time
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="tutor-panel">
      <div className="panel-header">
        <div>
          <h2>Tutoring Requests</h2>
          <p>Students asking to book one of your open times.</p>
        </div>
      </div>

      {error && <p className="panel-error">{error}</p>}

      {loading ? (
        <p className="panel-empty">Loading requests…</p>
      ) : requests.length === 0 ? (
        <p className="panel-empty">No pending requests right now.</p>
      ) : (
        <ul className="item-list">
          {requests.map((request) => (
            <li key={request.id} className="item-card">
              <div className="item-body">
                <h3>{request.student_name}</h3>
                <p className="item-meta">
                  {formatDate(request.starts_at)} ·{" "}
                  {formatTimeRange(request.starts_at, request.ends_at)}
                </p>
                <p className="item-meta">
                  {request.course_code
                    ? `${request.course_code} · ${request.course_title}`
                    : "No course specified"}
                </p>
                {request.note && <p className="item-note">“{request.note}”</p>}
              </div>

              <div className="item-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId !== null}
                  onClick={() => respond(request.id, "ACCEPTED")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId !== null}
                  onClick={() => respond(request.id, "DECLINED")}
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SessionRequests;
