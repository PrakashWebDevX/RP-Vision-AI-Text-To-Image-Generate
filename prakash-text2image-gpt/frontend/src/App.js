/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useCallback, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, query, where, orderBy, limit, getDocs, serverTimestamp
} from "firebase/firestore";

const BACKEND = "https://rp-vision-backend.onrender.com";

const TOOLS = [
  { id: "text-to-image",  label: "Text to Image",     icon: "◈", credits: 1, desc: "Generate stunning images from text prompts" },
  { id: "image-to-image", label: "Image to Image",    icon: "⬡", credits: 2, desc: "Transform images with AI" },
  { id: "text-to-video",  label: "Text to Video",     icon: "▷", credits: 5, desc: "Generate videos from text prompts" },
  { id: "image-to-video", label: "Image to Video",    icon: "◉", credits: 5, desc: "Animate any image with AI" },
  { id: "text-to-audio",  label: "Text to Audio",     icon: "♫", credits: 3, desc: "Generate music & sounds from text" },
  { id: "upscale",        label: "Image Upscaler",    icon: "⬆", credits: 2, desc: "Upscale images to 4K quality" },
  { id: "remove-bg",      label: "Remove Background", icon: "✦", credits: 1, desc: "Remove backgrounds instantly" },
];

const STYLES = [
  { label: "Photorealistic", tag: "photorealistic, 8k ultra detailed, RAW photo" },
  { label: "Cinematic",      tag: "cinematic lighting, movie still, dramatic, anamorphic" },
  { label: "Anime",          tag: "anime style, studio ghibli, vibrant, detailed illustration" },
  { label: "Oil Paint",      tag: "oil painting, classical art, textured canvas, masterpiece" },
  { label: "Cyberpunk",      tag: "cyberpunk, neon lights, futuristic, blade runner aesthetic" },
  { label: "Fantasy",        tag: "fantasy art, magical, ethereal lighting, concept art" },
];

const FREE_CREDITS_PER_DAY = 10;

function todayKey() { return new Date().toISOString().split("T")[0]; }

async function getOrCreateUser(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL, plan: "free", createdAt: serverTimestamp(), credits: { date: todayKey(), used: 0 } });
    return { plan: "free", credits: { date: todayKey(), used: 0 } };
  }
  return snap.data();
}

async function checkAndDeductCredits(uid, cost) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const today = todayKey();
  let used = data.credits?.date === today ? data.credits.used : 0;
  if (used + cost > FREE_CREDITS_PER_DAY) return false;
  await updateDoc(ref, { credits: { date: today, used: used + cost } });
  return true;
}

async function saveToHistory(uid, toolId, outputUrl, prompt) {
  await addDoc(collection(db, "history"), { uid, toolId, outputUrl, prompt, createdAt: serverTimestamp() });
}

async function fetchHistory(uid) {
  const q = query(collection(db, "history"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function Spinner({ size = 20 }) {
  return <div style={{ width: size, height: size, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#e8c14a", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }} />;
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const icons = { success: "✓", error: "✕", info: "i" };
  return <div className={"toast toast-" + type}><span className="toast-icon">{icons[type]}</span>{msg}</div>;
}

// ══════════════════════════════════════════════════════
//  PREMIUM LOGIN SCREEN
// ══════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => { setLoading(true); try { await onLogin(); } finally { setLoading(false); } };

  return (
    <div className="login-screen">
      <div className="login-noise" />
      <div className="login-grid" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      {[...Array(16)].map((_,i) => <div key={i} className={"particle p"+i} />)}

      <div className="login-layout">
        {/* ── LEFT HERO PANEL ── */}
        <div className="login-hero">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            NEXT-GEN AI CREATIVE SUITE
          </div>

          <h1 className="hero-title">
            <span className="ht-line">CREATE</span>
            <span className="ht-line ht-gold">WITHOUT</span>
            <span className="ht-line">LIMITS</span>
          </h1>

          <p className="hero-sub">
            7 powerful AI models unified in one workspace. Transform your ideas into images, videos, audio and more.
          </p>

          <div className="hero-metrics">
            <div className="metric">
              <div className="metric-val">7</div>
              <div className="metric-lbl">AI Models</div>
            </div>
            <div className="metric-sep" />
            <div className="metric">
              <div className="metric-val">10</div>
              <div className="metric-lbl">Free Credits/Day</div>
            </div>
            <div className="metric-sep" />
            <div className="metric">
              <div className="metric-val">4K</div>
              <div className="metric-lbl">Output Quality</div>
            </div>
          </div>

          <div className="tool-tags">
            {["Text → Image","Image → Video","Text → Audio","Remove BG","Upscaler","Image → Image","Text → Video"].map((t,i) => (
              <span key={i} className="tool-tag">{t}</span>
            ))}
          </div>

          <div className="hero-quote">"The most powerful AI creative suite for everyone"</div>
        </div>

        {/* ── RIGHT LOGIN CARD ── */}
        <div className="login-panel">
          <div className="login-card">
            <div className="card-shine" />

            {/* Logo */}
            <div className="card-logo">
              <div className="logo-mark">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <polygon points="16,1 31,9 31,23 16,31 1,23 1,9" stroke="#e8c14a" strokeWidth="1.5" fill="rgba(232,193,74,0.06)"/>
                  <polygon points="16,7 25,12 25,20 16,25 7,20 7,12" stroke="#e8c14a" strokeWidth="1" fill="rgba(232,193,74,0.1)" opacity="0.6"/>
                  <circle cx="16" cy="16" r="3.5" fill="#e8c14a"/>
                  <circle cx="16" cy="16" r="6" stroke="#e8c14a" strokeWidth="0.5" opacity="0.4"/>
                </svg>
              </div>
              <div className="logo-wordmark">
                <span className="lw-rp">RP</span><span className="lw-vision"> VISION</span><span className="lw-ai"> AI</span>
              </div>
              <span className="logo-v2">V2</span>
            </div>

            <div className="card-rule" />

            <div className="card-title">Welcome back</div>
            <div className="card-subtitle">Sign in to access your AI workspace</div>

            {/* Google Button */}
            <button className={"g-signin-btn" + (loading ? " g-loading" : "")} onClick={handleLogin} disabled={loading}>
              <span className="gsb-track" />
              <span className="gsb-content">
                {loading ? (
                  <><Spinner size={18} /><span>Signing in…</span></>
                ) : (
                  <>
                    <span className="gsb-gicon">
                      <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </span>
                    <span>Continue with Google</span>
                    <span className="gsb-arrow">→</span>
                  </>
                )}
              </span>
            </button>

            <div className="card-badges">
              <span className="cbadge">🔒 Secure OAuth</span>
              <span className="cbadge">⚡ Instant Access</span>
              <span className="cbadge">🎁 Free Forever</span>
            </div>

            <div className="card-footer">No credit card required · Cancel anytime</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(null);
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState("create");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const progressRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const data = await getOrCreateUser(u);
        setUser(u);
        const today = todayKey();
        setCreditsUsed(data.credits?.date === today ? data.credits.used : 0);
      } else { setUser(null); }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async () => { const res = await signInWithPopup(auth, provider); await getOrCreateUser(res.user); };
  const handleLogout = async () => { await signOut(auth); setResult(null); setHistory([]); };

  const startProgress = () => {
    setProgress(0); let p = 0;
    progressRef.current = setInterval(() => { p += Math.random() * 3; if (p >= 90) { clearInterval(progressRef.current); p = 90; } setProgress(p); }, 300);
  };
  const stopProgress = () => { clearInterval(progressRef.current); setProgress(100); setTimeout(() => setProgress(0), 600); };
  const showToast = (msg, type = "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const creditsLeft = FREE_CREDITS_PER_DAY - creditsUsed;

  const generate = useCallback(async () => {
    if (loading) return;
    if (!prompt.trim() && !["upscale","remove-bg","image-to-video"].includes(activeTool.id)) { showToast("Please enter a prompt!", "error"); return; }
    if (creditsLeft < activeTool.credits) { showToast(`Need ${activeTool.credits} credits, you have ${creditsLeft}`, "error"); return; }
    setError(null); setResult(null); setLoading(true); startProgress();
    const ok = await checkAndDeductCredits(user.uid, activeTool.credits);
    if (!ok) { setLoading(false); stopProgress(); showToast("Daily limit reached. Resets at midnight.", "error"); return; }
    setCreditsUsed(c => c + activeTool.credits);
    try {
      const styleTag = style !== null ? STYLES[style].tag : "";
      const fullPrompt = [prompt.trim(), styleTag].filter(Boolean).join(", ");
      let body = {}; let endpoint = activeTool.id;
      if (activeTool.id === "text-to-image")  body = { prompt: fullPrompt };
      if (activeTool.id === "image-to-image") body = { prompt: fullPrompt, image_url: inputImageUrl };
      if (activeTool.id === "text-to-video")  body = { prompt: fullPrompt };
      if (activeTool.id === "image-to-video") body = { prompt: fullPrompt, image_url: inputImageUrl };
      if (activeTool.id === "text-to-audio")  body = { prompt: fullPrompt };
      if (activeTool.id === "upscale")        body = { image_url: inputImageUrl };
      if (activeTool.id === "remove-bg")      { body = { image_url: inputImageUrl }; endpoint = "remove-background"; }
      const res = await fetch(`${BACKEND}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Generation failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const type = activeTool.id === "text-to-audio" ? "audio" : "image";
      setResult({ type, url });
      await saveToHistory(user.uid, activeTool.id, url, prompt);
      showToast("Generated successfully!", "success");
    } catch (err) { setError(err.message); showToast(err.message, "error");
    } finally { stopProgress(); setLoading(false); }
  }, [prompt, style, activeTool, inputImageUrl, loading, creditsLeft, user]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try { const h = await fetchHistory(user.uid); setHistory(h); } finally { setHistoryLoading(false); }
  }, [user]);

  useEffect(() => { if (view === "history" && user) loadHistory(); }, [view, user, loadHistory]);

  const download = (url, ext = "png") => { const a = document.createElement("a"); a.href = url; a.download = `rp-vision-${Date.now()}.${ext}`; a.click(); };

  if (authLoading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#03030a" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        <div style={{ width:48, height:48, border:"2px solid rgba(232,193,74,0.2)", borderTopColor:"#e8c14a", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:4, color:"rgba(232,193,74,0.6)" }}>LOADING</div>
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const needsImageInput = ["image-to-image","image-to-video","upscale","remove-bg"].includes(activeTool.id);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --bg:#03030a; --surface:#08080f; --card:#0c0c18; --card2:#111120;
          --border:rgba(255,255,255,0.04); --border2:rgba(255,255,255,0.09); --border3:rgba(255,255,255,0.14);
          --gold:#e8c14a; --gold2:#f5d97a; --gold3:#c9a52e;
          --gold-dim:rgba(232,193,74,0.08); --gold-glow:rgba(232,193,74,0.22); --gold-glow2:rgba(232,193,74,0.4);
          --green:#22c55e; --red:#ef4444; --blue:#3b82f6;
          --text:#f0f0f8; --text2:#a0a0c0; --muted:#505068;
          --sidebar:272px; --radius:14px;
        }
        html,body { height:100%; background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; overflow:hidden; -webkit-font-smoothing:antialiased; }

        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes slideRight { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes toastSlide { from{opacity:0;transform:translateX(-50%) translateY(16px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes orbFloat { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-20px) scale(1.05)} 66%{transform:translate(-20px,15px) scale(0.97)} }
        @keyframes particleDrift { 0%{transform:translateY(0) translateX(0);opacity:0} 10%{opacity:.6} 90%{opacity:.2} 100%{transform:translateY(-600px) translateX(40px);opacity:0} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px var(--gold-glow)} 50%{box-shadow:0 0 40px var(--gold-glow2), 0 0 60px var(--gold-glow)} }
        @keyframes tagFloat { 0%{transform:translateY(0)} 50%{transform:translateY(-4px)} 100%{transform:translateY(0)} }
        @keyframes borderTrace {
          0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%}
        }

        /* ════════════════════════════════════════
           LOGIN SCREEN
        ════════════════════════════════════════ */
        .login-screen {
          height:100vh; width:100vw; display:flex; align-items:center; justify-content:center;
          background:var(--bg); position:relative; overflow:hidden;
        }
        .login-noise {
          position:absolute; inset:0; opacity:.025;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          pointer-events:none; z-index:0;
        }
        .login-grid {
          position:absolute; inset:0;
          background-image:linear-gradient(rgba(232,193,74,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(232,193,74,0.04) 1px,transparent 1px);
          background-size:60px 60px;
          mask-image:radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 80%);
          pointer-events:none;
        }
        .orb { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; animation:orbFloat 12s ease-in-out infinite; }
        .orb-1 { width:500px; height:500px; background:radial-gradient(circle, rgba(232,193,74,0.12) 0%, transparent 70%); top:-15%; left:-10%; animation-delay:0s; }
        .orb-2 { width:400px; height:400px; background:radial-gradient(circle, rgba(74,100,232,0.08) 0%, transparent 70%); bottom:-10%; right:-5%; animation-delay:-4s; }
        .orb-3 { width:300px; height:300px; background:radial-gradient(circle, rgba(232,74,150,0.06) 0%, transparent 70%); top:40%; left:40%; animation-delay:-8s; }
        .particle { position:absolute; width:2px; height:2px; background:var(--gold); border-radius:50%; pointer-events:none; animation:particleDrift linear infinite; }
        .p0{left:5%;bottom:0;animation-duration:8s;animation-delay:0s;opacity:.4}
        .p1{left:12%;bottom:0;animation-duration:11s;animation-delay:-2s;opacity:.3}
        .p2{left:20%;bottom:0;animation-duration:9s;animation-delay:-4s;opacity:.5}
        .p3{left:30%;bottom:0;animation-duration:13s;animation-delay:-1s;opacity:.3}
        .p4{left:40%;bottom:0;animation-duration:10s;animation-delay:-6s;opacity:.4}
        .p5{left:50%;bottom:0;animation-duration:8s;animation-delay:-3s;opacity:.6}
        .p6{left:60%;bottom:0;animation-duration:12s;animation-delay:-5s;opacity:.3}
        .p7{left:70%;bottom:0;animation-duration:9s;animation-delay:-1.5s;opacity:.4}
        .p8{left:78%;bottom:0;animation-duration:11s;animation-delay:-7s;opacity:.5}
        .p9{left:85%;bottom:0;animation-duration:10s;animation-delay:-2.5s;opacity:.3}
        .p10{left:92%;bottom:0;animation-duration:8s;animation-delay:-4.5s;opacity:.4}
        .p11{left:97%;bottom:0;animation-duration:13s;animation-delay:-6.5s;opacity:.3}
        .p12{left:25%;bottom:0;animation-duration:9s;animation-delay:-8s;opacity:.5;width:3px;height:3px}
        .p13{left:55%;bottom:0;animation-duration:7s;animation-delay:-3.5s;opacity:.4;width:3px;height:3px}
        .p14{left:75%;bottom:0;animation-duration:11s;animation-delay:-0.5s;opacity:.5;width:3px;height:3px}
        .p15{left:45%;bottom:0;animation-duration:10s;animation-delay:-9s;opacity:.3;width:3px;height:3px}

        .login-layout {
          display:grid; grid-template-columns:1fr 420px; gap:60px; max-width:1100px;
          width:92%; align-items:center; position:relative; z-index:2;
        }

        /* ── HERO LEFT ── */
        .login-hero { display:flex; flex-direction:column; gap:24px; animation:fadeUp .7s ease both; }
        .hero-eyebrow {
          display:inline-flex; align-items:center; gap:8px;
          font-size:10px; font-weight:600; letter-spacing:3px; color:var(--gold);
          text-transform:uppercase;
        }
        .eyebrow-dot { width:6px; height:6px; border-radius:50%; background:var(--gold); box-shadow:0 0 8px var(--gold-glow2); animation:pulse 2s infinite; }
        .hero-title { display:flex; flex-direction:column; line-height:.9; }
        .ht-line { font-family:'Bebas Neue',sans-serif; font-size:clamp(64px,8vw,96px); letter-spacing:4px; color:var(--text); text-shadow:0 0 60px rgba(255,255,255,0.04); }
        .ht-gold {
          background:linear-gradient(90deg, var(--gold3), var(--gold), var(--gold2), var(--gold));
          background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text; animation:borderTrace 4s linear infinite;
          filter:drop-shadow(0 0 20px rgba(232,193,74,0.4));
        }
        .hero-sub { font-size:15px; color:var(--text2); line-height:1.7; max-width:440px; font-weight:300; }
        .hero-metrics { display:flex; align-items:center; gap:20px; padding:20px 24px; background:rgba(255,255,255,0.02); border:1px solid var(--border2); border-radius:12px; width:fit-content; }
        .metric { text-align:center; }
        .metric-val { font-family:'Space Mono',monospace; font-size:28px; color:var(--gold); font-weight:700; line-height:1; }
        .metric-lbl { font-size:10px; color:var(--muted); margin-top:4px; letter-spacing:.5px; }
        .metric-sep { width:1px; height:40px; background:var(--border2); }
        .tool-tags { display:flex; flex-wrap:wrap; gap:8px; }
        .tool-tag {
          font-size:11px; font-weight:500; color:var(--text2); padding:6px 13px;
          background:rgba(255,255,255,0.03); border:1px solid var(--border2);
          border-radius:100px; transition:all .2s; cursor:default;
        }
        .tool-tag:hover { border-color:var(--gold); color:var(--gold); background:var(--gold-dim); }
        .hero-quote { font-size:12px; color:var(--muted); font-style:italic; padding-left:14px; border-left:2px solid var(--gold); }

        /* ── LOGIN CARD ── */
        .login-panel { animation:fadeUp .7s .15s ease both; }
        .login-card {
          background:linear-gradient(145deg, rgba(20,20,40,0.9) 0%, rgba(12,12,24,0.95) 100%);
          border:1px solid var(--border3); border-radius:24px; padding:36px 32px;
          position:relative; overflow:hidden; backdrop-filter:blur(20px);
          box-shadow:0 40px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .card-shine {
          position:absolute; top:0; left:-60%; width:40%; height:100%;
          background:linear-gradient(105deg, transparent, rgba(255,255,255,0.03), transparent);
          animation:shimmer 4s ease-in-out infinite;
        }

        .card-logo { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .logo-mark { flex-shrink:0; animation:glowPulse 3s ease-in-out infinite; }
        .logo-wordmark { display:flex; align-items:baseline; gap:2px; }
        .lw-rp { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:2px; color:var(--gold); }
        .lw-vision { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:2px; color:var(--text); }
        .lw-ai { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:2px; color:var(--gold); }
        .logo-v2 { font-size:9px; background:var(--gold); color:#000; padding:2px 6px; border-radius:4px; font-weight:800; letter-spacing:1px; margin-left:4px; }

        .card-rule { height:1px; background:linear-gradient(90deg, transparent, var(--border3), transparent); margin-bottom:22px; }
        .card-title { font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:2px; color:var(--text); }
        .card-subtitle { font-size:13px; color:var(--text2); margin-top:4px; margin-bottom:24px; font-weight:300; }

        /* Google button */
        .g-signin-btn {
          width:100%; height:52px; border:none; border-radius:13px; cursor:pointer;
          position:relative; overflow:hidden; outline:none;
          background:linear-gradient(135deg, rgba(232,193,74,0.12), rgba(232,193,74,0.06));
          border:1.5px solid rgba(232,193,74,0.3); transition:all .25s;
        }
        .g-signin-btn:hover { border-color:rgba(232,193,74,0.6); transform:translateY(-1px); box-shadow:0 12px 32px rgba(232,193,74,0.15); }
        .g-signin-btn:active { transform:translateY(0); }
        .g-signin-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
        .g-signin-btn.g-loading { border-color:rgba(232,193,74,0.2); }
        .gsb-track {
          position:absolute; inset:0;
          background:linear-gradient(90deg, transparent 0%, rgba(232,193,74,0.06) 50%, transparent 100%);
          animation:shimmer 2s ease-in-out infinite;
        }
        .gsb-content { position:relative; display:flex; align-items:center; justify-content:center; gap:10px; color:var(--text); font-size:14px; font-weight:500; font-family:'DM Sans',sans-serif; }
        .gsb-gicon { display:flex; align-items:center; flex-shrink:0; }
        .gsb-arrow { color:var(--gold); font-size:16px; transition:transform .2s; }
        .g-signin-btn:hover .gsb-arrow { transform:translateX(3px); }

        .card-badges { display:flex; justify-content:center; gap:10px; margin-top:16px; flex-wrap:wrap; }
        .cbadge { font-size:10.5px; color:var(--text2); background:rgba(255,255,255,0.03); border:1px solid var(--border2); padding:5px 11px; border-radius:100px; }
        .card-footer { text-align:center; font-size:11px; color:var(--muted); margin-top:14px; }

        /* ════════════════════════════════════════
           MAIN APP LAYOUT
        ════════════════════════════════════════ */
        .app { display:flex; height:100vh; background:var(--bg); }

        /* ── SIDEBAR ── */
        .sidebar {
          width:var(--sidebar); min-width:var(--sidebar); background:var(--surface);
          border-right:1px solid var(--border); display:flex; flex-direction:column;
          overflow-y:auto; scrollbar-width:none; flex-shrink:0; z-index:10;
        }
        .sidebar::-webkit-scrollbar { display:none; }

        .sb-brand { padding:20px 18px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .sb-brand-icon { color:var(--gold); font-size:20px; flex-shrink:0; }
        .sb-brand-name { font-family:'Bebas Neue',sans-serif; font-size:19px; letter-spacing:3px; color:var(--gold); }
        .sb-brand-v2 { font-size:8px; background:var(--gold); color:#000; padding:2px 5px; border-radius:3px; font-weight:800; letter-spacing:1px; margin-left:auto; flex-shrink:0; }

        .sb-credits { margin:14px 14px 0; background:var(--card); border:1px solid var(--border2); border-radius:12px; padding:13px 14px; flex-shrink:0; }
        .sb-credits-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .sb-credits-label { font-size:9px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
        .sb-credits-val { font-family:'Space Mono',monospace; font-size:13px; color:var(--gold); font-weight:700; }
        .sb-track { height:3px; background:var(--border2); border-radius:3px; overflow:hidden; }
        .sb-fill { height:100%; background:linear-gradient(90deg, var(--gold3), var(--gold), var(--gold2)); border-radius:3px; transition:width .5s ease; }

        .sb-section { padding:12px 10px 4px; }
        .sb-section-label { font-size:9px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:var(--muted); padding:0 8px; margin-bottom:4px; }

        .sb-tool {
          display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px;
          cursor:pointer; transition:all .15s; margin-bottom:1px; border:1px solid transparent; user-select:none;
        }
        .sb-tool:hover { background:var(--card); border-color:var(--border); }
        .sb-tool.active { background:var(--gold-dim); border-color:rgba(232,193,74,0.18); }
        .sb-tool-icon { font-size:14px; width:20px; text-align:center; color:var(--muted); transition:color .15s; flex-shrink:0; }
        .sb-tool.active .sb-tool-icon { color:var(--gold); }
        .sb-tool-name { font-size:12.5px; font-weight:500; color:var(--text2); transition:color .15s; flex:1; }
        .sb-tool.active .sb-tool-name { color:var(--text); }
        .sb-tool-cr { font-size:9.5px; color:var(--muted); background:var(--card2); border:1px solid var(--border2); padding:2px 7px; border-radius:20px; flex-shrink:0; transition:all .15s; font-family:'Space Mono',monospace; }
        .sb-tool.active .sb-tool-cr { background:var(--gold-dim); color:var(--gold); border-color:rgba(232,193,74,0.25); }

        .sb-views { padding:6px 10px; border-top:1px solid var(--border); margin-top:auto; }
        .sb-view-btn { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; cursor:pointer; transition:all .15s; margin-bottom:1px; border:1px solid transparent; }
        .sb-view-btn:hover { background:var(--card); border-color:var(--border); }
        .sb-view-btn.active { background:var(--card2); border-color:var(--border2); }
        .sb-view-icon { font-size:13px; width:20px; text-align:center; color:var(--muted); }
        .sb-view-label { font-size:12.5px; font-weight:500; color:var(--text2); }
        .sb-view-btn.active .sb-view-label, .sb-view-btn.active .sb-view-icon { color:var(--text); }

        .sb-user { padding:12px 14px; border-top:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .sb-avatar { width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid var(--border3); flex-shrink:0; }
        .sb-user-info { flex:1; min-width:0; }
        .sb-user-name { font-size:12px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sb-user-plan { font-size:9.5px; color:var(--gold); font-weight:600; letter-spacing:.5px; text-transform:uppercase; }
        .sb-logout { background:none; border:1px solid var(--border2); border-radius:7px; color:var(--muted); font-size:11px; padding:4px 9px; cursor:pointer; transition:all .18s; }
        .sb-logout:hover { border-color:var(--red); color:var(--red); }

        /* ── MAIN ── */
        .main { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

        .main-header {
          padding:14px 26px; border-bottom:1px solid var(--border);
          display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
          background:var(--surface);
        }
        .header-left {}
        .header-title { font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:3px; color:var(--text); }
        .header-desc { font-size:11.5px; color:var(--muted); margin-top:1px; }
        .header-right { display:flex; align-items:center; gap:10px; }
        .header-badge { font-size:11px; color:var(--text2); background:var(--card); border:1px solid var(--border2); padding:5px 13px; border-radius:100px; }
        .status-dot { width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 8px rgba(34,197,94,0.5); }
        .status-dot.busy { background:var(--gold); box-shadow:0 0 8px var(--gold-glow2); animation:pulse .7s infinite; }

        .progress-wrap { height:2px; background:transparent; flex-shrink:0; }
        .progress-bar { height:100%; background:linear-gradient(90deg, var(--gold3), var(--gold), var(--gold2)); transition:width .3s ease; box-shadow:0 0 6px var(--gold-glow); }

        /* ── WORKSPACE ── */
        .workspace { flex:1; display:flex; overflow:hidden; }

        /* ── CONTROLS ── */
        .controls {
          width:300px; min-width:300px; border-right:1px solid var(--border);
          overflow-y:auto; scrollbar-width:none; padding:18px 16px; display:flex; flex-direction:column; gap:16px;
          background:var(--surface);
        }
        .controls::-webkit-scrollbar { display:none; }

        .ctrl-block { display:flex; flex-direction:column; gap:7px; }
        .ctrl-lbl { font-size:9px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:var(--muted); }

        textarea, .url-input {
          width:100%; background:var(--card); border:1.5px solid var(--border2);
          border-radius:11px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:13px;
          font-weight:300; line-height:1.7; padding:11px 12px; outline:none; transition:all .2s;
        }
        textarea { resize:none; min-height:96px; padding-bottom:30px; }
        textarea::placeholder, .url-input::placeholder { color:var(--muted); }
        textarea:focus, .url-input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(232,193,74,0.08); background:var(--card2); }
        .prompt-wrap { position:relative; }
        .char-count { position:absolute; bottom:9px; right:11px; font-size:9.5px; color:var(--muted); font-family:'Space Mono',monospace; }

        .style-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
        .style-pill {
          background:var(--card); border:1.5px solid var(--border); border-radius:9px; padding:7px 8px;
          cursor:pointer; transition:all .15s; font-size:11px; font-weight:500; color:var(--muted);
          text-align:center; user-select:none;
        }
        .style-pill:hover { border-color:var(--border3); color:var(--text2); background:var(--card2); }
        .style-pill.active { border-color:var(--gold); background:var(--gold-dim); color:var(--gold2); }

        .img-url-wrap { display:flex; flex-direction:column; gap:8px; }
        .preview-thumb { width:100%; border-radius:9px; border:1px solid var(--border2); display:block; }

        .gen-btn {
          width:100%; height:50px; border:none; border-radius:12px; cursor:pointer;
          background:linear-gradient(135deg, var(--gold3) 0%, var(--gold) 50%, var(--gold2) 100%);
          color:#03030a; font-family:'Bebas Neue',sans-serif; font-size:17px; letter-spacing:2.5px;
          display:flex; align-items:center; justify-content:center; gap:9px;
          transition:all .2s; box-shadow:0 6px 20px var(--gold-glow); position:relative; overflow:hidden;
        }
        .gen-btn::before { content:''; position:absolute; inset:0; background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.15) 50%,transparent 70%); animation:shimmer 2.5s ease-in-out infinite; }
        .gen-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 30px var(--gold-glow2); }
        .gen-btn:active:not(:disabled) { transform:translateY(0); }
        .gen-btn:disabled { opacity:.35; cursor:not-allowed; transform:none; box-shadow:none; }
        .gen-cr { font-family:'Space Mono',monospace; font-size:10px; background:rgba(0,0,0,0.25); padding:3px 8px; border-radius:5px; letter-spacing:0; }
        .no-credits-msg { font-size:11px; color:var(--red); text-align:center; padding:2px 0; }

        /* ── CANVAS ── */
        .canvas { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; overflow-y:auto; scrollbar-width:none; gap:14px; }
        .canvas::-webkit-scrollbar { display:none; }

        .empty-state { display:flex; flex-direction:column; align-items:center; gap:14px; opacity:.35; animation:fadeIn .5s ease both; text-align:center; }
        .empty-icon-wrap { width:80px; height:80px; border-radius:50%; background:var(--card); border:1px solid var(--border2); display:flex; align-items:center; justify-content:center; font-size:32px; }
        .empty-label { font-family:'Bebas Neue',sans-serif; font-size:16px; letter-spacing:4px; color:var(--text2); }
        .empty-sub { font-size:12px; color:var(--muted); font-weight:300; }

        .loading-canvas { width:100%; max-width:520px; aspect-ratio:1; border-radius:18px; background:var(--card); border:1px solid var(--border2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; position:relative; overflow:hidden; }
        .loading-canvas::after { content:''; position:absolute; inset:0; background:linear-gradient(105deg,transparent 25%,rgba(232,193,74,0.03) 50%,transparent 75%); animation:shimmer 1.8s ease-in-out infinite; }
        .loading-ring { width:44px; height:44px; border:2px solid var(--border3); border-top-color:var(--gold); border-radius:50%; animation:spin .8s linear infinite; }
        .loading-text { font-family:'Bebas Neue',sans-serif; font-size:16px; letter-spacing:4px; color:var(--gold); z-index:1; }
        .loading-hint { font-size:11px; color:var(--muted); z-index:1; }

        .result-wrap { width:100%; max-width:520px; border-radius:18px; overflow:hidden; border:1px solid var(--border2); box-shadow:0 30px 70px rgba(0,0,0,.5); animation:scaleIn .4s ease both; position:relative; cursor:pointer; }
        .result-wrap img { display:block; width:100%; height:auto; }
        .result-actions { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%); opacity:0; transition:opacity .25s; display:flex; align-items:flex-end; padding:16px; gap:8px; }
        .result-wrap:hover .result-actions { opacity:1; }
        .action-btn { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); border-radius:8px; color:white; font-size:11.5px; font-weight:500; padding:7px 14px; cursor:pointer; backdrop-filter:blur(10px); transition:all .18s; font-family:'DM Sans',sans-serif; }
        .action-btn:hover { background:var(--gold); color:#000; border-color:var(--gold); }

        .audio-wrap { width:100%; max-width:520px; background:var(--card); border:1px solid var(--border2); border-radius:16px; padding:22px; animation:scaleIn .4s ease both; }
        .audio-title { font-family:'Bebas Neue',sans-serif; font-size:15px; letter-spacing:2px; color:var(--gold); margin-bottom:12px; }

        .result-prompt { max-width:520px; font-size:11.5px; color:var(--muted); font-style:italic; text-align:center; line-height:1.6; }
        .error-msg { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:14px 18px; font-size:13px; color:var(--red); max-width:480px; text-align:center; animation:fadeUp .3s ease both; }

        /* ── HISTORY ── */
        .history-view { flex:1; overflow-y:auto; padding:22px 26px; scrollbar-width:none; }
        .history-view::-webkit-scrollbar { display:none; }
        .view-header { margin-bottom:20px; }
        .view-title { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:3px; color:var(--text); }
        .view-sub { font-size:12px; color:var(--muted); margin-top:3px; }
        .h-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:12px; }
        .h-card { background:var(--card); border:1px solid var(--border); border-radius:12px; overflow:hidden; cursor:pointer; transition:all .2s; }
        .h-card:hover { border-color:var(--gold); transform:translateY(-2px); box-shadow:0 12px 32px rgba(0,0,0,.4); }
        .h-img { width:100%; aspect-ratio:1; object-fit:cover; display:block; }
        .h-info { padding:9px 11px; }
        .h-tool { font-size:8.5px; color:var(--gold); font-weight:600; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:3px; }
        .h-prompt { font-size:11px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .h-empty { display:flex; flex-direction:column; align-items:center; gap:12px; padding:60px; text-align:center; opacity:.35; }

        /* ── PROFILE ── */
        .profile-view { flex:1; overflow-y:auto; padding:30px 36px; scrollbar-width:none; }
        .profile-view::-webkit-scrollbar { display:none; }
        .profile-card { background:var(--card); border:1px solid var(--border2); border-radius:20px; padding:26px; max-width:520px; display:flex; flex-direction:column; gap:18px; }
        .profile-head { display:flex; align-items:center; gap:14px; }
        .profile-ava { width:60px; height:60px; border-radius:50%; border:3px solid var(--gold); object-fit:cover; box-shadow:0 0 20px var(--gold-glow); }
        .profile-name { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:2px; color:var(--text); }
        .profile-email { font-size:12.5px; color:var(--text2); margin-top:1px; }
        .profile-plan { display:inline-block; background:var(--gold-dim); color:var(--gold); border:1px solid rgba(232,193,74,0.25); border-radius:5px; padding:2px 9px; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; margin-top:5px; }
        .stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
        .stat-box { background:var(--card2); border:1px solid var(--border); border-radius:11px; padding:13px 15px; }
        .stat-n { font-family:'Space Mono',monospace; font-size:22px; color:var(--gold); font-weight:700; }
        .stat-l { font-size:10.5px; color:var(--muted); margin-top:2px; }
        .upgrade-btn {
          width:100%; height:50px; border:none; border-radius:12px; cursor:pointer;
          background:linear-gradient(135deg, var(--gold3), var(--gold), var(--gold2));
          color:#000; font-family:'Bebas Neue',sans-serif; font-size:17px; letter-spacing:2px;
          transition:all .2s; box-shadow:0 6px 20px var(--gold-glow);
        }
        .upgrade-btn:hover { transform:translateY(-1px); box-shadow:0 10px 28px var(--gold-glow2); }
        .sign-out-btn { width:100%; height:42px; border:1px solid rgba(239,68,68,0.25); border-radius:11px; background:none; color:var(--red); font-size:13px; font-weight:500; cursor:pointer; transition:all .18s; }
        .sign-out-btn:hover { background:rgba(239,68,68,0.05); border-color:rgba(239,68,68,0.5); }

        /* ── TOAST ── */
        .toast { position:fixed; bottom:26px; left:50%; transform:translateX(-50%); padding:10px 20px; border-radius:100px; font-size:13px; font-weight:500; z-index:9999; animation:toastSlide .3s ease both; white-space:nowrap; box-shadow:0 8px 32px rgba(0,0,0,.5); display:flex; align-items:center; gap:8px; }
        .toast-icon { width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0; }
        .toast-success { background:#14532d; color:#86efac; border:1px solid rgba(34,197,94,0.3); }
        .toast-success .toast-icon { background:var(--green); color:#000; }
        .toast-error { background:#450a0a; color:#fca5a5; border:1px solid rgba(239,68,68,0.3); }
        .toast-error .toast-icon { background:var(--red); color:#fff; }
        .toast-info { background:var(--card2); color:var(--text); border:1px solid var(--border2); }
        .toast-info .toast-icon { background:var(--border3); color:var(--text2); }

        /* ── MOBILE ── */
        .mobile-bar { display:none; }
        .mob-overlay { display:none; }

        @media (max-width:900px) { :root { --sidebar:240px; } .controls { width:264px; min-width:264px; } }
        @media (max-width:767px) {
          .app { position:relative; }
          .sidebar { position:fixed; top:0; left:0; bottom:0; z-index:100; transform:translateX(-100%); transition:transform .28s ease; }
          .sidebar.open { transform:translateX(0); }
          .mob-overlay { display:block; position:fixed; inset:0; background:rgba(0,0,0,.65); z-index:99; backdrop-filter:blur(3px); }
          .mobile-bar { display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-bottom:1px solid var(--border); background:var(--surface); flex-shrink:0; }
          .ham-btn { background:none; border:1px solid var(--border2); border-radius:8px; color:var(--text); font-size:17px; padding:5px 9px; cursor:pointer; }
          .main-header { display:none; }
          .workspace { flex-direction:column; overflow-y:auto; }
          .controls { width:100%; min-width:unset; border-right:none; border-bottom:1px solid var(--border); overflow-y:visible; padding:14px; }
          .canvas { padding:14px; justify-content:flex-start; min-height:360px; }
          .history-view, .profile-view { padding:14px; }
          .login-layout { grid-template-columns:1fr; gap:0; }
          .login-hero { display:none; }
          .login-panel { width:100%; max-width:420px; margin:0 auto; }
        }
        @media (max-width:480px) {
          .login-card { padding:28px 22px; }
          .h-grid { grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); }
        }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {sidebarOpen && <div className="mob-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app">
        {/* ── SIDEBAR ── */}
        <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
          <div className="sb-brand">
            <span className="sb-brand-icon">◈</span>
            <span className="sb-brand-name">RP VISION AI</span>
            <span className="sb-brand-v2">V2</span>
          </div>

          <div className="sb-credits">
            <div className="sb-credits-row">
              <span className="sb-credits-label">Daily Credits</span>
              <span className="sb-credits-val">{creditsLeft} / {FREE_CREDITS_PER_DAY}</span>
            </div>
            <div className="sb-track">
              <div className="sb-fill" style={{ width: Math.max(0, creditsLeft / FREE_CREDITS_PER_DAY * 100) + "%" }} />
            </div>
          </div>

          <div className="sb-section">
            <div className="sb-section-label">AI Tools</div>
            {TOOLS.map(t => (
              <div key={t.id} className={"sb-tool" + (activeTool.id === t.id && view === "create" ? " active" : "")}
                onClick={() => { setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="sb-tool-icon">{t.icon}</span>
                <span className="sb-tool-name">{t.label}</span>
                <span className="sb-tool-cr">{t.credits}cr</span>
              </div>
            ))}
          </div>

          <div className="sb-views">
            {[["history","◫","History"],["profile","◯","Profile"]].map(([v,icon,label]) => (
              <div key={v} className={"sb-view-btn" + (view === v ? " active" : "")} onClick={() => { setView(v); setSidebarOpen(false); }}>
                <span className="sb-view-icon">{icon}</span>
                <span className="sb-view-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="sb-user">
            <img className="sb-avatar" src={user.photoURL} alt="" />
            <div className="sb-user-info">
              <div className="sb-user-name">{user.displayName}</div>
              <div className="sb-user-plan">Free Plan</div>
            </div>
            <button className="sb-logout" onClick={handleLogout}>Out</button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">
          <div className="mobile-bar">
            <button className="ham-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:17, letterSpacing:3, color:"var(--gold)" }}>RP VISION AI</span>
            <span style={{ fontSize:11, color:"var(--text2)", fontFamily:"'Space Mono',monospace" }}>{creditsLeft}cr</span>
          </div>

          <div className="main-header">
            <div className="header-left">
              <div className="header-title">{view === "create" ? activeTool.label : view === "history" ? "History" : "Profile"}</div>
              <div className="header-desc">{view === "create" ? activeTool.desc : view === "history" ? "Your last 20 generations" : "Manage your account"}</div>
            </div>
            <div className="header-right">
              <div className={"status-dot" + (loading ? " busy" : "")} />
              <span className="header-badge">{creditsLeft} credits left</span>
            </div>
          </div>

          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: progress + "%" }} />
          </div>

          {/* ── CREATE ── */}
          {view === "create" && (
            <div className="workspace">
              <div className="controls">
                {!["upscale","remove-bg"].includes(activeTool.id) && (
                  <div className="ctrl-block">
                    <div className="ctrl-lbl">Prompt</div>
                    <div className="prompt-wrap">
                      <textarea value={prompt} onChange={e => setPrompt(e.target.value.slice(0,500))}
                        placeholder={activeTool.id === "text-to-audio" ? "Describe the music or sound..." : activeTool.id === "image-to-video" ? "How should this image animate?" : "Describe what you want to create..."}
                        rows={4} />
                      <span className="char-count">{prompt.length}/500</span>
                    </div>
                  </div>
                )}

                {needsImageInput && (
                  <div className="ctrl-block">
                    <div className="ctrl-lbl">Image URL</div>
                    <div className="img-url-wrap">
                      <input className="url-input" value={inputImageUrl} onChange={e => setInputImageUrl(e.target.value)} placeholder="Paste image URL here…" />
                      {inputImageUrl && <img src={inputImageUrl} alt="" className="preview-thumb" onError={e => e.target.style.display="none"} />}
                    </div>
                  </div>
                )}

                {["text-to-image","image-to-image"].includes(activeTool.id) && (
                  <div className="ctrl-block">
                    <div className="ctrl-lbl">Art Style</div>
                    <div className="style-grid">
                      {STYLES.map((s,i) => (
                        <div key={i} className={"style-pill"+(style===i?" active":"")} onClick={() => setStyle(style===i?null:i)}>{s.label}</div>
                      ))}
                    </div>
                  </div>
                )}

                <button className="gen-btn" disabled={loading || creditsLeft < activeTool.credits} onClick={generate}>
                  {loading ? <><Spinner size={18} /><span style={{color:"#03030a"}}>Generating…</span></> : <>{activeTool.icon}&nbsp;Generate<span className="gen-cr">{activeTool.credits} cr</span></>}
                </button>
                {creditsLeft < activeTool.credits && !loading && <div className="no-credits-msg">Not enough credits. Resets at midnight.</div>}
              </div>

              <div className="canvas">
                {!loading && !result && !error && (
                  <div className="empty-state">
                    <div className="empty-icon-wrap">{activeTool.icon}</div>
                    <div className="empty-label">{activeTool.label}</div>
                    <div className="empty-sub">{activeTool.desc}</div>
                  </div>
                )}
                {loading && (
                  <div className="loading-canvas">
                    <div className="loading-ring" />
                    <div className="loading-text">GENERATING…</div>
                    <div className="loading-hint">This may take 10–30 seconds</div>
                  </div>
                )}
                {error && !loading && <div className="error-msg">⚠ {error}</div>}
                {result && !loading && (
                  <>
                    {result.type === "image" && (
                      <div className="result-wrap">
                        <img src={result.url} alt="Generated" />
                        <div className="result-actions">
                          <button className="action-btn" onClick={() => download(result.url)}>↓ Download</button>
                          <button className="action-btn" onClick={() => setResult(null)}>✕ Clear</button>
                          <button className="action-btn" onClick={generate}>↻ Redo</button>
                        </div>
                      </div>
                    )}
                    {result.type === "audio" && (
                      <div className="audio-wrap">
                        <div className="audio-title">♫ GENERATED AUDIO</div>
                        <audio controls src={result.url} style={{ width:"100%" }} />
                        <button className="action-btn" style={{ marginTop:12 }} onClick={() => download(result.url,"mp3")}>↓ Download MP3</button>
                      </div>
                    )}
                    {prompt && <div className="result-prompt">"{prompt}"</div>}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── HISTORY ── */}
          {view === "history" && (
            <div className="history-view">
              <div className="view-header">
                <div className="view-title">Generation History</div>
                <div className="view-sub">Your last 20 AI generations</div>
              </div>
              {historyLoading ? (
                <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spinner size={32} /></div>
              ) : history.length === 0 ? (
                <div className="h-empty">
                  <div style={{ fontSize:40 }}>◫</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, color:"var(--text2)" }}>NO HISTORY YET</div>
                  <div style={{ fontSize:12, color:"var(--muted)" }}>Generate something to see it here</div>
                </div>
              ) : (
                <div className="h-grid">
                  {history.map(h => (
                    <div key={h.id} className="h-card" onClick={() => { setResult({ type:"image", url:h.outputUrl }); setActiveTool(TOOLS.find(t=>t.id===h.toolId)||TOOLS[0]); setView("create"); }}>
                      <img className="h-img" src={h.outputUrl} alt="" onError={e => e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"} />
                      <div className="h-info">
                        <div className="h-tool">{h.toolId?.replace(/-/g," ")}</div>
                        <div className="h-prompt">{h.prompt || "No prompt"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PROFILE ── */}
          {view === "profile" && (
            <div className="profile-view">
              <div className="view-header">
                <div className="view-title">My Profile</div>
                <div className="view-sub">Manage your account and subscription</div>
              </div>
              <div className="profile-card">
                <div className="profile-head">
                  <img className="profile-ava" src={user.photoURL} alt="" />
                  <div>
                    <div className="profile-name">{user.displayName}</div>
                    <div className="profile-email">{user.email}</div>
                    <div className="profile-plan">Free Plan</div>
                  </div>
                </div>
                <div className="stats-grid">
                  <div className="stat-box"><div className="stat-n">{creditsLeft}</div><div className="stat-l">Credits Left Today</div></div>
                  <div className="stat-box"><div className="stat-n">{creditsUsed}</div><div className="stat-l">Credits Used Today</div></div>
                  <div className="stat-box"><div className="stat-n">{FREE_CREDITS_PER_DAY}</div><div className="stat-l">Daily Free Credits</div></div>
                  <div className="stat-box"><div className="stat-n">7</div><div className="stat-l">AI Tools Available</div></div>
                </div>
                <button className="upgrade-btn" onClick={() => showToast("Payments coming soon! 🚀","info")}>◈ UPGRADE TO PRO — COMING SOON</button>
                <button className="sign-out-btn" onClick={handleLogout}>Sign Out</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
