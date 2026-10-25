
import React from "react";
import "./dashboard.css";

function Dashboard() {
  return (
    <div className="dashboard-page">

      {/* TOP NAVIGATION */}
      <header className="dashboard-header">
        <h2>
          Campus<span>Connect</span>
        </h2>

        <form
          className="header-search"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="text"
            placeholder="Search tutors or courses..."
            aria-label="Search tutors or courses"
          />
          <button type="submit">Search</button>
        </form>

        <a href="#" className="header-profile">
          My Profile
        </a>
      </header>

      {/* MAIN CONTENT */}
      <main className="dashboard-main">

        {/* WELCOME BANNER */}
        <section className="welcome-banner">
          <p className="welcome-label">
            YOUR LEARNING JOURNEY
          </p>

          <h1>Welcome, Student!</h1>

          <p>
            Find the right tutor and get the support
            you need to succeed in your courses.
          </p>
        </section>

        {/* COURSE SECTION */}
        <section className="course-section">
          <div className="section-heading">
            <h2>Explore Your Courses</h2>
            <a href="#">View all</a>
          </div>

          <div className="course-grid">
            <article className="course-card">
              <div className="course-icon">{"</>"}</div>
              <h3>Computer Science</h3>
              <p>
                Get help with programming and coding.
              </p>
            </article>

            <article className="course-card">
              <div className="course-icon">∑</div>
              <h3>Mathematics</h3>
              <p>
                Practice concepts and solve problems.
              </p>
            </article>

            <article className="course-card">
              <div className="course-icon">A</div>
              <h3>Writing</h3>
              <p>
                Improve essays and writing skills.
              </p>
            </article>
          </div>
        </section>

        {/* TUTOR DISCOVERY */}
        <section className="tutor-section">
          <h2>Find Your Tutor</h2>

          <p>
            Explore tutors, compare subjects, and find
            someone who fits your learning needs.
          </p>

          <a href="#" className="tutor-action">
            Explore Tutors →
          </a>
        </section>

        {/* FOOTER */}
        <footer className="dashboard-footer">
          CampusConnect · Your campus learning community
        </footer>

      </main>
    </div>
  );
}


export default Dashboard;
