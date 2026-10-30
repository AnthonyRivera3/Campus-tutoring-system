const API_BASE = "http://localhost:5001/api";

// fetch wrapper for logged-in requests. Adds the saved token, parses JSON,
// and throws an Error with the backend's message when the request fails.
// An expired/invalid token sends the user back to the login page.
//
// `path` is everything after /api. `body` is a plain object (it gets
// JSON-encoded for you). Usage:
//   const slots = await apiRequest("/tutor/availability");
//   await apiRequest("/tutor/requests/5", { method: "PATCH", body: { status: "ACCEPTED" } });
// Wrap calls in try/catch and show err.message to the user.
//
// Note: Login.jsx still calls fetch directly since it runs before there's a token.
export async function apiRequest(path, { method = "GET", body } = {}) {
  const token = sessionStorage.getItem("token");

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Fall back to {} if the response has no JSON body
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.assign("/login");
  }

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }

  return data;
}
