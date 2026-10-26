// Finds where the typed query matches the start of a word in `text`.
// Spaces are ignored, so "csc211" matches "CSC 211" and "datast" matches "Data Structures".
// Returns [start, end] indexes into `text` for highlighting, or null if there is no match.
//
//   findMatch("Arvind", "ar")                  -> [0, 2]
//   findMatch("Arvind", "vi")                  -> null  (not the start of a word)
//   findMatch("Data Structures", "struct")     -> [5, 11]
//
// Used by searchCatalog to filter, and by SearchBar to bold the matched part.
export function findMatch(text, query) {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return null;
  const lower = text.toLowerCase();

  for (let start = 0; start < lower.length; start++) {
    const isWordStart = start === 0 || lower[start - 1] === " ";
    if (!isWordStart || lower[start] === " ") continue;

    // Walk forward from this word, skipping spaces in the text, until every
    // character of the query has been matched or a character doesn't line up
    let i = start; // position in text
    let matched = 0; // how many query characters have matched so far
    while (i < lower.length && matched < q.length) {
      if (lower[i] === " ") {
        i++;
      } else if (lower[i] === q[matched]) {
        i++;
        matched++;
      } else {
        break;
      }
    }
    if (matched === q.length) return [start, i];
  }
  return null;
}
