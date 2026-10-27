
import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";

function getFriendlyError(error, action) {
  console.error(`Wishlist ${action} failed:`, {
    code: error?.code,
    message: error?.message,
    error,
  });

  switch (error?.code) {
    case "permission-denied":
      return "Firestore permission denied. Check your Firestore security rules for users/{uid}/wishlist.";
    case "unauthenticated":
      return "Your session has expired. Please sign in again.";
    case "unavailable":
      return "Firestore is temporarily unavailable. Check your internet connection.";
    case "failed-precondition":
      return "Firestore could not complete this request. Check your database configuration.";
    default:
      return `Could not ${action} wishlist item${
        error?.code ? ` (${error.code})` : ""
      }. ${error?.message || "Please check Firebase configuration and Firestore rules."}`;
  }
}

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(auth.currentUser);

  const load = useCallback(async (currentUser) => {
    if (!currentUser) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const wishlistRef = collection(
        db,
        "users",
        currentUser.uid,
        "wishlist"
      );

      const snapshot = await getDocs(wishlistRef);

      const loadedItems = snapshot.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...itemDoc.data(),
      }));

      loadedItems.sort(
        (a, b) =>
          (b.createdAt?.seconds || 0) -
          (a.createdAt?.seconds || 0)
      );

      setItems(loadedItems);
    } catch (loadError) {
      setError(getFriendlyError(loadError, "load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        load(currentUser);
      } else {
        setItems([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [load]);

  async function add(event) {
    event.preventDefault();
    setError("");

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError("Please sign in before saving products.");
      return;
    }

    const cleanName = name.trim();
    const cleanUrl = url.trim();

    if (!cleanName) {
      setError("Enter a product name first.");
      return;
    }

    if (cleanUrl) {
      try {
        const parsedUrl = new URL(cleanUrl);

        if (
          parsedUrl.protocol !== "https:" &&
          parsedUrl.protocol !== "http:"
        ) {
          setError("Product links must use HTTP or HTTPS.");
          return;
        }
      } catch {
        setError("Enter a valid product URL or leave the link empty.");
        return;
      }
    }

    setSaving(true);

    try {
      const wishlistRef = collection(
        db,
        "users",
        currentUser.uid,
        "wishlist"
      );

      const payload = {
        name: cleanName,
        url: cleanUrl,
        createdAt: serverTimestamp(),
      };

      const savedDoc = await addDoc(wishlistRef, payload);

      setItems((previous) => [
        {
          id: savedDoc.id,
          name: cleanName,
          url: cleanUrl,
          createdAt: {
            seconds: Math.floor(Date.now() / 1000),
          },
        },
        ...previous,
      ]);

      setName("");
      setUrl("");
      setError("");
    } catch (saveError) {
      setError(getFriendlyError(saveError, "save"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(itemId) {
    setError("");

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError("Please sign in again before removing wishlist items.");
      return;
    }

    setRemovingId(itemId);

    try {
      await deleteDoc(
        doc(
          db,
          "users",
          currentUser.uid,
          "wishlist",
          itemId
        )
      );

      setItems((previous) =>
        previous.filter((item) => item.id !== itemId)
      );
    } catch (removeError) {
      setError(getFriendlyError(removeError, "remove"));
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="standard-page">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line"></span>
            YOUR SHORTLIST
          </div>

          <h1>Wishlist</h1>

          <p className="page-subtitle">
            Keep interesting finds close while you decide
            what is worth buying.
          </p>
        </div>

        <Link className="button button-secondary" to="/analyze">
          Analyze a Reel ↗
        </Link>
      </div>

      {error && (
        <div
          className="alert-error"
          role="alert"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {error}
        </div>
      )}

      {!user && !loading && (
        <div className="alert-error" role="status">
          You are not signed in. Please sign in to use your wishlist.
        </div>
      )}

      <div className="wishlist-layout">
        <section className="wishlist-add panel">
          <div className="form-icon">♡</div>
          <h2>Add a product</h2>
          <p>Save a product name and optional link for later.</p>

          <form onSubmit={add}>
            <label htmlFor="wishlist-name">Product name</label>

            <input
              id="wishlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Everyday running shoes"
              required
              maxLength={160}
              disabled={saving}
            />

            <label htmlFor="wishlist-url">
              Product link <span>(optional)</span>
            </label>

            <input
              id="wishlist-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              disabled={saving}
            />

            <button
              className="button button-primary full-button"
              type="submit"
              disabled={saving || !user}
            >
              {saving ? "Saving…" : "＋ Save to wishlist"}
            </button>
          </form>
        </section>

        <section className="wishlist-items panel">
          <div className="panel-heading">
            <div>
              <h2>Saved products</h2>
              <p>Things you may want to buy</p>
            </div>

            <span className="count-pill">
              {items.length} saved
            </span>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loader-dot"></div>
              <p>Loading wishlist…</p>
            </div>
          ) : items.length > 0 ? (
            <div className="wishlist-list">
              {items.map((item) => (
                <article className="wishlist-item" key={item.id}>
                  <div className="wishlist-heart">♡</div>

                  <div className="wishlist-info">
                    <strong>{item.name || "Unnamed product"}</strong>
                    <span>Added to your shortlist</span>

                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View product ↗
                      </a>
                    )}
                  </div>

                  <button
                    className="icon-button danger-hover"
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label={`Remove ${item.name || "product"}`}
                    title="Remove"
                    disabled={removingId === item.id}
                  >
                    {removingId === item.id ? "…" : "×"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">♡</div>
              <strong>Your wishlist is waiting</strong>
              <p>
                Save products here to compare and revisit later.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
