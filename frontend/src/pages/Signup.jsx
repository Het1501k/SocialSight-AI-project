
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSignup(e) {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create the Firebase Authentication account.
      const result = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // 2. Set the Firebase user's display name.
      await updateProfile(result.user, {
        displayName: cleanName,
      });

      // 3. Create the user's profile document in Firestore.
      // Document ID is the authenticated user's UID.
      await setDoc(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        name: cleanName,
        email: result.user.email || cleanEmail,
        phone: "",
        bio: "",
        photoURL: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Continue to the dashboard.
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Signup failed:", err);

      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setError("Choose a stronger password.");
      } else if (
        err.code === "permission-denied" ||
        err.code === "firestore/permission-denied"
      ) {
        setError(
          "Your account may have been created, but Firestore denied the profile save. Check your security rules, then try logging in."
        );
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Check your internet connection.");
      } else {
        setError(err.message || "Signup failed. Please try again.");
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
            ✦ YOUR SMARTER SHOPPING JOURNEY
          </span>

          <h2>
            Less guessing.
            <br />
            More <em>knowing.</em>
          </h2>

          <p>
            Build a personal workspace for product research,
            social sentiment and buying decisions grounded in
            accessible evidence.
          </p>
        </div>

        <div className="auth-visual-art"></div>

        <div className="auth-footer">
          Insights for smarter shopping · Built for curious minds
        </div>
      </section>

      <section className="auth-form-side">
        <form className="auth-card" onSubmit={handleSignup}>
          <div className="eyebrow">
            <span className="eyebrow-line"></span>
            GET STARTED
          </div>

          <h1>Create your account</h1>
          <p>Set up your SocialSight workspace in just a moment.</p>

          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
            placeholder="Your name"
          />

          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />

          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
          />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Creating your account…" : "Create account  →"}
          </button>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
