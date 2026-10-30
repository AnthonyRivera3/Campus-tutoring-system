import { useNavigate } from "react-router-dom";

// Logs the user out of either dashboard. The backend uses stateless JWTs, so
// there's no server call; we just drop the token/user saved at login.
// Styled by .header-logout in pages/Dashboard.css.
function LogoutButton() {
  const navigate = useNavigate();

  function handleLogout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    // replace: the back button won't return to the dashboard
    navigate("/login", { replace: true });
  }

  return (
    <button type="button" className="header-logout" onClick={handleLogout}>
      Log Out
    </button>
  );
}

export default LogoutButton;
