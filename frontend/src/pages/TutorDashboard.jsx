import "./Dashboard.css";

// Landing page for tutor accounts after login. Placeholder for now; this is
// where tutors will manage their courses (backend: POST /api/tutor-courses).
function TutorDashboard() {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h2>
          Campus<span>Connect</span>
        </h2>

        <a href="#" className="header-profile">
          My Profile
        </a>
      </header>

      <main className="dashboard-main">
        <section className="welcome-banner">
          <p className="welcome-label">TUTOR DASHBOARD</p>

          <h1>Welcome, {user.username || "Tutor"}!</h1>

          <p>
            Manage the courses you tutor and see which students are
            looking for help.
          </p>
        </section>

        <section className="tutor-section">
          <h2>Your Courses</h2>

          <p>
            You haven't added any courses yet. Course management is
            coming soon.
          </p>
        </section>

        <footer className="dashboard-footer">
          CampusConnect · Your campus learning community
        </footer>
      </main>
    </div>
  );
}

export default TutorDashboard;
