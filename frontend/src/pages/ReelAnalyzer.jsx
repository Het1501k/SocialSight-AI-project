import { useState } from "react";
import axios from "axios";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const API_URL = "https://socialsight-backend.onrender.com";

const api = axios.create({
  baseURL: API_URL,
});

const palette = {
  ink: "#211d38", muted: "#77758c", purple: "#6757e8",
  border: "#e9e7f4", surface: "#ffffff", canvas: "#f7f7fc",
  green: "#16845b", greenBg: "#e9f8f0", red: "#c44956",
  redBg: "#fff0f1", amber: "#a86b12", amberBg: "#fff6e5",
};

const card = {
  background: palette.surface, border: `1px solid ${palette.border}`,
  borderRadius: 18, padding: 22, minWidth: 0,
  boxShadow: "0 5px 22px rgba(35, 25, 85, .035)",
};
const sectionTitle = { margin: "0 0 15px", color: palette.ink, fontSize: 17, fontWeight: 750 };
const mutedText = { color: palette.muted, lineHeight: 1.7, fontSize: 14 };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}
function sentimentValue(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n) : null;
}
function prettyPrice(price) {
  if (price == null || price === "") return "Price unavailable";
  return String(price);
}

function MetricCard({ label, value, hint, tone = "purple" }) {
  const colors = {
    purple: { bg: "#f0eeff", fg: palette.purple },
    green: { bg: palette.greenBg, fg: palette.green },
    amber: { bg: palette.amberBg, fg: palette.amber },
    red: { bg: palette.redBg, fg: palette.red },
    gray: { bg: "#f2f2f8", fg: "#5e5a76" },
  };
  const c = colors[tone] || colors.purple;
  return <div style={{ ...card, padding: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: c.fg, flexShrink: 0 }} />
      <span style={{ color: palette.muted, fontSize: 13, fontWeight: 650 }}>{label}</span>
    </div>
    <div style={{ fontSize: 27, lineHeight: 1.2, color: palette.ink, fontWeight: 800, overflowWrap: "anywhere" }}>{value}</div>
    {hint && <div style={{ ...mutedText, marginTop: 7, fontSize: 12 }}>{hint}</div>}
  </div>;
}

function Panel({ title, eyebrow, children, style = {} }) {
  return <section style={{ ...card, ...style }}>
    {eyebrow && <div style={{ color: palette.purple, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, marginBottom: 7 }}>{eyebrow}</div>}
    <h3 style={sectionTitle}>{title}</h3>
    {children}
  </section>;
}

function BulletList({ items, emptyMessage }) {
  const list = asArray(items);
  if (!list.length) return <p style={mutedText}>{emptyMessage}</p>;
  return <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 11 }}>
    {list.map((item, i) => {
      const text = typeof item === "string" ? item : (item?.text || item?.reason || item?.title || JSON.stringify(item));
      return <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#45415c", lineHeight: 1.65, fontSize: 14 }}>
        <span style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 8, background: "#f0eeff", color: palette.purple, fontWeight: 800, fontSize: 12 }}>{i + 1}</span>
        <span>{text}</span>
      </li>;
    })}
  </ul>;
}

function SentimentPanel({ sentiment }) {
  const rows = [
    { key: "positive", label: "Positive", color: "#20a477", bg: "#e9f8f0" },
    { key: "neutral", label: "Neutral", color: "#8b85a6", bg: "#f0eff6" },
    { key: "negative", label: "Negative", color: "#e16b78", bg: "#fff0f1" },
  ];
  const values = rows.map(row => ({ ...row, value: sentimentValue(sentiment?.[row.key]) }));
  const total = values.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const percent = (row) => {
    if (row.value == null) return 0;
    // Handle either percentage values or raw comment counts.
    return total > 0 && total <= 100 ? row.value : (total ? row.value / total * 100 : 0);
  };
  return <Panel title="Comment sentiment" eyebrow="AUDIENCE SIGNAL">
    <p style={{ ...mutedText, marginTop: -4 }}>{sentiment?.status || "Sentiment summary from comments accessible on this Reel."}</p>
    <div style={{ display: "grid", gap: 15, marginTop: 20 }}>
      {values.map(row => {
        const pct = percent(row);
        return <div key={row.key}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 7, fontSize: 13 }}>
            <span style={{ color: "#4b4762", fontWeight: 650 }}>{row.label}</span>
            <strong style={{ color: row.color }}>{row.value == null ? "N/A" : `${Number.isInteger(row.value) ? row.value : row.value.toFixed(1)}${total > 0 && total <= 100 ? "%" : ""}`}</strong>
          </div>
          <div style={{ height: 8, background: row.bg, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${clamp(pct)}%`, background: row.color, borderRadius: 99, transition: "width .3s ease" }} />
          </div>
        </div>;
      })}
    </div>
  </Panel>;
}

function TrustPanel({ trust }) {
  const score = trust?.score == null ? null : clamp(trust.score);
  const tone = score == null ? "gray" : score >= 70 ? "green" : score >= 40 ? "amber" : "red";
  const toneColor = tone === "green" ? palette.green : tone === "amber" ? palette.amber : tone === "red" ? palette.red : palette.muted;
  return <Panel title="Review trust" eyebrow="EVIDENCE COVERAGE">
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ width: 112, height: 112, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: score == null ? "#f2f1f7" : `conic-gradient(${toneColor} ${score * 3.6}deg, #efedf5 0deg)` }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <strong style={{ color: palette.ink, fontSize: 25 }}>{score == null ? "—" : score}</strong>
          <span style={{ color: palette.muted, fontSize: 10 }}>/ 100</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ color: toneColor, fontWeight: 800, fontSize: 15, marginBottom: 7 }}>{trust?.status || "Not enough evidence"}</div>
        <p style={{ ...mutedText, margin: 0 }}>This score reflects how much comment evidence was available. It does not prove reviews are genuine or fake.</p>
        {trust?.commentsAnalyzed != null && <div style={{ marginTop: 10, fontSize: 12, color: palette.muted }}>Comments analyzed: <strong style={{ color: palette.ink }}>{trust.commentsAnalyzed}</strong></div>}
      </div>
    </div>
  </Panel>;
}


function PriceComparison({ items }) {
  const list = asArray(items);

  const validItems = list
    .filter((item) => item && (item.title || item.retailer || item.source))
    .map((item, index) => ({
      ...item,
      retailer: item.retailer || item.source || `Retailer ${index + 1}`,
      url: item.url || item.product_link || item.link || null,
      image: item.image || item.thumbnail || null,
      numericPrice:
        typeof item.price === "number"
          ? item.price
          : Number.isFinite(Number(item.price)) && item.price != null
            ? Number(item.price)
            : null,
    }))
    .sort((a, b) => {
      if (a.numericPrice == null && b.numericPrice == null) return 0;
      if (a.numericPrice == null) return 1;
      if (b.numericPrice == null) return -1;
      return a.numericPrice - b.numericPrice;
    });

  if (!validItems.length) {
    return (
      <Panel title="Price comparison" eyebrow="COMPARE BEFORE YOU BUY">
        <div
          style={{
            padding: 24,
            borderRadius: 14,
            background: "#faf9ff",
            border: `1px dashed ${palette.border}`,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>₹</div>
          <strong style={{ color: palette.ink }}>
            No shopping listings found
          </strong>
          <p style={{ ...mutedText, marginBottom: 0 }}>
            Try providing the exact product name, brand or model. If no
            listings appear, check that Google Shopping is configured in
            your backend.
          </p>
        </div>
      </Panel>
    );
  }

  const pricedItems = validItems.filter((item) => item.numericPrice != null);
  const lowestPrice = pricedItems.length
    ? Math.min(...pricedItems.map((item) => item.numericPrice))
    : null;

  return (
    <Panel title="Price comparison" eyebrow="COMPARE BEFORE YOU BUY">
      <p style={{ ...mutedText, marginTop: -5 }}>
        Compare available listings and open the retailer page to verify
        the current price, seller and delivery details.
      </p>

      {lowestPrice != null && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 15px",
            borderRadius: 12,
            background: palette.greenBg,
            color: palette.green,
            fontSize: 13,
            fontWeight: 750,
          }}
        >
          Lowest listed price:{" "}
          {pricedItems.find((item) => item.numericPrice === lowestPrice)
            ?.formattedPrice || `₹${lowestPrice.toLocaleString("en-IN")}`}
        </div>
      )}

      <div
        className="ss-price-grid"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
          gap: 14,
          marginTop: 18,
        }}
      >
        {validItems.map((item, index) => {
          const isLowest =
            item.numericPrice != null &&
            item.numericPrice === lowestPrice;

          return (
            <article
              key={`${item.retailer}-${item.url || index}`}
              style={{
                border: `1px solid ${
                  isLowest ? "#b9e8ce" : palette.border
                }`,
                borderRadius: 15,
                padding: 17,
                display: "flex",
                flexDirection: "column",
                gap: 11,
                background: "#fff",
                minWidth: 0,
              }}
            >
              {item.image && (
                <div
                  style={{
                    height: 155,
                    display: "grid",
                    placeItems: "center",
                    background: "#faf9ff",
                    borderRadius: 11,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title || "Product"}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 750,
                    color: palette.ink,
                    fontSize: 14,
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.retailer}
                </span>

                {isLowest && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: palette.green,
                      background: palette.greenBg,
                      padding: "5px 7px",
                      borderRadius: 7,
                    }}
                  >
                    LOWEST PRICE
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 24,
                  color: palette.ink,
                  fontWeight: 850,
                  overflowWrap: "anywhere",
                }}
              >
                {item.formattedPrice ||
                  (item.numericPrice != null
                    ? `₹${item.numericPrice.toLocaleString("en-IN")}`
                    : prettyPrice(item.price))}
              </div>

              {item.title && (
                <p
                  style={{
                    ...mutedText,
                    margin: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.title}
                </p>
              )}

              {(item.rating != null || item.reviews != null) && (
                <div style={{ color: palette.muted, fontSize: 12 }}>
                  {item.rating != null && (
                    <span>★ {item.rating}</span>
                  )}
                  {item.reviews != null && (
                    <span> · {item.reviews} reviews</span>
                  )}
                </div>
              )}

              {item.note && (
                <p
                  style={{
                    ...mutedText,
                    fontSize: 12,
                    margin: 0,
                  }}
                >
                  {item.note}
                </p>
              )}

              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    background: palette.purple,
                    color: "#fff",
                    fontWeight: 750,
                    fontSize: 13,
                    padding: "11px 12px",
                    borderRadius: 9,
                  }}
                >
                  View Product ↗
                </a>
              ) : (
                <span style={{ ...mutedText, fontSize: 12 }}>
                  Direct product link unavailable
                </span>
              )}
            </article>
          );
        })}
      </div>

      <p style={{ ...mutedText, fontSize: 11, marginBottom: 0 }}>
        Prices and stock may change. Confirm the final price on the
        retailer's website before purchasing.
      </p>
    </Panel>
  );
}


export default function ReelAnalyzer() {
  const [reelUrl, setReelUrl] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [sourceData, setSourceData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function analyzeReel(event) {
    event.preventDefault();
    const cleanUrl = reelUrl.trim();
    const cleanDescription = description.trim();
    setError(""); setNotice(""); setResult(null); setSourceData(null);

    const instagramPattern = /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+\/?(?:\?.*)?$/i;
    if (!instagramPattern.test(cleanUrl)) {
      setError("Please enter a valid Instagram Reel or post URL.");
      return;
    }
    if (cleanDescription.length > 2000) {
      setError("Product details must be 2000 characters or fewer.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/analyze`, {
        reelUrl: cleanUrl,
        productDescription: cleanDescription,
      }, { timeout: 240000 });

      if (!response.data?.success || !response.data?.analysis) {
        throw new Error(response.data?.message || "No analysis was returned.");
      }

      const analysis = response.data.analysis;
      setResult(analysis);
      setSourceData(response.data.sourceData || null);

      if (auth.currentUser) {
        setSaving(true);
        try {
          await addDoc(collection(db, "users", auth.currentUser.uid, "analyses"), {
            reelUrl: cleanUrl,
            productDescription: cleanDescription,
            analysis,
            sourceData: response.data.sourceData || null,
            analyzedAt: response.data.analyzedAt || null,
            dataSource: response.data.dataSource || null,
            createdAt: serverTimestamp(),
          });
          setNotice("Analysis completed and saved to your history.");
        } catch (saveError) {
          console.error("Firebase history save failed:", saveError);
          setNotice("Analysis completed, but history could not be saved. Check Firestore permissions and your connection.");
        } finally {
          setSaving(false);
        }
      } else {
        setNotice("Analysis completed. Sign in to save your analysis history.");
      }
    } catch (requestError) {
      console.error("Reel analysis failed:", requestError);
      console.error("Request URL:", requestError.config?.url);
      console.error("HTTP status:", requestError.response?.status);
      console.error("Backend response:", requestError.response?.data);
      const status = requestError.response?.status;
      const serverMessage = requestError.response?.data?.message;
      if (status === 402) setError(serverMessage || "The data provider requires available credits.");
      else if (status === 422) setError(serverMessage || "The Reel was found, but there was not enough accessible data.");
      else if (status === 429 || status === 503) setError(serverMessage || "A service is temporarily busy or its quota is exhausted. Please try again later.");
      else if (status === 504 || requestError.code === "ECONNABORTED") setError("The request took too long. Please try again with another public Reel.");
      else if (!requestError.response) setError("Cannot connect to the backend. Check that the server is running on port 5000.");
      else setError(serverMessage || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setReelUrl(""); setDescription(""); setResult(null); setSourceData(null); setError(""); setNotice("");
  }

  return (
    <main style={{ width: "100%", maxWidth: 1440, margin: "0 auto", padding: "4px 0 36px", color: palette.ink, fontFamily: "inherit", boxSizing: "border-box" }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f0eeff", color: palette.purple, padding: "7px 11px", borderRadius: 9, fontSize: 11, fontWeight: 850, letterSpacing: 1.2 }}>✦ SOCIALSIGHT AI</div>
        <h1 style={{ fontSize: "clamp(27px, 3vw, 36px)", lineHeight: 1.15, letterSpacing: "-1px", margin: "15px 0 8px", color: palette.ink }}>Instagram Reel Analyzer</h1>
        <p style={{ color: palette.muted, fontSize: 15, lineHeight: 1.7, margin: 0, maxWidth: 740 }}>Turn product buzz into a clearer buying decision. Analyze available Reel comments, review evidence and retailer listings in one place.</p>
      </header>

      <form onSubmit={analyzeReel} style={{ ...card, padding: "clamp(18px, 3vw, 28px)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 21 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: "#f0eeff", color: palette.purple, display: "grid", placeItems: "center", fontSize: 20 }}>↗</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, color: palette.ink }}>Start a new analysis</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: palette.muted }}>Use a public Instagram Reel or post URL.</p>
          </div>
        </div>
        <label htmlFor="reelUrl" style={{ display: "block", fontWeight: 750, color: "#393550", fontSize: 13, marginBottom: 8 }}>Instagram Reel URL</label>
        <input id="reelUrl" type="url" required value={reelUrl} onChange={event => setReelUrl(event.target.value)} placeholder="https://www.instagram.com/reel/..." style={{ width: "100%", boxSizing: "border-box", padding: "14px 15px", border: `1px solid ${palette.border}`, borderRadius: 11, fontSize: 14, color: palette.ink, background: "#fcfbff", outlineColor: palette.purple }} />
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <label htmlFor="description" style={{ fontWeight: 750, color: "#393550", fontSize: 13 }}>Additional product details <span style={{ color: palette.muted, fontWeight: 500 }}>(optional)</span></label>
            <span style={{ color: palette.muted, fontSize: 11 }}>{description.length}/2000</span>
          </div>
          <textarea id="description" value={description} maxLength={2000} onChange={event => setDescription(event.target.value)} placeholder="Brand, product name, model or any details you already know…" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "14px 15px", border: `1px solid ${palette.border}`, borderRadius: 11, fontSize: 14, lineHeight: 1.6, color: palette.ink, background: "#fcfbff", resize: "vertical", outlineColor: palette.purple }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
          <button type="submit" disabled={loading} style={{ border: 0, borderRadius: 10, padding: "13px 19px", color: "#fff", background: loading ? "#9d95ef" : palette.purple, fontSize: 14, fontWeight: 800, cursor: loading ? "wait" : "pointer", boxShadow: "0 7px 16px rgba(103,87,232,.18)" }}>{loading ? "Analyzing… please wait" : "✦  Analyze Reel"}</button>
          <button type="button" onClick={clearForm} disabled={loading} style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: "13px 17px", color: "#625d78", background: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>Clear form</button>
        </div>
        {loading && <div role="status" style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, marginTop: 18, borderRadius: 12, background: "#f5f3ff", color: "#5d50cb", fontSize: 13, lineHeight: 1.6 }}>
          <span style={{ width: 18, height: 18, border: "2px solid #d7d1ff", borderTopColor: palette.purple, borderRadius: "50%", flexShrink: 0 }} />
          Fetching available Reel data, analyzing comments and searching retailer listings. This can take a little while.
        </div>}
      </form>

      {error && <div role="alert" style={{ marginBottom: 18, padding: 16, borderRadius: 13, background: palette.redBg, border: "1px solid #f7d5d9", color: "#a42f3e", lineHeight: 1.6 }}><strong>Analysis failed</strong><p style={{ margin: "5px 0 0", fontSize: 14 }}>{error}</p></div>}
      {notice && <div role="status" style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: palette.greenBg, border: "1px solid #cceedd", color: "#176a4d", lineHeight: 1.6, fontSize: 13 }}>✓ &nbsp;{notice}{saving ? " Saving…" : ""}</div>}

      {result && <section aria-live="polite" style={{ marginTop: 26, display: "grid", gap: 16 }}>
        <div style={{ ...card, padding: "clamp(20px, 3vw, 30px)", background: "linear-gradient(120deg, #fff 0%, #faf9ff 100%)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: palette.purple, fontSize: 10, fontWeight: 850, letterSpacing: 1.5, marginBottom: 8 }}>ANALYSIS RESULT</div>
              <h2 style={{ margin: 0, fontSize: "clamp(23px, 3vw, 32px)", lineHeight: 1.2, letterSpacing: "-.6px", overflowWrap: "anywhere" }}>{result.productName || "Product Assessment"}</h2>
              <div style={{ marginTop: 11, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ background: "#f0eeff", color: palette.purple, padding: "6px 9px", borderRadius: 8, fontSize: 12, fontWeight: 750 }}>{result.category || "Category unknown"}</span>
                <span style={{ background: "#f2f2f8", color: "#67627f", padding: "6px 9px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Preliminary AI assessment</span>
              </div>
            </div>
            <div style={{ minWidth: 130, border: `1px solid ${palette.border}`, borderRadius: 14, padding: "14px 18px", background: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: palette.muted, fontWeight: 750, marginBottom: 6 }}>AI CONFIDENCE</div>
              <div style={{ color: palette.purple, fontSize: 30, fontWeight: 850 }}>{clamp(result.confidence ?? 0)}<span style={{ fontSize: 16 }}>%</span></div>
            </div>
          </div>
        </div>

        <div className="ss-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 13 }}>
          <MetricCard label="Positive comments" value={result.sentiment?.positive ?? "N/A"} hint="Accessible comment signal" tone="green" />
          <MetricCard label="Neutral comments" value={result.sentiment?.neutral ?? "N/A"} hint="Accessible comment signal" tone="gray" />
          <MetricCard label="Negative comments" value={result.sentiment?.negative ?? "N/A"} hint="Accessible comment signal" tone="red" />
          <MetricCard label="Review evidence score" value={result.reviewTrust?.score == null ? "N/A" : `${clamp(result.reviewTrust.score)}/100`} hint="Evidence coverage, not authenticity proof" tone="purple" />
        </div>

        <div className="ss-two-col" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 16 }}>
          <Panel title="Product summary" eyebrow="AT A GLANCE">
            <p style={{ color: "#4f4a67", fontSize: 14, lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>{result.summary || "No summary was returned."}</p>
          </Panel>
          <Panel title="Buying recommendation" eyebrow="WHAT TO CONSIDER">
            <p style={{ color: "#4f4a67", fontSize: 14, lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>{result.recommendation || "More information is needed to make a recommendation."}</p>
          </Panel>
        </div>

        <Panel title="Why this assessment?" eyebrow="SUPPORTING REASONS">
          <BulletList items={result.reasons} emptyMessage="No supporting reasons were returned." />
        </Panel>

        <div className="ss-two-col" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 16 }}>
          <SentimentPanel sentiment={result.sentiment} />
          <TrustPanel trust={result.reviewTrust} />
        </div>

        <PriceComparison items={result.priceComparison} />

        {sourceData && <Panel title="Fetched Reel data" eyebrow="SOURCE DETAILS">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginBottom: 16 }}>
            <MetricCard label="Creator" value={sourceData.creator || "Unavailable"} tone="gray" />
            <MetricCard label="Likes" value={sourceData.likesCount ?? "Unavailable"} tone="purple" />
            <MetricCard label="Comments reported" value={sourceData.commentsCount ?? "Unavailable"} tone="gray" />
            <MetricCard label="Comments analyzed" value={sourceData.commentsAnalyzed ?? 0} tone="green" />
          </div>
          {sourceData.caption && <div style={{ borderRadius: 12, background: "#faf9ff", border: `1px solid ${palette.border}`, padding: 15 }}>
            <div style={{ color: palette.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 7 }}>REEL CAPTION</div>
            <p style={{ color: "#4f4a67", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0 }}>{sourceData.caption}</p>
          </div>}
        </Panel>}

        <p style={{ color: palette.muted, fontSize: 11, lineHeight: 1.7, margin: "0 2px" }}>AI-generated preliminary assessment based on the data accessible at analysis time. Review evidence scores do not prove that reviews are authentic or fake. Retailer prices may change; confirm details on the seller's website.</p>
      </section>}
    </main>
  );
}
