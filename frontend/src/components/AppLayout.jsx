
import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const links = [
  { to: "/dashboard", icon: "◫", label: "Overview" },
  { to: "/analyze", icon: "◎", label: "Reel Analyzer" },
  { to: "/history", icon: "◷", label: "Analysis History" },
  { to: "/wishlist", icon: "♡", label: "Wishlist" },
  { to: "/profile", icon: "♙", label: "Profile" },
];

export default function AppLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;

  async function logout() {
    try {
      await signOut(auth);
      setMobileOpen(false);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const currentPage =
    links.find((link) =>
      link.to === "/dashboard"
        ? location.pathname === "/dashboard"
        : location.pathname.startsWith(link.to)
    )?.label || "SocialSight";

  const avatarLetter = (
    user?.displayName ||
    user?.email ||
    "S"
  ).charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <NavLink
          to="/dashboard"
          className="brand"
          onClick={() => setMobileOpen(false)}
        >
          <span className="brand-mark">S</span>
          <span>
            SocialSight
            <small>AI SHOPPING INTELLIGENCE</small>
          </span>
        </NavLink>

        <div className="nav-caption">WORKSPACE</div>

        <nav className="side-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/dashboard"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon">{link.icon}</span>
              {link.label}

              {link.to === "/analyze" && (
                <span className="nav-arrow">↗</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">✦</span>
            <strong>Shop smarter</strong>
            <p>
              Turn social buzz into confident buying decisions.
            </p>
            <NavLink
              to="/analyze"
              onClick={() => setMobileOpen(false)}
            >
              Start an analysis <span>→</span>
            </NavLink>
          </div>

          <div className="profile-row">
            <div className="avatar">{avatarLetter}</div>

            <div className="profile-copy">
              <strong>{user?.displayName || "Your account"}</strong>
              <span>{user?.email || "Signed in"}</span>
            </div>

            <button
              className="logout-icon"
              onClick={logout}
              title="Log out"
              aria-label="Log out"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{currentPage}</strong>
          </div>

          <div className="topbar-right">
            <span className="status-dot"></span>
            <span>AI workspace</span>
            <div className="top-avatar">{avatarLetter}</div>
          </div>
        </header>

        <div className="page-content">{children}</div>

        <footer className="app-footer">
          <span>© {new Date().getFullYear()} SocialSight</span>
          <span>
            Insights for smarter shopping <b>✦</b>
          </span>
        </footer>
      </main>
    </div>
  );
}
