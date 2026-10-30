import { useEffect, useState } from "react";
import { apiRequest } from "../../utils/api";
import { formatDate, formatTimeRange, todayInputValue } from "../../utils/time";

// Lets a tutor open up tutoring times and remove ones they no longer want.
// Times a student is already booked for can't be removed.
// Data: GET/POST /api/tutor/availability, DELETE /api/tutor/availability/:id
//
// The browser checks the form first for quick feedback, but the backend
// re-checks everything (past times, overlaps, max length) and its error
// message is what gets shown if it rejects the time.
function AvailabilityManager() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form fields, as the inputs give them: "2026-10-29", "14:30", "15:30"
  const [date, setDate] = useState(todayInputValue());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    apiRequest("/tutor/availability")
      .then(setSlots)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(event) {
    event.preventDefault();
    setError("");

    if (!date || !startTime || !endTime) {
      setError("Pick a date, start time, and end time.");
      return;
    }

    // Inputs are in local time; send UTC to the backend
    const startsAt = new Date(`${date}T${startTime}`);
    const endsAt = new Date(`${date}T${endTime}`);

    if (endsAt <= startsAt) {
      setError("End time must be after the start time.");
      return;
    }

    setSaving(true);

    try {
      const slot = await apiRequest("/tutor/availability", {
        method: "POST",
        body: {
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        },
      });

      // Add the new slot in time order without refetching the whole list
      setSlots((current) =>
        [...current, slot].sort(
          (a, b) => new Date(a.starts_at) - new Date(b.starts_at)
        )
      );
      setStartTime("");
      setEndTime("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Deleting a slot also deletes its pending requests, so confirm first
  async function handleDelete(slot) {
    if (
      slot.pending_requests > 0 &&
      !window.confirm(
        `${slot.pending_requests} student request(s) for this time will be removed too. Delete it?`
      )
    ) {
      return;
    }

    setDeletingId(slot.id);
    setError("");

    try {
      await apiRequest(`/tutor/availability/${slot.id}`, { method: "DELETE" });
      setSlots((current) => current.filter((s) => s.id !== slot.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="tutor-panel">
      <div className="panel-header">
        <div>
          <h2>Availability</h2>
          <p>Add the times you're free to tutor. Students can request these.</p>
        </div>
      </div>

      <form className="availability-form" onSubmit={handleAdd}>
        <label>
          Date
          <input
            type="date"
            value={date}
            min={todayInputValue()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Start
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>
        <label>
          End
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Adding…" : "Add Time"}
        </button>
      </form>

      {error && <p className="panel-error">{error}</p>}

      {loading ? (
        <p className="panel-empty">Loading your times…</p>
      ) : slots.length === 0 ? (
        <p className="panel-empty">You haven't added any upcoming times yet.</p>
      ) : (
        <ul className="item-list">
          {slots.map((slot) => (
            <li key={slot.id} className="item-card">
              <div className="item-body">
                <h3>{formatDate(slot.starts_at)}</h3>
                <p className="item-meta">
                  {formatTimeRange(slot.starts_at, slot.ends_at)}
                </p>
                {/* Booked > has pending requests > open */}
                {slot.booked_by ? (
                  <span className="status-pill is-booked">
                    Booked · {slot.booked_by}
                  </span>
                ) : slot.pending_requests > 0 ? (
                  <span className="status-pill is-pending">
                    {slot.pending_requests} pending request
                    {slot.pending_requests === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="status-pill is-open">Open</span>
                )}
              </div>

              <div className="item-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={Boolean(slot.booked_by) || deletingId === slot.id}
                  title={slot.booked_by ? "A student is booked for this time" : undefined}
                  onClick={() => handleDelete(slot)}
                >
                  {deletingId === slot.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default AvailabilityManager;
