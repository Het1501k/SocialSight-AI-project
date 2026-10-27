import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
function formatDate(value) { const d = value?.toDate ? value.toDate() : value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : "Date unavailable"; }
export default function AnalysisHistory() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() { try { setError(""); const u = auth.currentUser; if (!u) return; const snap = await getDocs(query(collection(db,"users",u.uid,"analyses"),orderBy("createdAt","desc"))); setItems(snap.docs.map(d=>({id:d.id,...d.data()}))); } catch(e) { console.error(e); setError("Could not load history. Check your Firestore connection and permissions."); } finally { setLoading(false); } }
  useEffect(()=>{ load(); },[]);
  async function remove(id) { if (!window.confirm("Delete this saved analysis?")) return; try { await deleteDoc(doc(db,"users",auth.currentUser.uid,"analyses",id)); setItems(old=>old.filter(x=>x.id!==id)); } catch(e) { setError("Unable to delete this analysis."); } }
  return <div className="standard-page"><div className="page-heading-row"><div><div className="eyebrow"><span className="eyebrow-line"></span> YOUR RESEARCH</div><h1>Analysis history</h1><p className="page-subtitle">A record of the products you have investigated.</p></div><Link className="button button-primary" to="/analyze">＋ New analysis</Link></div>
    {error && <div className="alert-error">{error}</div>}
    <section className="history-panel"><div className="panel-heading"><div><h2>Saved assessments</h2><p>{items.length} {items.length===1?"analysis":"analyses"} saved to your account</p></div><span className="count-pill">{items.length} total</span></div>
      {loading ? <div className="empty-state"><div className="loader-dot"></div><p>Loading saved analyses…</p></div> : items.length ? <div className="history-list">{items.map(item=><article className="history-card" key={item.id}><div className="history-symbol">◈</div><div className="history-info"><div className="history-title-row"><h3>{item.analysis?.productName || item.productDescription || "Product assessment"}</h3>{item.analysis?.confidence != null && <span className="confidence-pill">{item.analysis.confidence}% confidence</span>}</div><p>{item.analysis?.summary || "Saved product assessment from Instagram."}</p><div className="history-meta"><span>◷ {formatDate(item.createdAt || item.analyzedAt)}</span>{item.analysis?.category && <span>◇ {item.analysis.category}</span>}</div>{item.reelUrl && <a href={item.reelUrl} target="_blank" rel="noreferrer" className="small-external">Original Instagram post ↗</a>}</div><button className="icon-button danger-hover" onClick={()=>remove(item.id)} title="Delete analysis" aria-label="Delete analysis">×</button></article>)}</div> : <div className="empty-state"><div className="empty-icon">◷</div><strong>Your history starts here</strong><p>Analyze a Reel and your saved assessment will show up here.</p><Link className="button button-primary" to="/analyze">Analyze a Reel</Link></div>}
    </section>
  </div>;
}
