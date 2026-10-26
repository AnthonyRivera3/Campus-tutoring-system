import { findMatch } from "../utils/textMatch";

// Fake data used until the frontend is connected to the backend.
//
// When the API is ready, replace searchCatalog with a fetch to the backend. As long
// as it returns the same { courses, tutors } shape, SearchBar won't need changes
// (other than awaiting the result, since a fetch is async).
//
// Course titles are placeholders. Double check them against the CSI catalog.

// Course: { code, title }
export const courses = [
  { code: "CSC 126", title: "Introduction to Computer Science" },
  { code: "CSC 211", title: "Intermediate Programming" },
  { code: "CSC 220", title: "Discrete Structures" },
  { code: "CSC 228", title: "Data Structures and Algorithms" },
  { code: "CSC 326", title: "Information Structures" },
  { code: "CSC 330", title: "Object-Oriented Software Design" },
  { code: "CSC 346", title: "Switching and Automata Theory" },
  { code: "CSC 446", title: "Computer Architecture" },
];

// Tutor: { id, name, courses, rating }
// `courses` holds course codes, which need to match the codes in the list above
export const tutors = [
  { id: 1, name: "Arvind", courses: ["CSC 126", "CSC 211", "CSC 228"], rating: 4.9 },
  { id: 2, name: "Otilda", courses: ["CSC 220", "CSC 346"], rating: 4.8 },
  { id: 3, name: "Jiya", courses: ["CSC 126", "CSC 330"], rating: 4.7 },
  { id: 4, name: "Axana", courses: ["CSC 228", "CSC 326", "CSC 446"], rating: 4.9 },
  { id: 5, name: "Anthony", courses: ["CSC 211", "CSC 220", "CSC 330"], rating: 4.6 },
];

// Returns the courses and tutors that match the query.
// Courses match on code or title, and tutors match on name.
export function searchCatalog(query) {
  if (!query.trim()) return { courses: [], tutors: [] };

  const matchedCourses = courses.filter(
    (course) => findMatch(course.code, query) || findMatch(course.title, query)
  );
  const matchedCodes = matchedCourses.map((course) => course.code);

  // Only link tutors through courses when a course number is typed (e.g. "211"),
  // otherwise typing a single letter would list every tutor
  const isCourseNumber = /\d/.test(query);

  const matchedTutors = tutors.filter(
    (tutor) =>
      findMatch(tutor.name, query) ||
      (isCourseNumber && tutor.courses.some((code) => matchedCodes.includes(code)))
  );

  const byName = (a, b) => a.name.localeCompare(b.name);
  return { courses: matchedCourses, tutors: matchedTutors.sort(byName) };
}
