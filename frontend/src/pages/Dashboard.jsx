
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";

function shortDate(value) {
  const date = value?.toDate
    ? value.toDate()
    : value
      ? new Date(value)
      : null;

  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently";
}

export default function Dashboard() {
  const [user, setUser] = useState(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(true);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Keep the dashboard synced with Firebase Authentication.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setAnalyses([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Load the signed-in user's analysis history.
  useEffect(() => {
    let alive = true;

    async function loadAnalyses() {
      if (authLoading) return;

      if (!user) {
        setAnalyses([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const analysesQuery = query(
          collection(db, "users", user.uid, "analyses"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(analysesQuery);

        if (alive) {
          setAnalyses(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            }))
          );
        }
      } catch (error) {
        console.warn("Could not load dashboard history:", error);

        // Do not crash the dashboard if history cannot be loaded.
        if (alive) setAnalyses([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAnalyses();

    return () => {
      alive = false;
    };
  }, [user?.uid, authLoading]);

  const latest = analyses.slice(0, 3);
  const firstName = user?.displayName?.trim()?.split(/\s+/)[0];

  return (
    <div className="dashboard-page">
      {/* Welcome */}
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line"></span>
            YOUR SHOPPING INTELLIGENCE
          </div>

          <h1>
            Good to see you{firstName ? `, ${firstName}` : ""}.
          </h1>

          <p className="page-subtitle">
            Understand the hype. Check the evidence. Buy with confidence.
          </p>
        </div>

        <Link className="button button-primary" to="/analyze">
          <span>＋</span> Analyze a Reel
        </Link>
      </section>

      {/* Hero banner */}
      <section className="hero-banner">
        <div className="hero-copy">
          <span className="hero-pill">
            <span className="sparkle">✦</span>
            SOCIAL SIGNALS, MADE USEFUL
          </span>

          <h2>
            Before you buy,
            <br />
            <em>know the story.</em>
          </h2>

          <p>
            Analyze Instagram product Reels, explore audience sentiment,
            review evidence, and compare retailer listings — all in one place.
          </p>

          <Link to="/analyze" className="hero-cta">
            Start your first analysis <span>↗</span>
          </Link>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-one"></div>
          <div className="orb orb-two"></div>

          <div className="floating-card float-top">
            <span className="float-icon">✦</span>
            <span>
              <b>Social signals</b>
              <small>Comments &amp; sentiment</small>
            </span>
            <span className="float-check">✓</span>
          </div>

          <div className="analytics-orb">
            <div className="orbit-ring"></div>
            <div className="orb-core">
              S<span>✦</span>
            </div>
            <div className="orbit-dot dot-a"></div>
            <div className="orbit-dot dot-b"></div>
          </div>

          <div className="floating-card float-bottom">
            <span className="mini-bars">
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span>
              <b>Smarter decisions</b>
              <small>Evidence-led insights</small>
            </span>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <div className="section-heading">
        <div>
          <h2>Your workspace</h2>
          <p>
            Everything you need to make your next purchase a smart one.
          </p>
        </div>
      </div>

      <section className="feature-grid">
        <Link to="/analyze" className="feature-card">
          <div className="feature-icon icon-purple">◎</div>
          <div className="feature-meta">
            CORE TOOL <span>↗</span>
          </div>
          <h3>Reel Analyzer</h3>
          <p>
            Turn a public Instagram Reel into a product breakdown,
            sentiment snapshot and buying recommendation.
          </p>
          <div className="feature-link">
            Analyze a product <span>→</span>
          </div>
        </Link>

        <Link to="/history" className="feature-card">
          <div className="feature-icon icon-blue">◷</div>
          <div className="feature-meta">
            YOUR RECORDS <span>↗</span>
          </div>
          <h3>Analysis History</h3>
          <p>
            Revisit your previous assessments and keep useful product
            research in one place.
          </p>
          <div className="feature-link">
            View history <span>→</span>
          </div>
        </Link>

        <Link to="/wishlist" className="feature-card">
          <div className="feature-icon icon-pink">♡</div>
          <div className="feature-meta">
            SAVED FOR LATER <span>↗</span>
          </div>
          <h3>Wishlist</h3>
          <p>
            Keep a shortlist of products you want to compare or consider
            buying later.
          </p>
          <div className="feature-link">
            Open wishlist <span>→</span>
          </div>
        </Link>

        <Link to="/profile" className="feature-card">
          <div className="feature-icon icon-purple">♙</div>
          <div className="feature-meta">
            YOUR ACCOUNT <span>↗</span>
          </div>
          <h3>My Profile</h3>
          <p>
            Manage your name, contact information, bio and profile photo.
          </p>
          <div className="feature-link">
            Edit your profile <span>→</span>
          </div>
        </Link>
      </section>

      {/* Recent analyses */}
      <section className="recent-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent analyses</h2>
            <p>Your latest product assessments</p>
          </div>

          <Link to="/history" className="text-link">
            View all <span>→</span>
          </Link>
        </div>

        {authLoading || loading ? (
          <div className="empty-state">
            <div className="loader-dot"></div>
            <p>Loading your recent analyses…</p>
          </div>
        ) : latest.length > 0 ? (
          <div className="recent-list">
            {latest.map((item) => {
              const productName =
                item.analysis?.productName ||
                item.productDescription ||
                "Product assessment";

              const confidence = item.analysis?.confidence;

              return (
                <div className="recent-item" key={item.id}>
                  <div className="recent-product-icon">◈</div>

                  <div className="recent-details">
                    <strong>{productName}</strong>
                    <span>
                      {item.reelUrl || "Instagram Reel"} ·{" "}
                      {shortDate(item.createdAt || item.analyzedAt)}
                    </span>
                  </div>

                  <span className="recent-score">
                    {confidence ?? "—"}
                    <small>
                      {confidence != null ? "% confidence" : "confidence"}
                    </small>
                  </span>

                  <Link
                    to="/history"
                    className="recent-open"
                    aria-label={`View history for ${productName}`}
                  >
                    ↗
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">◷</div>
            <strong>No analyses yet</strong>
            <p>Your completed Reel analyses will appear here.</p>
            <Link to="/analyze" className="button button-secondary">
              Analyze your first Reel
            </Link>
          </div>
        )}
      </section>

      {/* Disclaimer */}
      <div className="disclaimer-strip">
        <span>ⓘ</span>
        <p>
          AI-generated insights are preliminary. Always verify product
          claims, sellers and final prices before purchasing.
        </p>
      </div>
    </div>
  );
}
