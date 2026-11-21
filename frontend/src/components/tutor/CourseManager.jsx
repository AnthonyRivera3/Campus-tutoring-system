import { useEffect, useState } from "react";
import { apiRequest } from "../../utils/api";

// The courses a tutor teaches. Add from the course catalog or remove.
// Data: GET /api/courses (full catalog), GET /api/tutor/courses (mine),
// POST /api/tutor-courses (add), DELETE /api/tutor/courses/:courseId (remove)
function CourseManager() {
  const [catalog, setCatalog] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([apiRequest("/courses"), apiRequest("/tutor/courses")])
      .then(([allCourses, mine]) => {
        setCatalog(allCourses);
        setMyCourses(mine);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // The dropdown only lists courses the tutor doesn't already teach
  const myIds = new Set(myCourses.map((c) => c.course_id));
  const available = catalog.filter((c) => !myIds.has(c.course_id));

  async function handleAdd(event) {
    event.preventDefault();
    if (!selectedId) return;

    setBusy(true);
    setError("");

    try {
      const { course } = await apiRequest("/tutor-courses", {
        method: "POST",
        body: { course_id: Number(selectedId) },
      });
      setMyCourses((current) =>
        [...current, course].sort((a, b) => a.code.localeCompare(b.code))
      );
      setSelectedId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(course) {
    setBusy(true);
    setError("");

    try {
      await apiRequest(`/tutor/courses/${course.course_id}`, { method: "DELETE" });
      setMyCourses((current) =>
        current.filter((c) => c.course_id !== course.course_id)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tutor-panel">
      <div className="panel-header">
        <div>
          <h2>Your Courses</h2>
          <p>Students can find you by the courses you tutor.</p>
        </div>
      </div>

      <form className="course-form" onSubmit={handleAdd}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loading || available.length === 0}
        >
          <option value="">
            {available.length === 0 && !loading
              ? "You tutor every course"
              : "Choose a course to add…"}
          </option>
          {available.map((course) => (
            <option key={course.course_id} value={course.course_id}>
              {course.code} · {course.title}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" disabled={!selectedId || busy}>
          Add Course
        </button>
      </form>

      {error && <p className="panel-error">{error}</p>}

      {loading ? (
        <p className="panel-empty">Loading courses…</p>
      ) : myCourses.length === 0 ? (
        <p className="panel-empty">You haven't added any courses yet.</p>
      ) : (
        <ul className="item-list">
          {myCourses.map((course) => (
            <li key={course.course_id} className="item-card">
              <div className="item-body">
                <h3>{course.code}</h3>
                <p className="item-meta">{course.title}</p>
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => handleRemove(course)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default CourseManager;
