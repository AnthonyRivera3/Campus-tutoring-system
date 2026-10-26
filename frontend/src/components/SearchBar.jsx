import { useEffect, useRef, useState } from "react";
import { searchCatalog } from "../data/mockData";
import { findMatch } from "../utils/textMatch";
import "./SearchBar.css";

// Search bar in the dashboard header. Results update on every keystroke and show
// in a dropdown split into Courses and Tutors.
//
// Results currently come from the fake data in data/mockData.js. Clicking a result
// doesn't do anything yet; hook that up once tutor/course pages exist.

// Bolds the part of `text` that matches what the user typed
function Highlight({ text, query }) {
  const match = findMatch(text, query);
  if (!match) return text;
  const [start, end] = match;
  return (
    <>
      {text.slice(0, start)}
      <mark className="search-highlight">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function SearchBar() {
  const [query, setQuery] = useState(""); // what's typed in the input
  const [isOpen, setIsOpen] = useState(false); // whether the dropdown is showing
  const formRef = useRef(null); // used to detect clicks outside the search bar

  // Recomputed on every render. Fine for a small local list, but once this calls
  // the backend it should move into a useEffect (and probably be debounced).
  const results = searchCatalog(query);
  const hasResults = results.courses.length > 0 || results.tutors.length > 0;

  // Close the dropdown when clicking anywhere outside the search bar
  useEffect(() => {
    function handleClickOutside(e) {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <form
      ref={formRef}
      className="header-search"
      onSubmit={(e) => {
        e.preventDefault();
        setIsOpen(true);
      }}
    >
      <input
        type="text"
        placeholder="Search tutors or courses..."
        aria-label="Search tutors or courses"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
      />
      <button type="submit">Search</button>

      {/* Dropdown only shows once something other than spaces has been typed */}
      {isOpen && query.trim() && (
        <div className="search-results">
          {!hasResults && (
            <p className="search-empty">No tutors or courses match "{query}"</p>
          )}

          {results.courses.length > 0 && (
            <div className="search-group">
              <p className="search-group-title">Courses</p>
              {results.courses.map((course) => (
                <div key={course.code} className="search-item">
                  <span className="search-item-main">
                    <Highlight text={course.code} query={query} />
                  </span>
                  <span className="search-item-sub">
                    <Highlight text={course.title} query={query} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {results.tutors.length > 0 && (
            <div className="search-group">
              <p className="search-group-title">Tutors</p>
              {results.tutors.map((tutor) => (
                <div key={tutor.id} className="search-item">
                  <span className="search-item-main">
                    <Highlight text={tutor.name} query={query} />{" "}
                    <span className="search-rating">★ {tutor.rating}</span>
                  </span>
                  <span className="search-item-sub">{tutor.courses.join(" · ")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export default SearchBar;
