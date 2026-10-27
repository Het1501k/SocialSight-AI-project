
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { updateProfile, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";

const initialForm = {
  name: "",
  phone: "",
  bio: "",
  photoURL: "",
};

export default function Profile() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const user = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          navigate("/login", { replace: true });
          return;
        }

        const ref = doc(db, "users", currentUser.uid);
        const snapshot = await getDoc(ref);
        const data = snapshot.exists() ? snapshot.data() : {};

        if (active) {
          setForm({
            name: data.name || currentUser.displayName || "",
            phone: data.phone || "",
            bio: data.bio || "",
            photoURL: data.photoURL || currentUser.photoURL || "",
          });
        }
      } catch (err) {
        console.error("Load profile failed:", err);

        if (active) {
          setError(
            `Could not load your profile (${err.code || "unknown error"}).`
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError("Your session expired. Please log in again.");
      return;
    }

    const cleanName = form.name.trim();

    if (cleanName.length < 2) {
      setError("Name must contain at least 2 characters.");
      return;
    }

    if (form.phone.trim().length > 30) {
      setError("Phone number is too long.");
      return;
    }

    if (form.bio.trim().length > 300) {
      setError("Bio must be 300 characters or fewer.");
      return;
    }

    if (form.photoURL.trim()) {
      try {
        const photo = new URL(form.photoURL.trim());

        if (
          photo.protocol !== "https:" &&
          photo.protocol !== "http:"
        ) {
          setError("Profile photo URL must use HTTP or HTTPS.");
          return;
        }
      } catch {
        setError("Enter a valid photo URL or leave it empty.");
        return;
      }
    }

    setSaving(true);

    try {
      const profileRef = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(profileRef);

      const profileData = {
        uid: currentUser.uid,
        name: cleanName,
        email: currentUser.email || "",
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        photoURL: form.photoURL.trim(),
        updatedAt: serverTimestamp(),
      };

      if (!snapshot.exists()) {
        profileData.createdAt = serverTimestamp();
      }

      await setDoc(profileRef, profileData, { merge: true });

      await updateProfile(currentUser, {
        displayName: cleanName,
        photoURL: form.photoURL.trim() || null,
      });

      setForm((previous) => ({
        ...previous,
        name: cleanName,
      }));

      window.dispatchEvent(
        new Event("socialsight-profile-updated")
      );

      setMessage("Profile saved successfully!");
    } catch (err) {
      console.error("Save profile failed:", err);
      setError(
        `Could not save your profile (${err.code || "unknown error"}). Check Firestore rules.`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setError("");
    setMessage("");
    setLoggingOut(true);

    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
      setError("Could not log out. Please try again.");
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="standard-page">
        <p>Loading profile…</p>
      </main>
    );
  }

  const initial =
    form.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="standard-page">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            YOUR ACCOUNT
          </div>

          <h1>My Profile</h1>

          <p className="page-subtitle">
            Manage your personal information and account details.
          </p>
        </div>
      </div>

      {message && (
        <div className="alert-success">{message}</div>
      )}

      {error && (
        <div className="alert-error">{error}</div>
      )}

      <div className="profile-layout">
        <section className="panel profile-summary">
          {form.photoURL ? (
            <img
              className="profile-avatar-large"
              src={form.photoURL}
              alt="Profile"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="profile-avatar-large profile-avatar-fallback">
              {initial}
            </div>
          )}

          <h2>{form.name || "Your name"}</h2>
          <p>{user?.email || "No email available"}</p>

          <span className="count-pill">
            SocialSight member
          </span>

          <button
            type="button"
            className="button button-primary profile-logout-button"
            onClick={handleLogout}
            disabled={loggingOut || saving}
          >
            {loggingOut ? "Logging out…" : "↗ Log Out"}
          </button>
        </section>

        <section className="panel profile-form-panel">
          <h2>Personal information</h2>

          <p className="page-subtitle">
            Update the information shown on your account.
          </p>

          <form onSubmit={handleSubmit} className="profile-form">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              maxLength={100}
              required
            />

            <label htmlFor="profile-email">Email address</label>
            <input
              id="profile-email"
              value={user?.email || ""}
              readOnly
              disabled
            />

            <small>
              Email is managed by your login account.
            </small>

            <label htmlFor="profile-phone">Phone number</label>
            <input
              id="profile-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              maxLength={30}
              placeholder="Enter your phone number"
            />

            <label htmlFor="profile-bio">About you</label>
            <textarea
              id="profile-bio"
              name="bio"
              value={form.bio}
              onChange={handleChange}
              maxLength={300}
              rows={4}
              placeholder="Tell us a little about yourself"
            />

            <small>{form.bio.length}/300 characters</small>

            <label htmlFor="profile-photo">
              Profile photo URL
            </label>

            <input
              id="profile-photo"
              name="photoURL"
              type="url"
              value={form.photoURL}
              onChange={handleChange}
              placeholder="https://example.com/photo.jpg"
            />

            <button
              className="button button-primary"
              type="submit"
              disabled={saving || loggingOut || !auth.currentUser}
            >
              {saving ? "Saving profile…" : "Save changes"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
