import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LogoutButton from "../../components/LogoutButton";
import { apiRequest } from "../../utils/api";
import "../Dashboard.css";
import "./StudentBookings.css";
import "./StudentBookings-mobile.css";

// These match the department links already used by Dashboard.jsx.
const DEPARTMENTS = [
  { id: "all", label: "All departments", symbol: "◈" },
  { id: "computer-science", label: "Computer Science", symbol: "</>" },
  { id: "mathematics", label: "Mathematics", symbol: "∑" },
  { id: "writing", label: "Writing", symbol: "A" },
];

// API routes provided by the existing backend (no server changes necessary):
// GET  /api/courses                 -> [{ course_id, code, title }]
// GET  /api/tutors                  -> [{ id, name, courses: ["CSC 211"] }]
// GET  /api/tutors/:id/availability -> [{ id, starts_at, ends_at }]
// POST /api/session-requests        -> { slot_id, course_id, note } (student JWT)

function normalizeCourses(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((course) => course && course.course_id != null)
    .map((course) => ({
      id: String(course.course_id),
      code: String(course.code || "").trim(),
      title: String(course.title || "").trim(),
    }));
}

function courseDepartment(course) {
  const code = course.code.toUpperCase().trim();
  if (/^(CSC|CS|CPSC|COMP)(?=\s|\d|$)/.test(code)) return "computer-science";
  if (/^(MAT|MATH|MTH)(?=\s|\d|$)/.test(code)) return "mathematics";
  if (/^(ENG|ENGL|WRT|WRIT)(?=\s|\d|$)/.test(code)) return "writing";
  return "other";
}

function matchingTutors(rows, selectedCourse) {
  if (!Array.isArray(rows)) return [];
  const code = selectedCourse.code.toUpperCase();

  return rows
    .filter((tutor) =>
      tutor &&
      tutor.id != null &&
      Array.isArray(tutor.courses) &&
      tutor.courses.some((taughtCode) => String(taughtCode).toUpperCase() === code)
    )
    .map((tutor) => ({
      id: String(tutor.id),
      name: String(tutor.name || `Tutor ${tutor.id}`),
      slots: [],
      availabilityError: "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeSlots(rows) {
  if (!Array.isArray(rows)) return [];
  const now = Date.now();
  return rows
    .filter((slot) => slot && Number.isInteger(Number(slot.id)) && Number(slot.id) > 0)
    .map((slot) => ({
      id: Number(slot.id),
      startsAt: new Date(slot.starts_at),
      endsAt: new Date(slot.ends_at),
    }))
    .filter((slot) =>
      !Number.isNaN(slot.startsAt.getTime()) &&
      !Number.isNaN(slot.endsAt.getTime()) &&
      slot.startsAt.getTime() > now &&
      slot.endsAt.getTime() > slot.startsAt.getTime()
    )
    .sort((a, b) => a.startsAt - b.startsAt);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDay(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short", month: "short", day: "numeric",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric", minute: "2-digit",
  }).format(date);
}

function TutorCard({ tutor, selectedDate, requestedIds, onSelectSlot }) {
  const visibleSlots = tutor.slots.filter(
    (slot) => !selectedDate || localDateKey(slot.startsAt) === selectedDate
  );
  const initial = tutor.name.trim().charAt(0).toUpperCase() || "T";

  return (
    <article className="sb-tutor-card">
      <div className="sb-tutor-top">
        <div className="sb-avatar" aria-hidden="true">{initial}</div>
        <div className="sb-tutor-identity">
          <h3>{tutor.name}</h3>
          <span className="sb-tutor-role">CampusConnect tutor</span>
        </div>
        <span className="sb-tutor-course-label">Course tutor</span>
      </div>

      <div className="sb-tutor-schedule">
        <div className="sb-schedule-heading">
          <h4>Upcoming availability</h4>
          {!tutor.availabilityError && <span>{visibleSlots.length} time{visibleSlots.length === 1 ? "" : "s"}</span>}
        </div>
        {tutor.availabilityError ? (
          <div className="sb-inline-error" role="alert">
            <p>Could not load this tutor's schedule: {tutor.availabilityError}</p>
          </div>
        ) : visibleSlots.length > 0 ? (
          <div className="sb-slot-grid">
            {visibleSlots.map((slot) => {
              const requested = requestedIds.has(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`sb-slot ${requested ? "is-requested" : ""}`}
                  disabled={requested}
                  onClick={() => onSelectSlot(tutor, slot)}
                >
                  <span className="sb-slot-day">{formatDay(slot.startsAt)}</span>
                  <span className="sb-slot-time">{formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}</span>
                  <span className="sb-slot-action">{requested ? "Request sent ✓" : "Request this time →"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="sb-no-slots">
            {selectedDate
              ? "No open times on this date. Clear the date filter to see other days."
              : "This tutor has no open upcoming times right now."}
          </div>
        )}
      </div>
    </article>
  );
}

function StudentBookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDepartment = searchParams.get("department") || "all";
  const department = DEPARTMENTS.some((item) => item.id === requestedDepartment)
    ? requestedDepartment
    : "all";
  const selectedCourseId = searchParams.get("course") || "";

  const [courses, setCourses] = useState([]);
  const [coursesStatus, setCoursesStatus] = useState("loading");
  const [coursesError, setCoursesError] = useState("");
  const [coursesReload, setCoursesReload] = useState(0);
  const [courseSearch, setCourseSearch] = useState("");

  const [tutors, setTutors] = useState([]);
  const [tutorsStatus, setTutorsStatus] = useState("idle");
  const [tutorsError, setTutorsError] = useState("");
  const [tutorsReload, setTutorsReload] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [requestedIds, setRequestedIds] = useState(() => new Set());

  const [selection, setSelection] = useState(null);
  const [note, setNote] = useState("");
  const [bookingStatus, setBookingStatus] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    setCoursesStatus("loading");
    setCoursesError("");

    apiRequest("/courses")
      .then((rows) => {
        if (!active) return;
        setCourses(normalizeCourses(rows));
        setCoursesStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setCoursesError(error.message || "Unable to load courses.");
        setCoursesStatus("error");
      });

    return () => { active = false; };
  }, [coursesReload]);

  const departmentCourses = useMemo(
    () => courses.filter((course) => department === "all" || courseDepartment(course) === department),
    [courses, department]
  );

  const visibleCourses = useMemo(() => {
    const term = courseSearch.trim().toLowerCase();
    return departmentCourses.filter((course) =>
      !term || `${course.code} ${course.title}`.toLowerCase().includes(term)
    );
  }, [departmentCourses, courseSearch]);

  const selectedCourse = departmentCourses.find((course) => course.id === selectedCourseId) || null;

  useEffect(() => {
    let active = true;
    setSelectedDate("");
    setSelection(null);
    setTutors([]);
    setTutorsError("");

    if (!selectedCourse) {
      setTutorsStatus("idle");
      return () => { active = false; };
    }

    setTutorsStatus("loading");

    // /tutors returns all tutors; it does NOT implement ?course_id=.
    // Match the selected course against the actual courses array first.
    apiRequest("/tutors")
      .then(async (rows) => {
        const matched = matchingTutors(rows, selectedCourse);
        // The backend exposes availability per tutor, not in /tutors.
        // Fetch schedules individually without letting one failure hide all tutors.
        const withSchedules = await Promise.all(matched.map(async (tutor) => {
          try {
            const slots = await apiRequest(`/tutors/${encodeURIComponent(tutor.id)}/availability`);
            return { ...tutor, slots: normalizeSlots(slots) };
          } catch (error) {
            return { ...tutor, availabilityError: error.message || "Unable to load availability." };
          }
        }));

        if (!active) return;
        setTutors(withSchedules);
        setTutorsStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setTutorsError(error.message || "Unable to load tutors.");
        setTutorsStatus("error");
      });

    return () => { active = false; };
    // Selected course is identified by immutable database id and code.
  }, [selectedCourse?.id, selectedCourse?.code, tutorsReload]);

  useEffect(() => {
    if (!selection) return;
    dialogRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape" && bookingStatus !== "submitting") {
        setSelection(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection, bookingStatus]);

  function changeDepartment(nextDepartment) {
    setCourseSearch("");
    setSearchParams(nextDepartment === "all" ? {} : { department: nextDepartment });
  }

  function changeCourse(nextCourseId) {
    setSearchParams({
      ...(department !== "all" ? { department } : {}),
      course: nextCourseId,
    });
  }

  function openBooking(tutor, slot) {
    setSelection({ tutor, slot });
    setNote("");
    setBookingError("");
    setBookingStatus("idle");
  }

  function closeBooking() {
    if (bookingStatus !== "submitting") setSelection(null);
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!selection || !selectedCourse || bookingStatus === "submitting") return;

    setBookingStatus("submitting");
    setBookingError("");
    try {
      await apiRequest("/session-requests", {
        method: "POST",
        body: {
          slot_id: selection.slot.id,
          course_id: Number(selectedCourse.id),
          note: note.trim().slice(0, 500),
        },
      });
      setRequestedIds((previous) => new Set([...previous, selection.slot.id]));
      setBookingStatus("success");
    } catch (error) {
      setBookingError(error.message || "Unable to send your request.");
      // 409 may mean this student has already requested this time; let the
      // backend message explain rather than claiming it was booked.
      setBookingStatus("idle");
    }
  }

  const heading = DEPARTMENTS.find((item) => item.id === department)?.label || "All departments";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="dashboard-page student-bookings-page">
      <header className="dashboard-header sb-header">
        <Link to="/dashboard" className="sb-brand" aria-label="CampusConnect student dashboard">
          Campus<span>Connect</span>
        </Link>
        <div className="sb-header-actions">
          <Link className="sb-dashboard-link" to="/dashboard">← Student dashboard</Link>
          <LogoutButton />
        </div>
      </header>

      <main className="sb-main">
        <div className="sb-breadcrumb">
          <Link to="/dashboard">Dashboard</Link>
          <span aria-hidden="true">/</span>
          <span>Book a tutor</span>
        </div>

        <section className="sb-hero">
          <div>
            <p className="sb-eyebrow">YOUR STUDY SUPPORT</p>
            <h1>Find your next great tutor.</h1>
            <p>Choose a department, pick a course, and request a time with a tutor who teaches it.</p>
          </div>
          <div className="sb-hero-mark" aria-hidden="true">
            <span>📅</span>
            <strong>Learn together.</strong>
            <small>One session at a time.</small>
          </div>
        </section>

        <section className="sb-departments" aria-label="Choose a department">
          <div className="sb-section-title">
            <div>
              <p className="sb-step-label">STEP 01</p>
              <h2>Explore departments</h2>
            </div>
            <span>Select your subject area</span>
          </div>
          <div className="sb-department-tabs" role="group" aria-label="Department filters">
            {DEPARTMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={department === item.id}
                className={`sb-department-tab ${department === item.id ? "is-active" : ""}`}
                onClick={() => changeDepartment(item.id)}
              >
                <span className="sb-department-symbol" aria-hidden="true">{item.symbol}</span>
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <div className="sb-content-grid">
          <section className="sb-courses-panel" aria-labelledby="sb-course-heading">
            <div className="sb-panel-heading">
              <p className="sb-step-label">STEP 02</p>
              <h2 id="sb-course-heading">Choose a course</h2>
              <p>{heading}</p>
            </div>
            <label htmlFor="sb-course-search" className="sb-input-label">Search courses</label>
            <input
              id="sb-course-search"
              className="sb-course-search"
              type="search"
              value={courseSearch}
              onChange={(event) => setCourseSearch(event.target.value)}
              placeholder="e.g. CSC 211"
            />

            {coursesStatus === "loading" && <p className="sb-panel-note" role="status">Loading your course catalog…</p>}
            {coursesStatus === "error" && (
              <div className="sb-inline-error" role="alert">
                <p>{coursesError}</p>
                <button type="button" onClick={() => setCoursesReload((value) => value + 1)}>Try again</button>
              </div>
            )}
            {coursesStatus === "ready" && visibleCourses.length === 0 && (
              <p className="sb-panel-note">No courses match this department or search. Try another department.</p>
            )}
            {coursesStatus === "ready" && visibleCourses.length > 0 && (
              <div className="sb-course-list">
                {visibleCourses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    className={`sb-course-button ${selectedCourse?.id === course.id ? "is-active" : ""}`}
                    aria-pressed={selectedCourse?.id === course.id}
                    onClick={() => changeCourse(course.id)}
                  >
                    <span className="sb-course-code">{course.code || "Course"}</span>
                    <span className="sb-course-name">{course.title}</span>
                    <span className="sb-course-chevron" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="sb-results-panel" aria-labelledby="sb-tutors-heading">
            <div className="sb-results-heading">
              <div>
                <p className="sb-step-label">STEP 03</p>
                <h2 id="sb-tutors-heading">Tutors & open times</h2>
                <p>
                  {selectedCourse
                    ? `${selectedCourse.code} · ${selectedCourse.title}`
                    : "Select a course to explore tutors."}
                </p>
              </div>
              {selectedCourse && (
                <label className="sb-date-filter">
                  <span>Filter by date</span>
                  <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                </label>
              )}
            </div>

            {selectedCourse && (
              <div className="sb-times-caption">
                <span>Times shown in your local time zone{timeZone ? ` (${timeZone.replace(/_/g, " ")})` : ""}.</span>
                <button
                  type="button"
                  className="sb-refresh-button"
                  disabled={tutorsStatus === "loading"}
                  onClick={() => setTutorsReload((value) => value + 1)}
                >Refresh schedules</button>
              </div>
            )}

            {!selectedCourse && (
              <div className="sb-empty-state">
                <div className="sb-empty-icon" aria-hidden="true">📚</div>
                <h3>Start with a course</h3>
                <p>Pick a course from the list to find tutors and see their upcoming open time slots.</p>
              </div>
            )}
            {selectedCourse && tutorsStatus === "loading" && (
              <div className="sb-empty-state" role="status"><h3>Looking for tutors…</h3><p>Loading course tutors and their upcoming schedules.</p></div>
            )}
            {selectedCourse && tutorsStatus === "error" && (
              <div className="sb-empty-state" role="alert"><h3>Unable to load tutors</h3><p>{tutorsError}</p></div>
            )}
            {selectedCourse && tutorsStatus === "ready" && tutors.length === 0 && (
              <div className="sb-empty-state">
                <div className="sb-empty-icon" aria-hidden="true">🗓️</div>
                <h3>No tutors assigned to this course yet</h3>
                <p>Try a different course, or check back once a tutor has added it to their profile.</p>
              </div>
            )}
            {selectedCourse && tutorsStatus === "ready" && tutors.length > 0 && (
              <div className="sb-tutors-list">
                <p className="sb-results-count">{tutors.length} tutor{tutors.length === 1 ? "" : "s"} for this course</p>
                {tutors.map((tutor) => (
                  <TutorCard
                    key={tutor.id}
                    tutor={tutor}
                    selectedDate={selectedDate}
                    requestedIds={requestedIds}
                    onSelectSlot={openBooking}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="dashboard-footer">CampusConnect · Your campus learning community</footer>
      </main>

      {selection && selectedCourse && (
        <div className="sb-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeBooking();
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sb-booking-dialog-title"
            className="sb-booking-modal"
            ref={dialogRef}
            tabIndex={-1}
          >
            <button
              type="button"
              className="sb-modal-close"
              aria-label="Close booking details"
              disabled={bookingStatus === "submitting"}
              onClick={closeBooking}
            >×</button>

            {bookingStatus === "success" ? (
              <>
                <p className="sb-step-label">REQUEST SENT</p>
                <h2 id="sb-booking-dialog-title">Your request is on its way!</h2>
                <p className="sb-booking-success" role="status">
                  Your session request was submitted. It is not confirmed until the tutor accepts it on their dashboard.
                </p>
                <dl className="sb-booking-details">
                  <div><dt>Course</dt><dd>{selectedCourse.code} · {selectedCourse.title}</dd></div>
                  <div><dt>Tutor</dt><dd>{selection.tutor.name}</dd></div>
                  <div><dt>Time</dt><dd>{formatDay(selection.slot.startsAt)}, {formatTime(selection.slot.startsAt)}</dd></div>
                </dl>
                <div className="sb-modal-actions sb-modal-actions-success">
                  <button type="button" className="sb-primary-button" onClick={closeBooking}>Done</button>
                </div>
              </>
            ) : (
              <form onSubmit={submitBooking}>
                <p className="sb-step-label">SESSION DETAILS</p>
                <h2 id="sb-booking-dialog-title">Request this session</h2>
                <dl className="sb-booking-details">
                  <div><dt>Course</dt><dd>{selectedCourse.code} · {selectedCourse.title}</dd></div>
                  <div><dt>Tutor</dt><dd>{selection.tutor.name}</dd></div>
                  <div><dt>Day</dt><dd>{formatDay(selection.slot.startsAt)}</dd></div>
                  <div><dt>Time</dt><dd>{formatTime(selection.slot.startsAt)} – {formatTime(selection.slot.endsAt)}</dd></div>
                </dl>
                <label htmlFor="sb-booking-note" className="sb-input-label">Message for your tutor (optional)</label>
                <textarea
                  id="sb-booking-note"
                  className="sb-booking-note"
                  maxLength={500}
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What would you like help with?"
                  disabled={bookingStatus === "submitting"}
                />
                <div className="sb-character-count">{note.length}/500 characters</div>
                <p className="sb-booking-notice">
                  Response to tutoring session request will be sent VIA Email.
                </p>
                {bookingError && <p className="sb-booking-error" role="alert">{bookingError}</p>}
                <div className="sb-modal-actions">
                  <button type="button" className="sb-secondary-button" disabled={bookingStatus === "submitting"} onClick={closeBooking}>Back to tutors</button>
                  <button type="submit" className="sb-primary-button" disabled={bookingStatus === "submitting"}>
                    {bookingStatus === "submitting" ? "Sending request…" : "Send booking request"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default StudentBookings;
