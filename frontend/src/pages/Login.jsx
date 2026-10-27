
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Authenticate with Firebase.
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = result.user;

      // 2. Check the user's Firestore profile.
      const profileRef = doc(db, "users", user.uid);
      const profileSnapshot = await getDoc(profileRef);

      // 3. Create a profile only if it does not exist.
      if (!profileSnapshot.exists()) {
        await setDoc(profileRef, {
          uid: user.uid,
          name: user.displayName || "",
          email: user.email || email.trim(),
          phone: "",
          bio: "",
          photoURL: user.photoURL || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 4. Open the dashboard.
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Login failed:", err);

      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Incorrect email or password.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait and try again.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Check your internet connection.");
      } else if (
        err.code === "permission-denied" ||
        err.code === "firestore/permission-denied"
      ) {
        setError(
          "Login may have succeeded, but Firestore denied profile access. Check your Firestore security rules."
        );
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          SocialSight
        </div>

        <div className="auth-visual-copy">
          <span className="hero-pill">
            ✦ SOCIAL COMMERCE INTELLIGENCE
          </span>

          <h2>
            Make every
            <br />
            purchase a little
            <br />
            <em>more informed.</em>
          </h2>

          <p>
            Decode the buzz around products, understand real
            audience signals and shop with greater confidence.
          </p>
        </div>

        <div className="auth-visual-art"></div>

        <div className="auth-footer">
          Insights for smarter shopping · Built for curious minds
        </div>
      </section>

      <section className="auth-form-side">
        <form className="auth-card" onSubmit={handleLogin}>
          <div className="eyebrow">
            <span className="eyebrow-line"></span>
            YOUR WORKSPACE
          </div>

          <h1>Welcome back</h1>
          <p>Sign in to continue to your SocialSight dashboard.</p>

          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in to SocialSight  →"}
          </button>

          <p className="auth-switch">
            New to SocialSight?{" "}
            <Link to="/signup">Create an account</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
