import { useState, useRef, useCallback, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, query, where, orderBy, limit, getDocs, serverTimestamp
} from "firebase/firestore";

const BACKEND = "https://rp-vision-backend.onrender.com";

const TOOLS = [
  { id: "text-to-image", label: "Text to Image", icon: "⬡", credits: 1, desc: "Generate images from text prompts" },
  { id: "image-to-image", label: "Image to Image", icon: "⬢", credits: 2, desc: "Transform images with AI" },
  { id: "text-to-video", label: "Text to Video", icon: "◈", credits: 5, desc: "Generate videos from prompts" },
  { id: "image-to-video", label: "Image to Video", icon: "◉", credits: 5, desc: "Animate any image with AI" },
  { id: "text-to-audio", label: "Text to Audio", icon: "◎", credits: 3, desc: "Generate audio from text" },
  { id: "upscale", label: "Image Upscaler", icon: "◐", credits: 2, desc: "Upscale images to HD quality" },
  { id: "remove-bg", label: "Remove Background", icon: "◑", credits: 1, desc: "Remove image backgrounds instantly" },
];

const STYLES = [
  { label: "Photorealistic", tag: "photorealistic, 8k ultra detailed, RAW photo" },
  { label: "Cinematic", tag: "cinematic lighting, movie still, dramatic, anamorphic" },
  { label: "Anime", tag: "anime style, studio ghibli, vibrant, detailed illustration" },
  { label: "Oil Paint", tag: "oil painting, classical art, textured canvas, masterpiece" },
  { label: "Cyberpunk", tag: "cyberpunk, neon lights, futuristic, blade runner aesthetic" },
  { label: "Fantasy", tag: "fantasy art, magical, ethereal lighting, concept art" },
];

const FREE_CREDITS_PER_DAY = 10;

// ── UTILITIES ──────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().split("T")[0];
}

async function getOrCreateUser(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      photo: user.photoURL,
      plan: "free",
      createdAt: serverTimestamp(),
      credits: { date: todayKey(), used: 0 },
    });
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
  await addDoc(collection(db, "history"), {
    uid, toolId, outputUrl, prompt,
    createdAt: serverTimestamp(),
  });
}

async function fetchHistory(uid) {
  const q = query(
    collection(db, "history"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── COMPONENTS ─────────────────────────────────────────────
function Spinner() {
  return <div className="spinner" />;
}

function Toast({ msg, type }) {
  return msg ? <div className={"toast toast-" + type}>{msg}</div> : null;
}

// ── LOGIN SCREEN ───────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try { await onLogin(); } finally { setLoading(false); }
  };

  useEffect(() => {
    const container = document.getElementById("rp-particles");
    if (!container) return;
    const colors = ["#00d4ff", "#8b5cf6", "#ff2d78", "#ffffff"];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("div");
      p.className = "rp-particle";
      const angle = Math.random() * 360;
      const dist = 100 + Math.random() * 300;
      const rad = (angle * Math.PI) / 180;
      p.style.cssText = `
        left:${Math.random() * 100}%;top:${Math.random() * 100}%;
        width:${1 + Math.random() * 2}px;height:${1 + Math.random() * 2}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        --dx:${Math.cos(rad) * dist}px;--dy:${Math.sin(rad) * dist}px;
        animation-duration:${5 + Math.random() * 10}s;
        animation-delay:${-Math.random() * 15}s;
        box-shadow:0 0 4px currentColor;
      `;
      container.appendChild(p);
    }
    return () => { if (container) container.innerHTML = ""; };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Rajdhani:wght@300;400;500;600&display=swap');

        .rp-login-root *, .rp-login-root *::before, .rp-login-root *::after { margin:0; padding:0; box-sizing:border-box; }

        .rp-login-root {
          --cyan:#00d4ff; --purple:#8b5cf6; --pink:#ff2d78;
          --dark:#000000; --card-bg:rgba(5,5,20,0.85);
          position:fixed; inset:0; z-index:9999;
          font-family:'Rajdhani',sans-serif; background:#000; color:#fff; overflow:hidden;
        }

        .rp-bg {
          position:absolute; inset:0; z-index:0;
          background:
            radial-gradient(ellipse at 20% 50%,rgba(0,212,255,.06) 0%,transparent 55%),
            radial-gradient(ellipse at 80% 50%,rgba(255,45,120,.06) 0%,transparent 55%),
            radial-gradient(ellipse at 50% 50%,rgba(139,92,246,.05) 0%,transparent 60%),#000;
        }
        .rp-grid {
          position:absolute; inset:0; z-index:0;
          background-image:linear-gradient(rgba(0,212,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.04) 1px,transparent 1px);
          background-size:60px 60px;
        }
        .rp-orb { position:absolute; border-radius:50%; filter:blur(80px); opacity:0; animation:rpDrift 12s ease-in-out infinite; pointer-events:none; }
        .rp-orb-1 { width:500px;height:500px;left:-150px;top:-150px;background:radial-gradient(circle,rgba(0,212,255,.25),transparent 70%);animation-delay:0s; }
        .rp-orb-2 { width:400px;height:400px;right:-100px;bottom:-100px;background:radial-gradient(circle,rgba(255,45,120,.25),transparent 70%);animation-delay:-4s; }
        .rp-orb-3 { width:350px;height:350px;left:40%;top:20%;background:radial-gradient(circle,rgba(139,92,246,.2),transparent 70%);animation-delay:-8s; }
        @keyframes rpDrift {
          0%{opacity:0;transform:scale(.8) translate(0,0)}
          20%{opacity:1}
          50%{transform:scale(1.1) translate(30px,-20px)}
          80%{opacity:1}
          100%{opacity:0;transform:scale(.8) translate(0,0)}
        }

        #rp-particles { position:absolute; inset:0; z-index:0; overflow:hidden; }
        .rp-particle { position:absolute; width:2px; height:2px; border-radius:50%; animation:rpShoot linear infinite; opacity:0; }
        @keyframes rpShoot {
          0%{opacity:0;transform:translate(0,0)} 10%{opacity:1} 90%{opacity:1} 100%{opacity:0;transform:translate(var(--dx),var(--dy))}
        }

        .rp-page { position:relative; z-index:1; display:flex; height:100vh; }

        .rp-left {
          flex:1.1; display:flex; flex-direction:column; justify-content:center;
          align-items:center; padding:60px; position:relative;
        }
        .rp-left::after {
          content:''; position:absolute; right:0; top:10%; bottom:10%; width:1px;
          background:linear-gradient(to bottom,transparent,rgba(0,212,255,.4) 30%,rgba(139,92,246,.6) 50%,rgba(255,45,120,.4) 70%,transparent);
        }
        .rp-logo-wrap { position:relative; animation:rpFloat 6s ease-in-out infinite; }
        @keyframes rpFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        .rp-logo-glow {
          position:absolute; inset:-40px;
          background:radial-gradient(ellipse,rgba(139,92,246,.3) 0%,rgba(0,212,255,.15) 40%,transparent 70%);
          animation:rpPulse 3s ease-in-out infinite; border-radius:50%;
        }
        @keyframes rpPulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        .rp-logo-placeholder {
          width:200px; height:200px; position:relative; z-index:1; display:flex; align-items:center; justify-content:center;
          font-size:80px; filter:drop-shadow(0 0 30px rgba(0,212,255,.5));
        }
        .rp-brand-name {
          margin-top:28px; font-family:'Orbitron',monospace; font-size:2rem; font-weight:900;
          letter-spacing:.15em; text-align:center; text-transform:uppercase;
          background:linear-gradient(135deg,#00d4ff 0%,#8b5cf6 50%,#ff2d78 100%);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .rp-tagline { margin-top:10px; font-size:.85rem; letter-spacing:.4em; text-transform:uppercase; color:rgba(255,255,255,.35); text-align:center; }

        .rp-stats { display:flex; gap:32px; margin-top:50px; }
        .rp-stat { text-align:center; position:relative; }
        .rp-stat::after { content:''; position:absolute; right:-16px; top:20%; bottom:20%; width:1px; background:rgba(255,255,255,.1); }
        .rp-stat:last-child::after { display:none; }
        .rp-stat-num {
          font-family:'Orbitron',monospace; font-size:1.6rem; font-weight:800;
          background:linear-gradient(135deg,#00d4ff,#8b5cf6);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .rp-stat-label { font-size:.7rem; letter-spacing:.15em; text-transform:uppercase; color:rgba(255,255,255,.4); margin-top:4px; }

        .rp-features { display:flex; flex-direction:column; gap:14px; margin-top:48px; align-self:flex-start; width:100%; max-width:340px; }
        .rp-feature {
          display:flex; align-items:center; gap:14px; padding:12px 18px;
          border:1px solid rgba(0,212,255,.12); border-radius:10px;
          background:rgba(0,212,255,.03); transition:all .3s; cursor:default;
        }
        .rp-feature:hover { border-color:rgba(0,212,255,.35); background:rgba(0,212,255,.07); transform:translateX(5px); }
        .rp-fi { width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
        .rp-fi-c { background:rgba(0,212,255,.15); }
        .rp-fi-p { background:rgba(139,92,246,.15); }
        .rp-fi-q { background:rgba(255,45,120,.15); }
        .rp-ft { font-size:.88rem; color:rgba(255,255,255,.65); }
        .rp-ft strong { color:#fff; font-weight:600; display:block; font-size:.92rem; }

        .rp-right { flex:.9; display:flex; align-items:center; justify-content:center; padding:40px; }
        .rp-card {
          width:100%; max-width:420px; background:var(--card-bg);
          border:1px solid rgba(139,92,246,.25); border-radius:20px; padding:48px 44px;
          position:relative; backdrop-filter:blur(20px);
          box-shadow:0 0 0 1px rgba(0,212,255,.05),0 30px 80px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.05);
          animation:rpCardIn .8s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes rpCardIn { from{opacity:0;transform:translateY(30px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        .rp-card::before,.rp-card::after { content:''; position:absolute; width:20px; height:20px; border-color:#00d4ff; border-style:solid; opacity:.5; }
        .rp-card::before { top:-1px; left:-1px; border-width:2px 0 0 2px; border-radius:20px 0 0 0; }
        .rp-card::after  { bottom:-1px; right:-1px; border-width:0 2px 2px 0; border-radius:0 0 20px 0; }

        .rp-scanline {
          position:absolute; left:0; right:0; height:2px;
          background:linear-gradient(90deg,transparent,rgba(0,212,255,.4),rgba(139,92,246,.4),transparent);
          top:0; border-radius:20px 20px 0 0; animation:rpScan 4s ease-in-out infinite;
        }
        @keyframes rpScan { 0%{top:0%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:100%;opacity:0} }

        .rp-card-title {
          font-family:'Orbitron',monospace; font-size:1.4rem; font-weight:700;
          letter-spacing:.08em; margin-bottom:6px;
          background:linear-gradient(135deg,#fff 0%,rgba(255,255,255,.75) 100%);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .rp-card-sub { font-size:.88rem; color:rgba(255,255,255,.4); letter-spacing:.05em; margin-bottom:38px; }

        .rp-btn-google {
          width:100%; display:flex; align-items:center; justify-content:center; gap:14px;
          padding:15px 24px; background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.15); border-radius:12px;
          color:#fff; font-family:'Rajdhani',sans-serif; font-size:1rem; font-weight:600;
          letter-spacing:.08em; cursor:pointer; position:relative; overflow:hidden;
          transition:all .3s ease;
        }
        .rp-btn-google:hover:not(:disabled) {
          background:rgba(255,255,255,.08); border-color:rgba(0,212,255,.45);
          box-shadow:0 0 24px rgba(0,212,255,.15),0 0 60px rgba(139,92,246,.08);
          transform:translateY(-2px);
        }
        .rp-btn-google:disabled { opacity:.7; cursor:not-allowed; }
        .rp-btn-google::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(0,212,255,.07),rgba(139,92,246,.07),rgba(255,45,120,.07));
          opacity:0; transition:opacity .3s;
        }
        .rp-btn-google:hover::before { opacity:1; }
        .rp-g-icon { width:22px; height:22px; flex-shrink:0; }
        .rp-arrow { position:absolute; right:18px; opacity:0; transform:translateX(-6px); transition:all .3s ease; font-size:1.1rem; }
        .rp-btn-google:hover:not(:disabled) .rp-arrow { opacity:1; transform:translateX(0); color:#00d4ff; }
        .rp-btn-spinner { width:20px; height:20px; border:2px solid rgba(0,212,255,.2); border-top-color:#00d4ff; border-radius:50%; animation:rpSpin .8s linear infinite; }
        @keyframes rpSpin { to{transform:rotate(360deg)} }

        .rp-divider { display:flex; align-items:center; gap:14px; margin:30px 0; color:rgba(255,255,255,.2); font-size:.75rem; letter-spacing:.15em; }
        .rp-divider::before,.rp-divider::after { content:''; flex:1; height:1px; background:linear-gradient(to right,transparent,rgba(255,255,255,.1),transparent); }

        .rp-coming { text-align:center; color:rgba(255,255,255,.3); font-size:.85rem; letter-spacing:.05em; }

        .rp-trust { display:flex; justify-content:space-between; margin-top:28px; gap:8px; }
        .rp-trust-item { display:flex; align-items:center; gap:6px; font-size:.72rem; color:rgba(255,255,255,.3); letter-spacing:.05em; }
        .rp-tdot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .rp-tdot-c { background:#00d4ff; box-shadow:0 0 6px #00d4ff; }
        .rp-tdot-p { background:#8b5cf6; box-shadow:0 0 6px #8b5cf6; }
        .rp-tdot-q { background:#ff2d78; box-shadow:0 0 6px #ff2d78; }

        .rp-terms { margin-top:24px; font-size:.72rem; color:rgba(255,255,255,.2); text-align:center; line-height:1.7; }
        .rp-terms-btn { background:none; border:none; color:rgba(0,212,255,0.6); cursor:pointer; font-size:.72rem; padding:0; transition:color .2s; }
        .rp-terms-btn:hover { color:#00d4ff; }

        @media (max-width:768px) {
          .rp-page { flex-direction:column; height:auto; min-height:100vh; overflow-y:auto; }
          .rp-left { padding:50px 30px 30px; }
          .rp-left::after { display:none; }
          .rp-logo-placeholder { width:130px; height:130px; font-size:56px; }
          .rp-brand-name { font-size:1.4rem; }
          .rp-stats { gap:20px; }
          .rp-features { max-width:100%; }
          .rp-right { padding:24px 24px 50px; }
          .rp-card { padding:36px 28px; }
          .rp-login-root { overflow-y:auto; }
        }
      `}</style>

      <div className="rp-login-root">
        <div className="rp-bg" />
        <div className="rp-grid" />
        <div className="rp-orb rp-orb-1" />
        <div className="rp-orb rp-orb-2" />
        <div className="rp-orb rp-orb-3" />
        <div id="rp-particles" />

        <div className="rp-page">
          {/* LEFT BRAND PANEL */}
          <div className="rp-left">
            <div className="rp-logo-wrap">
              <div className="rp-logo-glow" />
              <img src="/logo192.png" alt="RP Vision AI" className="rp-logo-img" />
            </div>

            <div className="rp-brand-name">RP Vision AI</div>
            <div className="rp-tagline">Create Without Limits</div>

            <div className="rp-stats">
              <div className="rp-stat">
                <div className="rp-stat-num">7</div>
                <div className="rp-stat-label">AI Models</div>
              </div>
              <div className="rp-stat">
                <div className="rp-stat-num">10</div>
                <div className="rp-stat-label">Free Credits</div>
              </div>
              <div className="rp-stat">
                <div className="rp-stat-num">4K</div>
                <div className="rp-stat-label">Output</div>
              </div>
            </div>

            <div className="rp-features">
              <div className="rp-feature">
                <div className="rp-fi rp-fi-c">⚡</div>
                <div className="rp-ft"><strong>Instant Generation</strong>Text to image in seconds</div>
              </div>
              <div className="rp-feature">
                <div className="rp-fi rp-fi-p">🎨</div>
                <div className="rp-ft"><strong>Multiple Art Styles</strong>Realistic, anime, abstract &amp; more</div>
              </div>
              <div className="rp-feature">
                <div className="rp-fi rp-fi-q">🔓</div>
                <div className="rp-ft"><strong>Free Forever Plan</strong>10 credits daily, no credit card</div>
              </div>
            </div>
          </div>

          {/* RIGHT LOGIN CARD */}
          <div className="rp-right">
            <div className="rp-card">
              <div className="rp-scanline" />

              <div className="rp-card-title">Welcome Back</div>
              <div className="rp-card-sub">Sign in to start creating with AI</div>

              <button className="rp-btn-google" onClick={handleLogin} disabled={loading}>
                {loading ? (
                  <div className="rp-btn-spinner" />
                ) : (
                  <>
                    <svg className="rp-g-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span>Continue with Google</span>
                    <span className="rp-arrow">→</span>
                  </>
                )}
              </button>

              <div className="rp-divider">OR</div>
              <div className="rp-coming">More sign-in options coming soon</div>

              <div className="rp-trust">
                <div className="rp-trust-item"><div className="rp-tdot rp-tdot-c" /> Secure OAuth</div>
                <div className="rp-trust-item"><div className="rp-tdot rp-tdot-p" /> Instant Access</div>
                <div className="rp-trust-item"><div className="rp-tdot rp-tdot-q" /> Free Forever</div>
              </div>

              <div className="rp-terms">
                By continuing, you agree to our{" "}
                <button className="rp-terms-btn" onClick={() => { }}>Terms of Service</button>
                {" "}&amp;{" "}
                <button className="rp-terms-btn" onClick={() => { }}>Privacy Policy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── MAIN APP ───────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Tool state
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(null);
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  // UI state
  const [view, setView] = useState("create");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creditsUsed, setCreditsUsed] = useState(0);

  const progressRef = useRef(null);

  // ── AUTH ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const data = await getOrCreateUser(u);
        setUser(u);
        setUserData(data);
        const today = todayKey();
        setCreditsUsed(data.credits?.date === today ? data.credits.used : 0);
      } else {
        setUser(null);
        setUserData(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    const res = await signInWithPopup(auth, provider);
    const data = await getOrCreateUser(res.user);
    setUserData(data);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setResult(null);
    setHistory([]);
  };

  // ── PROGRESS ──
  const startProgress = () => {
    setProgress(0);
    let p = 0;
    progressRef.current = setInterval(() => {
      p += Math.random() * 3;
      if (p >= 90) { clearInterval(progressRef.current); p = 90; }
      setProgress(p);
    }, 300);
  };

  const stopProgress = () => {
    clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  };

  // ── TOAST ──
  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── CREDITS ──
  const creditsLeft = FREE_CREDITS_PER_DAY - creditsUsed;

  // ── GENERATE ──
  const generate = useCallback(async () => {
    if (loading) return;
    if (!prompt.trim() && !["upscale", "remove-bg", "image-to-video"].includes(activeTool.id)) {
      showToast("Please enter a prompt!", "error"); return;
    }
    if (creditsLeft < activeTool.credits) {
      showToast(`Not enough credits! Need ${activeTool.credits}, have ${creditsLeft}`, "error"); return;
    }

    setError(null);
    setResult(null);
    setLoading(true);
    startProgress();

    const ok = await checkAndDeductCredits(user.uid, activeTool.credits);
    if (!ok) {
      setLoading(false);
      stopProgress();
      showToast("Daily credit limit reached! Resets at midnight.", "error");
      return;
    }
    setCreditsUsed(c => c + activeTool.credits);

    try {
      const styleTag = style !== null ? STYLES[style].tag : "";
      const fullPrompt = [prompt.trim(), styleTag].filter(Boolean).join(", ");
      let body = {};
      let endpoint = activeTool.id;

      if (activeTool.id === "text-to-image") body = { prompt: fullPrompt };
      if (activeTool.id === "image-to-image") body = { prompt: fullPrompt, image_url: inputImageUrl };
      if (activeTool.id === "text-to-video") body = { prompt: fullPrompt };
      if (activeTool.id === "image-to-video") body = { prompt: fullPrompt, image_url: inputImageUrl };
      if (activeTool.id === "text-to-audio") body = { prompt: fullPrompt };
      if (activeTool.id === "upscale") body = { image_url: inputImageUrl };
      if (activeTool.id === "remove-bg") { body = { image_url: inputImageUrl }; endpoint = "remove-background"; }

      const res = await fetch(`${BACKEND}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Generation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const type = activeTool.id === "text-to-audio" ? "audio" : "image";
      setResult({ type, url });

      await saveToHistory(user.uid, activeTool.id, url, prompt);
      showToast("Generated successfully!", "success");

    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      stopProgress();
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, style, activeTool, inputImageUrl, loading, creditsLeft, user]);

  // ── HISTORY ──
  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const h = await fetchHistory(user.uid);
      setHistory(h);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (view === "history" && user) loadHistory();
  }, [view, user, loadHistory]);

  // ── DOWNLOAD ──
  const download = (url, ext = "png") => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `rp-vision-${Date.now()}.${ext}`;
    a.click();
  };

  if (authLoading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050508" }}>
      <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const needsImageInput = ["image-to-image", "image-to-video", "upscale", "remove-bg"].includes(activeTool.id);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #03030a;
          --panel: #08080f;
          --card: #0e0e1a;
          --card2: #131320;
          --border: rgba(255,255,255,0.05);
          --border2: rgba(255,255,255,0.1);
          --accent: #e8c14a;
          --accent2: #f5d97a;
          --accent-dim: rgba(232,193,74,0.1);
          --accent-glow: rgba(232,193,74,0.25);
          --blue: #4a90e8;
          --purple: #9b59b6;
          --green: #2ecc71;
          --red: #e74c3c;
          --text: #eeeef5;
          --muted: #44445a;
          --muted2: #7777a0;
          --sidebar: 280px;
        }
        html { height: 100%; -webkit-text-size-adjust: 100%; }
        body { height: 100%; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; overflow: hidden; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { from { transform:translateX(-100%); } to { transform:translateX(200%); } }
        @keyframes reveal { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from { transform:translateX(-100%); } to { transform:translateX(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

        .app { display:flex; height:100vh; }

        .sidebar {
          width:var(--sidebar); min-width:var(--sidebar); background:var(--panel);
          border-right:1px solid var(--border); display:flex; flex-direction:column;
          overflow-y:auto; scrollbar-width:none; flex-shrink:0; z-index:10;
        }
        .sidebar::-webkit-scrollbar { display:none; }

        .sidebar-brand {
          padding:22px 20px 16px; border-bottom:1px solid var(--border); flex-shrink:0;
          display:flex; align-items:center; gap:10px;
        }
        .brand-icon { font-size:22px; color:var(--accent); line-height:1; }
        .brand-text { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:3px; color:var(--accent); text-shadow:0 0 30px var(--accent-glow); }
        .brand-version { font-size:9px; background:var(--accent); color:#000; padding:2px 6px; border-radius:4px; font-weight:700; letter-spacing:1px; margin-left:auto; }

        .nav-section { padding:14px 12px 8px; }
        .nav-section-label { font-size:9px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:var(--muted); padding:0 8px; margin-bottom:6px; }

        .nav-item {
          display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px;
          cursor:pointer; transition:all .18s; user-select:none; margin-bottom:2px;
          border:1px solid transparent;
        }
        .nav-item:hover { background:var(--card); border-color:var(--border); }
        .nav-item.active { background:var(--accent-dim); border-color:rgba(232,193,74,0.2); }
        .nav-icon { font-size:15px; color:var(--muted2); flex-shrink:0; width:20px; text-align:center; transition:color .18s; }
        .nav-item.active .nav-icon { color:var(--accent); }
        .nav-label { font-size:13px; font-weight:500; color:var(--muted2); transition:color .18s; flex:1; }
        .nav-item.active .nav-label { color:var(--text); }
        .nav-credits { font-size:10px; background:var(--card2); color:var(--muted2); padding:2px 7px; border-radius:20px; border:1px solid var(--border2); flex-shrink:0; }
        .nav-item.active .nav-credits { background:var(--accent-dim); color:var(--accent); border-color:rgba(232,193,74,0.3); }

        .sidebar-views { padding:8px 12px; border-top:1px solid var(--border); margin-top:auto; }
        .view-btn { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px; cursor:pointer; transition:all .18s; margin-bottom:2px; border:1px solid transparent; }
        .view-btn:hover { background:var(--card); border-color:var(--border); }
        .view-btn.active { background:var(--card2); border-color:var(--border2); }
        .view-icon { font-size:14px; width:20px; text-align:center; color:var(--muted2); }
        .view-label { font-size:13px; font-weight:500; color:var(--muted2); }
        .view-btn.active .view-label, .view-btn.active .view-icon { color:var(--text); }

        .sidebar-user {
          padding:14px 16px; border-top:1px solid var(--border);
          display:flex; align-items:center; gap:10px; flex-shrink:0;
        }
        .user-avatar { width:34px; height:34px; border-radius:50%; object-fit:cover; border:2px solid var(--border2); flex-shrink:0; }
        .user-info { flex:1; min-width:0; }
        .user-name { font-size:12px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-plan { font-size:10px; color:var(--accent); font-weight:500; letter-spacing:.5px; }
        .logout-btn { background:none; border:1px solid var(--border2); border-radius:7px; color:var(--muted2); font-size:11px; padding:4px 9px; cursor:pointer; transition:all .18s; }
        .logout-btn:hover { border-color:var(--red); color:var(--red); }

        .credits-bar { margin:12px 12px 0; background:var(--card); border:1px solid var(--border2); border-radius:12px; padding:12px 14px; flex-shrink:0; }
        .credits-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
        .credits-label { font-size:10px; color:var(--muted2); font-weight:500; letter-spacing:.5px; text-transform:uppercase; }
        .credits-count { font-family:'Space Mono',monospace; font-size:12px; color:var(--accent); font-weight:700; }
        .credits-track { height:4px; background:var(--border2); border-radius:4px; overflow:hidden; }
        .credits-fill { height:100%; background:linear-gradient(90deg,var(--accent),var(--accent2)); border-radius:4px; transition:width .4s ease; }

        .main { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

        .main-topbar {
          padding:14px 28px; border-bottom:1px solid var(--border);
          display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
        }
        .topbar-title { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:3px; color:var(--text); }
        .topbar-desc { font-size:12px; color:var(--muted2); margin-top:1px; font-weight:300; }
        .topbar-right { display:flex; align-items:center; gap:10px; }
        .topbar-badge { font-size:11px; color:var(--muted2); background:var(--card); border:1px solid var(--border2); padding:5px 13px; border-radius:100px; }
        .status-dot { width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 8px var(--green); animation:blink 2s infinite; }
        .status-dot.busy { background:var(--accent); box-shadow:0 0 8px var(--accent-glow); animation:blink .7s infinite; }

        .progress-bar { height:2px; background:var(--border); flex-shrink:0; }
        .progress-fill-bar { height:100%; background:linear-gradient(90deg,var(--accent),var(--accent2)); transition:width .3s ease; box-shadow:0 0 8px var(--accent-glow); }

        .workspace { flex:1; display:flex; gap:0; overflow:hidden; }

        .controls { width:320px; min-width:320px; border-right:1px solid var(--border); overflow-y:auto; scrollbar-width:none; padding:20px 18px; display:flex; flex-direction:column; gap:18px; }
        .controls::-webkit-scrollbar { display:none; }

        .ctrl-section { display:flex; flex-direction:column; gap:8px; }
        .ctrl-label { font-size:9.5px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:var(--muted); }

        textarea, .url-input {
          width:100%; background:var(--card); border:1.5px solid var(--border2);
          border-radius:12px; color:var(--text); font-family:'DM Sans',sans-serif;
          font-size:13.5px; font-weight:300; line-height:1.7; padding:12px 13px;
          outline:none; transition:border-color .2s, box-shadow .2s;
        }
        textarea { resize:none; min-height:100px; padding-bottom:34px; }
        textarea::placeholder, .url-input::placeholder { color:var(--muted); }
        textarea:focus, .url-input:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-dim); }
        .prompt-wrap { position:relative; }
        .char-count { position:absolute; bottom:10px; right:12px; font-size:10px; color:var(--muted); font-family:'Space Mono',monospace; }

        .style-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .style-pill { background:var(--card); border:1.5px solid var(--border); border-radius:9px; padding:7px 10px; cursor:pointer; transition:all .18s; font-size:11.5px; font-weight:500; color:var(--muted2); text-align:center; user-select:none; }
        .style-pill:hover { border-color:var(--border2); color:var(--text); }
        .style-pill.active { border-color:var(--accent); background:var(--accent-dim); color:var(--accent2); }

        .uploaded-preview { width:100%; border-radius:10px; margin-top:10px; border:1px solid var(--border2); display:block; }

        .gen-btn {
          width:100%; padding:14px; background:var(--accent); border:none;
          border-radius:13px; color:#03030a; font-family:'Bebas Neue',sans-serif;
          font-size:18px; letter-spacing:2px; cursor:pointer; transition:all .2s;
          position:relative; overflow:hidden; box-shadow:0 6px 24px var(--accent-glow);
          display:flex; align-items:center; justify-content:center; gap:8px;
        }
        .gen-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 10px 32px var(--accent-glow); }
        .gen-btn:disabled { opacity:.4; cursor:not-allowed; transform:none; }
        .gen-btn-credits { font-family:'Space Mono',monospace; font-size:11px; background:rgba(0,0,0,0.2); padding:3px 8px; border-radius:6px; }

        .canvas { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:28px; gap:16px; overflow-y:auto; position:relative; scrollbar-width:none; }
        .canvas::-webkit-scrollbar { display:none; }

        .empty-state { display:flex; flex-direction:column; align-items:center; gap:12px; animation:fadeUp .5s ease both; text-align:center; opacity:.4; }
        .empty-icon { font-size:56px; line-height:1; }
        .empty-title { font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:4px; color:var(--muted2); }
        .empty-sub { font-size:12px; color:var(--muted); font-weight:300; }

        .loading-card { width:100%; max-width:540px; aspect-ratio:1/1; border-radius:20px; background:var(--card); border:1px solid var(--border2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; position:relative; overflow:hidden; }
        .loading-card::after { content:''; position:absolute; inset:0; background:linear-gradient(105deg,transparent 30%,rgba(232,193,74,.04) 50%,transparent 70%); animation:shimmer 2s infinite; }
        .spinner { width:36px; height:36px; border:2.5px solid var(--border2); border-top-color:var(--accent); border-radius:50%; animation:spin .8s linear infinite; }
        .loading-label { font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:3px; color:var(--accent); text-shadow:0 0 20px var(--accent-glow); z-index:1; }
        .loading-sub-text { font-size:11px; color:var(--muted2); z-index:1; }

        .result-frame { width:100%; max-width:540px; border-radius:20px; overflow:hidden; border:1px solid var(--border2); box-shadow:0 24px 60px rgba(0,0,0,.6); animation:reveal .4s ease both; position:relative; cursor:pointer; }
        .result-frame img { display:block; width:100%; height:auto; }
        .result-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 50%); opacity:0; transition:opacity .25s; display:flex; align-items:flex-end; padding:16px; gap:8px; }
        .result-frame:hover .result-overlay { opacity:1; }
        .overlay-btn { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2); border-radius:8px; color:white; font-size:11.5px; font-weight:500; padding:7px 14px; cursor:pointer; backdrop-filter:blur(10px); transition:all .18s; font-family:'DM Sans',sans-serif; }
        .overlay-btn:hover { background:var(--accent); color:#000; border-color:var(--accent); }

        .audio-player { width:100%; max-width:540px; background:var(--card); border:1px solid var(--border2); border-radius:16px; padding:20px; animation:reveal .4s ease both; }
        .audio-player audio { width:100%; margin-top:10px; }
        .audio-label { font-family:'Bebas Neue',sans-serif; font-size:16px; letter-spacing:2px; color:var(--accent); }

        .result-caption { max-width:540px; font-size:12px; color:var(--muted2); font-style:italic; text-align:center; line-height:1.5; font-weight:300; }

        .error-box { background:rgba(231,76,60,.07); border:1px solid rgba(231,76,60,.25); border-radius:12px; padding:14px 18px; font-size:13px; color:var(--red); max-width:500px; text-align:center; animation:fadeUp .3s ease both; }

        .history-view { flex:1; overflow-y:auto; padding:24px 28px; scrollbar-width:none; }
        .history-view::-webkit-scrollbar { display:none; }
        .history-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; }
        .history-card { background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; cursor:pointer; transition:all .2s; }
        .history-card:hover { border-color:var(--accent); transform:translateY(-2px); box-shadow:0 10px 30px rgba(0,0,0,.4); }
        .history-img { width:100%; aspect-ratio:1/1; object-fit:cover; display:block; }
        .history-info { padding:10px 12px; }
        .history-tool { font-size:9px; color:var(--accent); font-weight:600; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:3px; }
        .history-prompt { font-size:11.5px; color:var(--muted2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .history-empty { display:flex; flex-direction:column; align-items:center; gap:12px; padding:60px; text-align:center; opacity:.4; }

        .profile-view { flex:1; overflow-y:auto; padding:32px 40px; scrollbar-width:none; }
        .profile-view::-webkit-scrollbar { display:none; }
        .profile-card { background:var(--card); border:1px solid var(--border2); border-radius:20px; padding:28px; max-width:560px; display:flex; flex-direction:column; gap:20px; }
        .profile-header { display:flex; align-items:center; gap:16px; }
        .profile-avatar { width:64px; height:64px; border-radius:50%; border:3px solid var(--accent); object-fit:cover; }
        .profile-name { font-family:'Bebas Neue',sans-serif; font-size:24px; letter-spacing:2px; color:var(--text); }
        .profile-email { font-size:13px; color:var(--muted2); }
        .profile-plan { display:inline-block; background:var(--accent-dim); color:var(--accent); border:1px solid rgba(232,193,74,.3); border-radius:6px; padding:3px 10px; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-top:4px; }
        .stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .stat-card { background:var(--card2); border:1px solid var(--border); border-radius:12px; padding:14px 16px; }
        .stat-value { font-family:'Space Mono',monospace; font-size:24px; color:var(--accent); font-weight:700; }
        .stat-label { font-size:11px; color:var(--muted2); margin-top:3px; }
        .upgrade-btn { width:100%; padding:14px; background:linear-gradient(135deg,var(--accent),var(--accent2)); border:none; border-radius:12px; color:#000; font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:2px; cursor:pointer; transition:all .2s; box-shadow:0 6px 24px var(--accent-glow); }
        .upgrade-btn:hover { transform:translateY(-1px); box-shadow:0 10px 32px var(--accent-glow); }

        .toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); padding:11px 22px; border-radius:100px; font-size:13px; font-weight:500; z-index:9999; animation:toastIn .3s ease both; white-space:nowrap; box-shadow:0 8px 32px rgba(0,0,0,.4); }
        .toast-success { background:var(--green); color:#000; }
        .toast-error { background:var(--red); color:#fff; }
        .toast-info { background:var(--card2); color:var(--text); border:1px solid var(--border2); }

        .mobile-topbar { display:none; }
        .mobile-overlay { display:none; }

        @media (max-width:900px) {
          :root { --sidebar:240px; }
          .controls { width:280px; min-width:280px; }
        }

        @media (max-width:767px) {
          .app { position:relative; }
          .sidebar {
            position:fixed; top:0; left:0; bottom:0; z-index:100;
            transform:translateX(-100%); transition:transform .3s ease;
            width:280px; min-width:280px;
          }
          .sidebar.open { transform:translateX(0); animation:slideIn .3s ease; }
          .mobile-overlay { display:block; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:99; backdrop-filter:blur(2px); }
          .mobile-topbar {
            display:flex; align-items:center; justify-content:space-between;
            padding:12px 16px; border-bottom:1px solid var(--border);
            background:var(--panel); flex-shrink:0;
          }
          .hamburger { background:none; border:1px solid var(--border2); border-radius:8px; color:var(--text); font-size:18px; padding:6px 10px; cursor:pointer; }
          .main { overflow:hidden; }
          .main-topbar { padding:12px 16px; display:none; }
          .workspace { flex-direction:column; overflow-y:auto; -webkit-overflow-scrolling:touch; }
          .controls { width:100%; min-width:unset; border-right:none; border-bottom:1px solid var(--border); overflow-y:visible; padding:16px; }
          .canvas { padding:16px; justify-content:flex-start; min-height:400px; }
          .history-view { padding:16px; }
          .profile-view { padding:16px; }
          .loading-card { aspect-ratio:1/1; }
        }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app">
        <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
          <div className="sidebar-brand">
            <img src="/logo192.png" alt="RP Vision AI" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6, filter: "drop-shadow(0 0 6px rgba(232,193,74,0.5))" }} />
            <span className="brand-text">RP VISION AI</span>
            <span className="brand-version">V2</span>
          </div>

          <div className="credits-bar">
            <div className="credits-row">
              <span className="credits-label">Daily Credits</span>
              <span className="credits-count">{creditsLeft} / {FREE_CREDITS_PER_DAY}</span>
            </div>
            <div className="credits-track">
              <div className="credits-fill" style={{ width: (creditsLeft / FREE_CREDITS_PER_DAY * 100) + "%" }} />
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">AI Tools</div>
            {TOOLS.map(t => (
              <div key={t.id}
                className={"nav-item" + (activeTool.id === t.id && view === "create" ? " active" : "")}
                onClick={() => { setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-label">{t.label}</span>
                <span className="nav-credits">{t.credits}cr</span>
              </div>
            ))}
          </div>

          <div className="sidebar-views">
            <div className={"view-btn" + (view === "history" ? " active" : "")} onClick={() => { setView("history"); setSidebarOpen(false); }}>
              <span className="view-icon">◫</span>
              <span className="view-label">History</span>
            </div>
            <div className={"view-btn" + (view === "profile" ? " active" : "")} onClick={() => { setView("profile"); setSidebarOpen(false); }}>
              <span className="view-icon">◯</span>
              <span className="view-label">Profile</span>
            </div>
          </div>

          <div className="sidebar-user">
            <img className="user-avatar" src={user.photoURL} alt="" />
            <div className="user-info">
              <div className="user-name">{user.displayName}</div>
              <div className="user-plan">FREE PLAN</div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Out</button>
          </div>
        </aside>

        <main className="main">
          <div className="mobile-topbar">
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 3, color: "var(--accent)" }}>RP VISION AI</span>
            <span style={{ fontSize: 11, color: "var(--muted2)" }}>{creditsLeft}cr left</span>
          </div>

          <div className="main-topbar">
            <div>
              <div className="topbar-title">{activeTool.label}</div>
              <div className="topbar-desc">{activeTool.desc}</div>
            </div>
            <div className="topbar-right">
              <div className={"status-dot" + (loading ? " busy" : "")} />
              {view === "history" && <span className="topbar-badge">{history.length} items</span>}
              {view === "create" && <span className="topbar-badge">{creditsLeft} credits left</span>}
            </div>
          </div>

          <div className="progress-bar">
            <div className="progress-fill-bar" style={{ width: progress + "%" }} />
          </div>

          {view === "create" && (
            <div className="workspace">
              <div className="controls">
                {!["upscale", "remove-bg"].includes(activeTool.id) && (
                  <div className="ctrl-section">
                    <div className="ctrl-label">Prompt</div>
                    <div className="prompt-wrap">
                      <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value.slice(0, 500))}
                        placeholder={
                          activeTool.id === "text-to-audio" ? "Describe the music or sound you want..." :
                            activeTool.id === "image-to-video" ? "Describe how to animate this image..." :
                              "Describe what you want to create..."
                        }
                        rows={4}
                      />
                      <span className="char-count">{prompt.length}/500</span>
                    </div>
                  </div>
                )}

                {needsImageInput && (
                  <div className="ctrl-section">
                    <div className="ctrl-label">Input Image URL</div>
                    <input
                      className="url-input"
                      value={inputImageUrl}
                      onChange={e => setInputImageUrl(e.target.value)}
                      placeholder="Paste image URL here..."
                    />
                    {inputImageUrl && (
                      <img src={inputImageUrl} alt="" className="uploaded-preview" onError={e => e.target.style.display = "none"} />
                    )}
                  </div>
                )}

                {["text-to-image", "image-to-image"].includes(activeTool.id) && (
                  <div className="ctrl-section">
                    <div className="ctrl-label">Art Style</div>
                    <div className="style-grid">
                      {STYLES.map((s, i) => (
                        <div key={i} className={"style-pill" + (style === i ? " active" : "")}
                          onClick={() => setStyle(style === i ? null : i)}>
                          {s.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button className="gen-btn" disabled={loading || creditsLeft < activeTool.credits} onClick={generate}>
                  {loading ? <><Spinner />&nbsp;Generating...</> : <>
                    {activeTool.icon}&nbsp;Generate
                    <span className="gen-btn-credits">{activeTool.credits} cr</span>
                  </>}
                </button>

                {creditsLeft < activeTool.credits && !loading && (
                  <div style={{ fontSize: 11, color: "var(--red)", textAlign: "center" }}>
                    Not enough credits. Resets at midnight.
                  </div>
                )}
              </div>

              <div className="canvas">
                {!loading && !result && !error && (
                  <div className="empty-state">
                    <div className="empty-icon">{activeTool.icon}</div>
                    <div className="empty-title">{activeTool.label}</div>
                    <div className="empty-sub">{activeTool.desc}</div>
                  </div>
                )}

                {loading && (
                  <div className="loading-card">
                    <div className="spinner" />
                    <div className="loading-label">GENERATING...</div>
                    <div className="loading-sub-text">This may take 10–30 seconds</div>
                  </div>
                )}

                {error && !loading && <div className="error-box">⚠ {error}</div>}

                {result && !loading && (
                  <>
                    {result.type === "image" && (
                      <div className="result-frame">
                        <img src={result.url} alt="Generated" />
                        <div className="result-overlay">
                          <button className="overlay-btn" onClick={() => download(result.url)}>↓ Download</button>
                          <button className="overlay-btn" onClick={() => setResult(null)}>✕ Clear</button>
                          <button className="overlay-btn" onClick={generate}>↻ Redo</button>
                        </div>
                      </div>
                    )}
                    {result.type === "audio" && (
                      <div className="audio-player">
                        <div className="audio-label">◎ GENERATED AUDIO</div>
                        <audio controls src={result.url} style={{ width: "100%", marginTop: 10 }} />
                        <button className="overlay-btn" style={{ marginTop: 10 }} onClick={() => download(result.url, "mp3")}>↓ Download Audio</button>
                      </div>
                    )}
                    {prompt && <div className="result-caption">"{prompt}"</div>}
                  </>
                )}
              </div>
            </div>
          )}

          {view === "history" && (
            <div className="history-view">
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--text)" }}>Generation History</div>
                <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 3 }}>Your last 20 generations</div>
              </div>
              {historyLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
              ) : history.length === 0 ? (
                <div className="history-empty">
                  <div style={{ fontSize: 44, opacity: .3 }}>◫</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 3, color: "var(--muted2)" }}>NO HISTORY YET</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Generate something to see it here</div>
                </div>
              ) : (
                <div className="history-grid">
                  {history.map(h => (
                    <div key={h.id} className="history-card" onClick={() => { setResult({ type: "image", url: h.outputUrl }); setActiveTool(TOOLS.find(t => t.id === h.toolId) || TOOLS[0]); setView("create"); }}>
                      <img className="history-img" src={h.outputUrl} alt="" onError={e => e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"} />
                      <div className="history-info">
                        <div className="history-tool">{h.toolId?.replace(/-/g, " ")}</div>
                        <div className="history-prompt">{h.prompt || "No prompt"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "profile" && (
            <div className="profile-view">
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--text)" }}>My Profile</div>
                <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 3 }}>Manage your account</div>
              </div>
              <div className="profile-card">
                <div className="profile-header">
                  <img className="profile-avatar" src={user.photoURL} alt="" />
                  <div>
                    <div className="profile-name">{user.displayName}</div>
                    <div className="profile-email">{user.email}</div>
                    <div className="profile-plan">FREE PLAN</div>
                  </div>
                </div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{creditsLeft}</div>
                    <div className="stat-label">Credits Left Today</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{creditsUsed}</div>
                    <div className="stat-label">Credits Used Today</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{FREE_CREDITS_PER_DAY}</div>
                    <div className="stat-label">Daily Free Credits</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">7</div>
                    <div className="stat-label">AI Tools Available</div>
                  </div>
                </div>
                <button className="upgrade-btn" onClick={() => showToast("Payment coming soon! 🚀", "info")}>
                  ⬡ UPGRADE TO PRO — COMING SOON
                </button>
                <button style={{ background: "none", border: "1px solid rgba(231,76,60,.3)", borderRadius: 10, color: "var(--red)", padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 500 }} onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
