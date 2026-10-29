import { useEffect, useState } from "react";
import "./Dashboard.css";
import "./TutorDashboard.css";
import LogoutButton from "../components/LogoutButton";
import TodaySchedule from "../components/tutor/TodaySchedule";
import SessionRequests from "../components/tutor/SessionRequests";
import AvailabilityManager from "../components/tutor/AvailabilityManager";
import CourseManager from "../components/tutor/CourseManager";
import { apiRequest } from "../utils/api";

// Landing page for tutor accounts after login. Each tab is its own feature:
// today's schedule, incoming requests, availability, and courses.
//
// Each tab's panel lives in components/tutor/ and loads its own data, so
// this page only handles the header, the tab bar, and which panel is shown.
// To add a tab: make a component in components/tutor/ and add it here.
const TABS = [
  { id: "today", label: "Today", Panel: TodaySchedule },
  { id: "requests", label: "Requests", Panel: SessionRequests },
  { id: "availability", label: "Availability", Panel: AvailabilityManager },
  { id: "courses", label: "Courses", Panel: CourseManager },
];

function TutorDashboard() {
  // Saved by Login.jsx: { id, username, email, role }
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const [activeTab, setActiveTab] = useState("today");
  const [pendingCount, setPendingCount] = useState(0);

  // Badge on the Requests tab, so tutors see new requests from any tab.
  // Loaded once here; SessionRequests updates it via onCountChange after
  // the tutor accepts/declines. A failure just leaves the badge hidden.
  useEffect(() => {
    apiRequest("/tutor/requests")
      .then((rows) => setPendingCount(rows.length))
      .catch(() => {});
  }, []);

  // Only the active panel is rendered, so switching tabs remounts it and
  // it refetches fresh data
  const { Panel } = TABS.find((tab) => tab.id === activeTab);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h2>
          Campus<span>Connect</span>
        </h2>

        <div className="header-actions">
          <a href="#" className="header-profile">
            My Profile
          </a>
          <LogoutButton />
        </div>
      </header>

      <main className="dashboard-main">
        <section className="welcome-banner">
          <p className="welcome-label">TUTOR DASHBOARD</p>

          <h1>Welcome, {user.username || "Tutor"}!</h1>

          <p>
            Manage your availability and courses, respond to student
            requests, and see today's sessions.
          </p>
        </section>

        <nav className="tutor-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tutor-tab ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === "requests" && pendingCount > 0 && (
                <span className="tab-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Only the Requests panel takes a prop (to keep the badge in sync) */}
        {activeTab === "requests" ? (
          <Panel onCountChange={setPendingCount} />
        ) : (
          <Panel />
        )}

        <footer className="dashboard-footer">
          CampusConnect · Your campus learning community
        </footer>
      </main>
    </div>
  );
}

export default TutorDashboard;
