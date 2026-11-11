import { Link } from "react-router-dom";
import "./Dashboard.css";
import SearchBar from "../components/SearchBar";
import LogoutButton from "../components/LogoutButton";

const DEPARTMENTS = [
  {
    slug: "computer-science",
    name: "Computer Science",
    icon: "</>",
    description: "Get help with programming and coding.",
  },
  {
    slug: "mathematics",
    name: "Mathematics",
    icon: "∑",
    description: "Practice concepts and solve problems.",
  },
  {
    slug: "writing",
    name: "Writing",
    icon: "A",
    description: "Improve essays and writing skills.",
  },
];

function Dashboard() {
  return (
    <div className="dashboard-page">
      {/* TOP NAVIGATION */}
      <header className="dashboard-header">
        <h2>
          Campus<span>Connect</span>
        </h2>
        <SearchBar />
        <div className="header-actions">
          <a href="#" className="header-profile">
            My Profile
          </a>
          <LogoutButton />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="dashboard-main">
        {/* WELCOME BANNER */}
        <section className="welcome-banner">
          <p className="welcome-label">YOUR LEARNING JOURNEY</p>
          <h1>Welcome, Student!</h1>
          <p>
            Find the right tutor and get the support you need to succeed in your
            courses.
          </p>
        </section>

        {/* COURSE / DEPARTMENT LINKS */}
        <section className="course-section" aria-labelledby="courses-heading">
          <div className="section-heading">
            <h2 id="courses-heading">Explore Your Courses</h2>
            <Link to="/student-bookings">View all</Link>
          </div>

          <div className="course-grid">
            {DEPARTMENTS.map((department) => (
              <Link
                key={department.slug}
                to={`/student-bookings?department=${department.slug}`}
                className="course-card"
                aria-label={`Browse ${department.name} tutors and courses`}
              >
                <div className="course-icon" aria-hidden="true">
                  {department.icon}
                </div>
                <h3>{department.name}</h3>
                <p>{department.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* TUTOR DISCOVERY */}
        <section className="tutor-section">
          <h2>Find Your Tutor</h2>
          <p>
            Explore tutors, compare subjects, and find someone who fits your
            learning needs.
          </p>
          <div className="student-dashboard-actions">
            <Link to="/student-bookings" className="tutor-action">
              Explore Tutors →
            </Link>
            <Link to="/student-bookings#my-bookings" className="tutor-action tutor-action-outline">
              My Booking Requests →
            </Link>
          </div>
        </section>

        <footer className="dashboard-footer">
          CampusConnect · Your campus learning community
        </footer>
      </main>
    </div>
  );
}

export default Dashboard;
