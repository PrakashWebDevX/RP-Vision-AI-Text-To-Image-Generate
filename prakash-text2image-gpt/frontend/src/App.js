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
  { id: "text-to-image",  label: "Text to Image",     icon: "⬡", credits: 1, desc: "Generate images from text prompts" },
  { id: "image-to-image", label: "Image to Image",    icon: "⬢", credits: 2, desc: "Transform images with AI" },
  { id: "text-to-video",  label: "Text to Video",     icon: "◈", credits: 5, desc: "Generate cinematic video frames" },
  { id: "image-to-video", label: "Image to Video",    icon: "◉", credits: 5, desc: "Animate any image with AI" },
  { id: "text-to-audio",  label: "Text to Audio",     icon: "◎", credits: 3, desc: "Generate speech from text" },
  { id: "upscale",        label: "Image Upscaler",    icon: "◐", credits: 2, desc: "Upscale images to HD quality" },
  { id: "remove-bg",      label: "Remove Background", icon: "◑", credits: 1, desc: "Remove image backgrounds instantly" },
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

const CLOUDINARY_CLOUD = "dt6dp806u";
const CLOUDINARY_PRESET = "RPVISIONAI";

async function uploadToCloudinary(blob) {
  try {
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    fd.append("folder", "rp-vision-ai");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (data.secure_url) return data.secure_url;
    throw new Error("Cloudinary upload failed");
  } catch (err) {
    console.error("Cloudinary error:", err);
    return null;
  }
}

async function saveToHistory(uid, toolId, outputUrl, prompt) {
  await addDoc(collection(db, "history"), { uid, toolId, outputUrl, prompt, createdAt: serverTimestamp() });
}

async function fetchHistory(uid) {
  const q = query(collection(db, "history"), where("uid","==",uid), orderBy("createdAt","desc"), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function Spinner() { return <div className="spinner" />; }
function Toast({ msg, type }) { return msg ? <div className={"toast toast-" + type}>{msg}</div> : null; }

function ImageUploader({ file, previewUrl, onFileChange, onClear }) {
  const inputRef = useRef(null);
  const handleDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) onFileChange(f); };
  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { if (e.target.files[0]) onFileChange(e.target.files[0]); }} />
      {!file ? (
        <div className="upload-drop-zone" onClick={() => inputRef.current.click()} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
          <div className="upload-drop-icon">＋</div>
          <div className="upload-drop-title">Click or drag & drop</div>
          <div className="upload-drop-sub">PNG, JPG, WEBP supported</div>
        </div>
      ) : (
        <div className="upload-preview-wrap">
          <img src={previewUrl} alt="Input" className="upload-preview-img" />
          <div className="upload-preview-bar">
            <span className="upload-preview-name">{file.name}</span>
            <button className="upload-clear-btn" onClick={onClear}>✕ Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PREMIUM LOGIN SCREEN ───────────────────────────────────
function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  const handleLogin = async () => { setLoading(true); try { await onLogin(); } finally { setLoading(false); } };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;
    let animId;

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      o: Math.random(), speed: Math.random() * 0.008 + 0.002,
      color: ["#00d4ff","#8b5cf6","#ff2d78","#ffffff"][Math.floor(Math.random()*4)]
    }));

    const particles = Array.from({ length: 30 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      color: ["rgba(0,212,255,0.6)","rgba(139,92,246,0.6)","rgba(255,45,120,0.6)"][Math.floor(Math.random()*3)]
    }));

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      // deep space bg
      const bg = ctx.createRadialGradient(W*0.3, H*0.4, 0, W*0.5, H*0.5, W*0.8);
      bg.addColorStop(0, "rgba(0,30,40,1)");
      bg.addColorStop(0.4, "rgba(5,0,20,1)");
      bg.addColorStop(1, "rgba(0,0,5,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // nebula glow left
      const g1 = ctx.createRadialGradient(W*0.2, H*0.3, 0, W*0.2, H*0.3, W*0.35);
      g1.addColorStop(0, "rgba(0,212,255,0.08)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

      // nebula glow right
      const g2 = ctx.createRadialGradient(W*0.8, H*0.7, 0, W*0.8, H*0.7, W*0.3);
      g2.addColorStop(0, "rgba(255,45,120,0.07)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

      // center glow
      const g3 = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, W*0.4);
      g3.addColorStop(0, "rgba(139,92,246,0.05)");
      g3.addColorStop(1, "transparent");
      ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);

      // stars
      stars.forEach(s => {
        s.o += s.speed * Math.sin(t * 0.001 + s.x);
        if (s.o > 1) s.speed *= -1;
        if (s.o < 0.1) s.speed = Math.abs(s.speed);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0.1, s.o);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // floating particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; });
    ro.observe(canvas);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Space+Mono&display=swap');
        .login-root { position:fixed; inset:0; z-index:9999; overflow:hidden; font-family:'Rajdhani',sans-serif; }
        .login-canvas { position:absolute; inset:0; width:100%; height:100%; }
        .login-page { position:relative; z-index:1; display:flex; height:100vh; }

        /* LEFT PANEL */
        .login-left { flex:1.2; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:60px 50px; position:relative; }
        .login-left::after { content:''; position:absolute; right:0; top:0; bottom:0; width:1px; background:linear-gradient(to bottom, transparent, rgba(0,212,255,0.3) 20%, rgba(139,92,246,0.5) 50%, rgba(255,45,120,0.3) 80%, transparent); }

        .logo-container { position:relative; display:flex; flex-direction:column; align-items:center; }
        .logo-glow-ring { position:absolute; width:280px; height:280px; border-radius:50%; background:transparent; border:1px solid rgba(0,212,255,0.15); animation:ringPulse 3s ease-in-out infinite; top:50%; left:50%; transform:translate(-50%,-50%); }
        .logo-glow-ring2 { position:absolute; width:240px; height:240px; border-radius:50%; background:transparent; border:1px solid rgba(139,92,246,0.2); animation:ringPulse 3s ease-in-out infinite 1s; top:50%; left:50%; transform:translate(-50%,-50%); }
        @keyframes ringPulse { 0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.05)} }
        .logo-img { width:180px; height:180px; object-fit:contain; position:relative; z-index:1; filter:drop-shadow(0 0 40px rgba(0,212,255,0.5)) drop-shadow(0 0 80px rgba(139,92,246,0.3)); animation:logoFloat 5s ease-in-out infinite; }
        @keyframes logoFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.02)} }

        .brand-title { font-family:'Orbitron',monospace; font-size:2.2rem; font-weight:900; letter-spacing:0.2em; text-transform:uppercase; margin-top:24px; background:linear-gradient(135deg, #00d4ff 0%, #8b5cf6 40%, #ff2d78 80%, #00d4ff 100%); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:gradShift 4s linear infinite; }
        @keyframes gradShift { 0%{background-position:0%} 100%{background-position:200%} }
        .brand-sub { font-size:0.75rem; letter-spacing:0.5em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-top:8px; text-align:center; }

        .stats-row { display:flex; gap:36px; margin-top:44px; }
        .stat-item { text-align:center; position:relative; }
        .stat-item::after { content:''; position:absolute; right:-18px; top:15%; bottom:15%; width:1px; background:rgba(255,255,255,0.08); }
        .stat-item:last-child::after { display:none; }
        .stat-num { font-family:'Orbitron',monospace; font-size:1.8rem; font-weight:800; }
        .stat-num.cyan { color:#00d4ff; text-shadow:0 0 20px rgba(0,212,255,0.5); }
        .stat-num.purple { color:#8b5cf6; text-shadow:0 0 20px rgba(139,92,246,0.5); }
        .stat-num.pink { color:#ff2d78; text-shadow:0 0 20px rgba(255,45,120,0.5); }
        .stat-label { font-size:0.65rem; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-top:4px; }

        .features-list { display:flex; flex-direction:column; gap:12px; margin-top:44px; width:100%; max-width:360px; }
        .feature-item { display:flex; align-items:center; gap:14px; padding:13px 18px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); transition:all 0.3s; cursor:default; backdrop-filter:blur(4px); }
        .feature-item:hover { background:rgba(0,212,255,0.05); border-color:rgba(0,212,255,0.2); transform:translateX(6px); }
        .feature-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
        .fi-cyan { background:rgba(0,212,255,0.12); border:1px solid rgba(0,212,255,0.2); }
        .fi-purple { background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.2); }
        .fi-pink { background:rgba(255,45,120,0.12); border:1px solid rgba(255,45,120,0.2); }
        .feature-text strong { display:block; color:#fff; font-size:0.9rem; font-weight:600; }
        .feature-text span { color:rgba(255,255,255,0.45); font-size:0.8rem; }

        /* RIGHT PANEL */
        .login-right { flex:0.9; display:flex; align-items:center; justify-content:center; padding:40px; }
        .login-card { width:100%; max-width:440px; position:relative; }

        .card-bg { background:rgba(8,8,20,0.85); border-radius:24px; padding:52px 48px; border:1px solid rgba(139,92,246,0.2); backdrop-filter:blur(30px); box-shadow: 0 0 0 1px rgba(0,212,255,0.05), 0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05); animation:cardReveal 0.8s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes cardReveal { from{opacity:0;transform:translateY(30px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }

        /* corner accents */
        .card-corner { position:absolute; width:24px; height:24px; }
        .card-corner.tl { top:-1px; left:-1px; border-top:2px solid #00d4ff; border-left:2px solid #00d4ff; border-radius:24px 0 0 0; }
        .card-corner.tr { top:-1px; right:-1px; border-top:2px solid #8b5cf6; border-right:2px solid #8b5cf6; border-radius:0 24px 0 0; }
        .card-corner.bl { bottom:-1px; left:-1px; border-bottom:2px solid #8b5cf6; border-left:2px solid #8b5cf6; border-radius:0 0 0 24px; }
        .card-corner.br { bottom:-1px; right:-1px; border-bottom:2px solid #ff2d78; border-right:2px solid #ff2d78; border-radius:0 0 24px 0; }

        /* scan line */
        .scan-line { position:absolute; left:0; right:0; height:2px; top:0; border-radius:24px 24px 0 0; background:linear-gradient(90deg, transparent, rgba(0,212,255,0.6), rgba(139,92,246,0.6), rgba(255,45,120,0.6), transparent); animation:scan 5s ease-in-out infinite; }
        @keyframes scan { 0%{top:0%;opacity:0} 5%{opacity:1} 95%{opacity:1} 100%{top:100%;opacity:0} }

        .card-title { font-family:'Orbitron',monospace; font-size:1.6rem; font-weight:700; color:#fff; letter-spacing:0.05em; margin-bottom:6px; }
        .card-sub { color:rgba(255,255,255,0.35); font-size:0.9rem; letter-spacing:0.05em; margin-bottom:42px; }

        /* Google button */
        .google-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:14px; padding:16px 24px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:14px; color:#fff; font-family:'Rajdhani',sans-serif; font-size:1.05rem; font-weight:600; letter-spacing:0.08em; cursor:pointer; position:relative; overflow:hidden; transition:all 0.3s; }
        .google-btn::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(0,212,255,0.06),rgba(139,92,246,0.06),rgba(255,45,120,0.06)); opacity:0; transition:opacity 0.3s; }
        .google-btn:hover:not(:disabled) { background:rgba(255,255,255,0.07); border-color:rgba(0,212,255,0.4); box-shadow:0 0 30px rgba(0,212,255,0.12),0 0 60px rgba(139,92,246,0.06); transform:translateY(-2px); }
        .google-btn:hover::before { opacity:1; }
        .google-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .google-btn-arrow { position:absolute; right:18px; opacity:0; transform:translateX(-8px); transition:all 0.3s; color:#00d4ff; font-size:1.2rem; }
        .google-btn:hover:not(:disabled) .google-btn-arrow { opacity:1; transform:translateX(0); }
        .g-icon { width:22px; height:22px; flex-shrink:0; }
        .btn-spinner { width:20px; height:20px; border:2px solid rgba(0,212,255,0.2); border-top-color:#00d4ff; border-radius:50%; animation:spin 0.8s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }

        /* divider */
        .divider { display:flex; align-items:center; gap:14px; margin:28px 0; color:rgba(255,255,255,0.18); font-size:0.75rem; letter-spacing:0.2em; }
        .divider::before,.divider::after { content:''; flex:1; height:1px; background:linear-gradient(to right,transparent,rgba(255,255,255,0.08),transparent); }

        .coming-soon { text-align:center; color:rgba(255,255,255,0.25); font-size:0.85rem; letter-spacing:0.05em; }

        /* trust row */
        .trust-row { display:flex; justify-content:space-between; margin-top:32px; }
        .trust-item { display:flex; align-items:center; gap:6px; font-size:0.7rem; color:rgba(255,255,255,0.28); letter-spacing:0.05em; }
        .trust-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .td-cyan { background:#00d4ff; box-shadow:0 0 8px rgba(0,212,255,0.8); }
        .td-purple { background:#8b5cf6; box-shadow:0 0 8px rgba(139,92,246,0.8); }
        .td-pink { background:#ff2d78; box-shadow:0 0 8px rgba(255,45,120,0.8); }

        /* terms */
        .terms-text { margin-top:22px; font-size:0.7rem; color:rgba(255,255,255,0.18); text-align:center; line-height:1.8; }
        .terms-link { background:none; border:none; color:rgba(0,212,255,0.5); cursor:pointer; font-size:0.7rem; padding:0; transition:color 0.2s; }
        .terms-link:hover { color:#00d4ff; }

        /* plan preview badges */
        .plan-badges { display:flex; gap:8px; margin-top:28px; justify-content:center; }
        .plan-badge { font-size:0.68rem; padding:4px 10px; border-radius:100px; font-weight:600; letter-spacing:0.05em; }
        .pb-free { background:rgba(0,212,255,0.08); color:#00d4ff; border:1px solid rgba(0,212,255,0.2); }
        .pb-pro { background:rgba(139,92,246,0.08); color:#8b5cf6; border:1px solid rgba(139,92,246,0.2); }
        .pb-unlimited { background:rgba(255,45,120,0.08); color:#ff2d78; border:1px solid rgba(255,45,120,0.2); }

        @media(max-width:768px) {
          .login-page { flex-direction:column; overflow-y:auto; height:auto; min-height:100vh; }
          .login-left { padding:50px 24px 30px; }
          .login-left::after { display:none; }
          .logo-img { width:130px; height:130px; }
          .brand-title { font-size:1.5rem; }
          .login-right { padding:24px 20px 50px; }
          .card-bg { padding:36px 28px; }
          .login-root { overflow-y:auto; }
        }
      `}</style>

      <div className="login-root">
        <canvas ref={canvasRef} className="login-canvas" />
        <div className="login-page">

          {/* LEFT */}
          <div className="login-left">
            <div className="logo-container">
              <div className="logo-glow-ring" />
              <div className="logo-glow-ring2" />
              <img src="/logo192.png" alt="RP Vision AI" className="logo-img" />
            </div>
            <div className="brand-title">RP Vision AI</div>
            <div className="brand-sub">Create Without Limits</div>

            <div className="stats-row">
              <div className="stat-item"><div className="stat-num cyan">7</div><div className="stat-label">AI Models</div></div>
              <div className="stat-item"><div className="stat-num purple">10</div><div className="stat-label">Free Credits</div></div>
              <div className="stat-item"><div className="stat-num pink">4K</div><div className="stat-label">Output</div></div>
            </div>

            <div className="features-list">
              <div className="feature-item">
                <div className="feature-icon fi-cyan">⚡</div>
                <div className="feature-text"><strong>Instant Generation</strong><span>Text to image in seconds</span></div>
              </div>
              <div className="feature-item">
                <div className="feature-icon fi-purple">🎨</div>
                <div className="feature-text"><strong>Multiple Art Styles</strong><span>Realistic, anime, abstract & more</span></div>
              </div>
              <div className="feature-item">
                <div className="feature-icon fi-pink">🔓</div>
                <div className="feature-text"><strong>Free Forever Plan</strong><span>10 credits daily, no credit card</span></div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="login-right">
            <div className="login-card">
              <div className="card-bg">
                <div className="scan-line" />
                <div className="card-corner tl" /><div className="card-corner tr" />
                <div className="card-corner bl" /><div className="card-corner br" />

                <div className="card-title">Welcome Back</div>
                <div className="card-sub">Sign in to start creating with AI</div>

                <button className="google-btn" onClick={handleLogin} disabled={loading}>
                  {loading ? <div className="btn-spinner" /> : (<>
                    <svg className="g-icon" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                    <span className="google-btn-arrow">→</span>
                  </>)}
                </button>

                <div className="divider">OR</div>
                <div className="coming-soon">More sign-in options coming soon</div>

                <div className="plan-badges">
                  <span className="plan-badge pb-free">Free · 10cr/day</span>
                  <span className="plan-badge pb-pro">Pro · ₹99/mo</span>
                  <span className="plan-badge pb-unlimited">Unlimited · ₹599/mo</span>
                </div>

                <div className="trust-row">
                  <div className="trust-item"><div className="trust-dot td-cyan" /> Secure OAuth</div>
                  <div className="trust-item"><div className="trust-dot td-purple" /> Instant Access</div>
                  <div className="trust-item"><div className="trust-dot td-pink" /> Free Forever</div>
                </div>
                <div className="terms-text">
                  By continuing, you agree to our{" "}
                  <button className="terms-link">Terms of Service</button>{" "}&amp;{" "}
                  <button className="terms-link">Privacy Policy</button>
                </div>
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
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTool, setActiveTool]   = useState(TOOLS[0]);
  const [prompt, setPrompt]           = useState("");
  const [style, setStyle]             = useState(null);
  const [inputFile, setInputFile]     = useState(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);
  const [progress, setProgress]       = useState(0);
  const [view, setView]               = useState("create");
  const [history, setHistory]         = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toast, setToast]             = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const progressRef = useRef(null);

  useEffect(() => {
    if (inputPreviewUrl) URL.revokeObjectURL(inputPreviewUrl);
    setInputFile(null); setInputPreviewUrl(null); setResult(null); setError(null);
  }, [activeTool.id]);

  const handleFileChange = (file) => {
    if (inputPreviewUrl) URL.revokeObjectURL(inputPreviewUrl);
    setInputFile(file); setInputPreviewUrl(URL.createObjectURL(file));
  };
  const handleFileClear = () => {
    if (inputPreviewUrl) URL.revokeObjectURL(inputPreviewUrl);
    setInputFile(null); setInputPreviewUrl(null);
  };

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

  const handleLogin  = async () => { const res = await signInWithPopup(auth, provider); await getOrCreateUser(res.user); };
  const handleLogout = async () => { await signOut(auth); setResult(null); setHistory([]); };

  const startProgress = () => {
    setProgress(0); let p = 0;
    progressRef.current = setInterval(() => { p += Math.random() * 3; if (p >= 90) { clearInterval(progressRef.current); p = 90; } setProgress(p); }, 300);
  };
  const stopProgress = () => { clearInterval(progressRef.current); setProgress(100); setTimeout(() => setProgress(0), 600); };

  const showToast = (msg, type = "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const creditsLeft = FREE_CREDITS_PER_DAY - creditsUsed;

  const generate = useCallback(async () => {
    if (loading) return;
    const needsFile   = ["image-to-image","remove-bg","upscale","image-to-video"].includes(activeTool.id);
    const needsPrompt = !["upscale","remove-bg","image-to-video"].includes(activeTool.id);
    if (needsPrompt && !prompt.trim()) { showToast("Please enter a prompt!", "error"); return; }
    if (needsFile && !inputFile) { showToast("Please upload an image first!", "error"); return; }
    if (creditsLeft < activeTool.credits) { showToast(`Not enough credits! Need ${activeTool.credits}, have ${creditsLeft}`, "error"); return; }

    setError(null); setResult(null); setLoading(true); startProgress();
    const ok = await checkAndDeductCredits(user.uid, activeTool.credits);
    if (!ok) { setLoading(false); stopProgress(); showToast("Daily credit limit reached! Resets at midnight.", "error"); return; }
    setCreditsUsed(c => c + activeTool.credits);

    try {
      const styleTag = style !== null ? STYLES[style].tag : "";
      const fullPrompt = [prompt.trim(), styleTag].filter(Boolean).join(", ");
      let endpoint = activeTool.id;
      let fetchOptions = {};
      if (activeTool.id === "remove-bg") endpoint = "remove-background";

      if (needsFile && inputFile) {
        const fd = new FormData();
        fd.append("image", inputFile);
        if (activeTool.id === "image-to-image") fd.append("prompt", fullPrompt);
        if (activeTool.id === "image-to-video") fd.append("prompt", fullPrompt);
        fetchOptions = { method:"POST", body:fd };
      } else {
        fetchOptions = { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ prompt:fullPrompt }) };
      }

      const res = await fetch(`${BACKEND}/${endpoint}`, fetchOptions);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Generation failed (${res.status})`); }

      if (activeTool.id === "text-to-audio") {
        const data = await res.json();
        const text = data.text || prompt;
        if (!window.speechSynthesis) throw new Error("Your browser doesn't support speech. Try Chrome.");
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; utterance.pitch = 1; utterance.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const v = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) || voices.find(v => v.lang.startsWith("en"));
        if (v) utterance.voice = v;
        window.speechSynthesis.speak(utterance);
        setResult({ type:"audio", text, utterance });
        await saveToHistory(user.uid, activeTool.id, "", prompt);
        showToast("Audio generated successfully!", "success");
      } else {
        const blob = await res.blob();
        const localUrl = URL.createObjectURL(blob);
        setResult({ type:"image", url:localUrl });
        // Upload to Cloudinary for permanent storage
        const cloudUrl = await uploadToCloudinary(blob);
        await saveToHistory(user.uid, activeTool.id, cloudUrl || localUrl, prompt);
        showToast("Generated successfully!", "success");
      }
    } catch (err) { setError(err.message); showToast(err.message, "error"); }
    finally { stopProgress(); setLoading(false); }
  }, [prompt, style, activeTool, inputFile, loading, creditsLeft, user]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try { setHistory(await fetchHistory(user.uid)); } finally { setHistoryLoading(false); }
  }, [user]);

  useEffect(() => { if (view === "history" && user) loadHistory(); }, [view, user, loadHistory]);

  const download = (url, ext = "png") => { const a = document.createElement("a"); a.href = url; a.download = `rp-vision-${Date.now()}.${ext}`; a.click(); };

  if (authLoading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#03030a" }}>
      <div style={{ width:48, height:48, border:"3px solid rgba(0,212,255,0.2)", borderTopColor:"#00d4ff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const needsImageInput = ["image-to-image","image-to-video","upscale","remove-bg"].includes(activeTool.id);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=Space+Mono&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --bg:#03030a; --panel:#07070f; --card:#0d0d1a; --card2:#111120;
          --border:rgba(255,255,255,0.05); --border2:rgba(255,255,255,0.09);
          --cyan:#00d4ff; --purple:#8b5cf6; --pink:#ff2d78;
          --cyan-dim:rgba(0,212,255,0.1); --purple-dim:rgba(139,92,246,0.1); --pink-dim:rgba(255,45,120,0.1);
          --cyan-glow:rgba(0,212,255,0.25); --purple-glow:rgba(139,92,246,0.25);
          --green:#2ecc71; --red:#e74c3c;
          --text:#eeeef5; --muted:#44445a; --muted2:#7777a0;
          --sidebar:282px;
        }
        html { height:100%; }
        body { height:100%; background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; overflow:hidden; }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
        @keyframes reveal { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradFlow { 0%{background-position:0%} 100%{background-position:200%} }

        .app { display:flex; height:100vh; }

        /* ── SIDEBAR ── */
        .sidebar { width:var(--sidebar); min-width:var(--sidebar); background:var(--panel); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow-y:auto; scrollbar-width:none; flex-shrink:0; z-index:10; }
        .sidebar::-webkit-scrollbar { display:none; }

        .sidebar-brand { padding:20px 18px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .brand-logo { width:30px; height:30px; object-fit:contain; border-radius:8px; filter:drop-shadow(0 0 8px rgba(0,212,255,0.4)); }
        .brand-name { font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:3px; background:linear-gradient(135deg,#00d4ff,#8b5cf6,#ff2d78); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:gradFlow 4s linear infinite; }
        .brand-v { font-size:9px; background:linear-gradient(135deg,#00d4ff,#8b5cf6); color:#fff; padding:2px 6px; border-radius:4px; font-weight:700; letter-spacing:1px; margin-left:auto; }

        .credits-bar { margin:12px 12px 0; background:var(--card); border:1px solid rgba(0,212,255,0.12); border-radius:12px; padding:12px 14px; flex-shrink:0; }
        .credits-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
        .credits-label { font-size:10px; color:var(--muted2); font-weight:500; letter-spacing:.5px; text-transform:uppercase; }
        .credits-count { font-family:'Space Mono',monospace; font-size:12px; color:var(--cyan); font-weight:700; }
        .credits-track { height:4px; background:var(--border2); border-radius:4px; overflow:hidden; }
        .credits-fill { height:100%; background:linear-gradient(90deg,var(--cyan),var(--purple)); border-radius:4px; transition:width .4s ease; }

        .nav-section { padding:14px 10px 8px; }
        .nav-label { font-size:9px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:var(--muted); padding:0 8px; margin-bottom:6px; }
        .nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px; cursor:pointer; transition:all .18s; user-select:none; margin-bottom:2px; border:1px solid transparent; }
        .nav-item:hover { background:var(--card); border-color:var(--border); }
        .nav-item.active { background:rgba(0,212,255,0.06); border-color:rgba(0,212,255,0.18); }
        .nav-icon { font-size:15px; color:var(--muted2); flex-shrink:0; width:20px; text-align:center; transition:color .18s; }
        .nav-item.active .nav-icon { color:var(--cyan); }
        .nav-lbl { font-size:13px; font-weight:500; color:var(--muted2); transition:color .18s; flex:1; }
        .nav-item.active .nav-lbl { color:var(--text); }
        .nav-cr { font-size:10px; background:var(--card2); color:var(--muted2); padding:2px 7px; border-radius:20px; border:1px solid var(--border2); flex-shrink:0; }
        .nav-item.active .nav-cr { background:var(--cyan-dim); color:var(--cyan); border-color:rgba(0,212,255,0.3); }

        .sidebar-views { padding:8px 10px; border-top:1px solid var(--border); margin-top:auto; }
        .view-btn { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px; cursor:pointer; transition:all .18s; margin-bottom:2px; border:1px solid transparent; }
        .view-btn:hover { background:var(--card); border-color:var(--border); }
        .view-btn.active { background:var(--card2); border-color:var(--border2); }
        .view-icon { font-size:14px; width:20px; text-align:center; color:var(--muted2); }
        .view-lbl { font-size:13px; font-weight:500; color:var(--muted2); }
        .view-btn.active .view-lbl,.view-btn.active .view-icon { color:var(--text); }

        /* upgrade card */
        .upgrade-card { margin:10px 12px; background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(255,45,120,0.05)); border:1px solid rgba(139,92,246,0.2); border-radius:12px; padding:12px 14px; cursor:pointer; transition:all .2s; }
        .upgrade-card:hover { background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(255,45,120,0.1)); border-color:rgba(139,92,246,0.4); transform:translateY(-1px); }
        .upgrade-title { font-size:12px; font-weight:600; color:#fff; }
        .upgrade-sub { font-size:10px; color:var(--muted2); margin-top:2px; }
        .upgrade-plans { display:flex; gap:5px; margin-top:8px; }
        .uplan { font-size:9px; padding:2px 7px; border-radius:100px; font-weight:600; letter-spacing:.3px; }
        .up-cyan { background:var(--cyan-dim); color:var(--cyan); border:1px solid rgba(0,212,255,0.2); }
        .up-purple { background:var(--purple-dim); color:var(--purple); border:1px solid rgba(139,92,246,0.2); }
        .up-pink { background:var(--pink-dim); color:var(--pink); border:1px solid rgba(255,45,120,0.2); }

        .sidebar-user { padding:12px 14px; border-top:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .user-avatar { width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid rgba(0,212,255,0.3); flex-shrink:0; }
        .user-name { font-size:12px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-plan { font-size:10px; color:var(--cyan); font-weight:500; }
        .logout-btn { background:none; border:1px solid var(--border2); border-radius:7px; color:var(--muted2); font-size:11px; padding:4px 9px; cursor:pointer; transition:all .18s; }
        .logout-btn:hover { border-color:var(--red); color:var(--red); }

        /* ── MAIN ── */
        .main { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
        .main-topbar { padding:14px 26px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; background:rgba(7,7,15,0.8); backdrop-filter:blur(10px); }
        .topbar-title { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:3px; color:var(--text); }
        .topbar-desc { font-size:11px; color:var(--muted2); margin-top:1px; }
        .topbar-right { display:flex; align-items:center; gap:10px; }
        .topbar-badge { font-size:11px; color:var(--muted2); background:var(--card); border:1px solid var(--border2); padding:5px 13px; border-radius:100px; }
        .status-dot { width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 8px var(--green); animation:blink 2s infinite; }
        .status-dot.busy { background:var(--cyan); box-shadow:0 0 8px var(--cyan-glow); animation:blink .7s infinite; }

        .progress-bar { height:2px; background:var(--border); flex-shrink:0; }
        .progress-fill-bar { height:100%; background:linear-gradient(90deg,var(--cyan),var(--purple),var(--pink)); transition:width .3s ease; box-shadow:0 0 8px var(--cyan-glow); }

        /* ── WORKSPACE ── */
        .workspace { flex:1; display:flex; overflow:hidden; }
        .controls { width:310px; min-width:310px; border-right:1px solid var(--border); overflow-y:auto; scrollbar-width:none; padding:18px 16px; display:flex; flex-direction:column; gap:16px; }
        .controls::-webkit-scrollbar { display:none; }
        .ctrl-section { display:flex; flex-direction:column; gap:8px; }
        .ctrl-lbl { font-size:9.5px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:var(--muted); }

        textarea { width:100%; background:var(--card); border:1.5px solid var(--border2); border-radius:12px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:300; line-height:1.7; padding:12px 13px 32px; outline:none; transition:border-color .2s,box-shadow .2s; resize:none; min-height:100px; }
        textarea::placeholder { color:var(--muted); }
        textarea:focus { border-color:var(--cyan); box-shadow:0 0 0 3px rgba(0,212,255,0.08); }
        .prompt-wrap { position:relative; }
        .char-count { position:absolute; bottom:10px; right:12px; font-size:10px; color:var(--muted); font-family:'Space Mono',monospace; }

        .upload-drop-zone { border:2px dashed rgba(0,212,255,0.2); border-radius:14px; padding:30px 20px; text-align:center; cursor:pointer; transition:all .2s; background:rgba(0,212,255,0.02); display:flex; flex-direction:column; align-items:center; gap:8px; }
        .upload-drop-zone:hover { border-color:var(--cyan); background:var(--cyan-dim); transform:translateY(-1px); }
        .upload-drop-icon { width:46px; height:46px; border-radius:50%; background:var(--cyan-dim); border:1.5px solid rgba(0,212,255,0.25); display:flex; align-items:center; justify-content:center; font-size:20px; color:var(--cyan); }
        .upload-drop-title { font-size:13px; font-weight:600; color:var(--text); }
        .upload-drop-sub { font-size:11px; color:var(--muted2); }
        .upload-preview-wrap { border-radius:12px; overflow:hidden; border:1.5px solid var(--border2); }
        .upload-preview-img { width:100%; display:block; max-height:200px; object-fit:cover; }
        .upload-preview-bar { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--card2); }
        .upload-preview-name { font-size:11px; color:var(--muted2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
        .upload-clear-btn { background:none; border:1px solid rgba(231,76,60,.3); border-radius:6px; color:var(--red); font-size:11px; padding:3px 8px; cursor:pointer; transition:all .18s; font-family:'DM Sans',sans-serif; }
        .upload-clear-btn:hover { background:rgba(231,76,60,.1); }

        .style-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .style-pill { background:var(--card); border:1.5px solid var(--border); border-radius:9px; padding:7px 10px; cursor:pointer; transition:all .18s; font-size:11.5px; font-weight:500; color:var(--muted2); text-align:center; user-select:none; }
        .style-pill:hover { border-color:var(--border2); color:var(--text); }
        .style-pill.active { border-color:var(--cyan); background:var(--cyan-dim); color:var(--cyan); }

        .gen-btn { width:100%; padding:14px; background:linear-gradient(135deg,var(--cyan),var(--purple)); border:none; border-radius:13px; color:#fff; font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:2px; cursor:pointer; transition:all .2s; position:relative; overflow:hidden; box-shadow:0 6px 24px rgba(0,212,255,0.25); display:flex; align-items:center; justify-content:center; gap:8px; }
        .gen-btn::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,var(--purple),var(--pink)); opacity:0; transition:opacity .3s; }
        .gen-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 10px 32px rgba(0,212,255,0.35); }
        .gen-btn:hover::before { opacity:1; }
        .gen-btn:disabled { opacity:.35; cursor:not-allowed; transform:none; }
        .gen-btn span,.gen-btn div { position:relative; z-index:1; }
        .gen-btn-credits { font-family:'Space Mono',monospace; font-size:11px; background:rgba(0,0,0,0.25); padding:3px 8px; border-radius:6px; }

        /* ── CANVAS ── */
        .canvas { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:28px; gap:16px; overflow-y:auto; scrollbar-width:none; background:radial-gradient(ellipse at center,rgba(0,212,255,0.02) 0%,transparent 70%); }
        .canvas::-webkit-scrollbar { display:none; }
        .empty-state { display:flex; flex-direction:column; align-items:center; gap:12px; animation:fadeUp .5s ease both; text-align:center; opacity:.3; }
        .empty-icon { font-size:56px; line-height:1; }
        .empty-title { font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:4px; color:var(--muted2); }
        .empty-sub { font-size:12px; color:var(--muted); }

        .loading-card { width:100%; max-width:520px; aspect-ratio:1/1; border-radius:20px; background:var(--card); border:1px solid rgba(0,212,255,0.1); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; position:relative; overflow:hidden; }
        .loading-card::after { content:''; position:absolute; inset:0; background:linear-gradient(105deg,transparent 30%,rgba(0,212,255,0.03) 50%,transparent 70%); animation:shimmer 2s infinite; }
        .spinner { width:36px; height:36px; border:2.5px solid rgba(0,212,255,0.1); border-top-color:var(--cyan); border-radius:50%; animation:spin .8s linear infinite; }
        .loading-label { font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:3px; color:var(--cyan); text-shadow:0 0 20px var(--cyan-glow); z-index:1; }
        .loading-sub-text { font-size:11px; color:var(--muted2); z-index:1; }

        .result-frame { width:100%; max-width:520px; border-radius:20px; overflow:hidden; border:1px solid rgba(0,212,255,0.15); box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 0 1px rgba(139,92,246,0.1); animation:reveal .4s ease both; position:relative; cursor:pointer; }
        .result-frame img { display:block; width:100%; height:auto; }
        .result-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 50%); opacity:0; transition:opacity .25s; display:flex; align-items:flex-end; padding:16px; gap:8px; }
        .result-frame:hover .result-overlay { opacity:1; }
        .overlay-btn { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px; color:white; font-size:11.5px; font-weight:500; padding:7px 14px; cursor:pointer; backdrop-filter:blur(10px); transition:all .18s; font-family:'DM Sans',sans-serif; }
        .overlay-btn:hover { background:var(--cyan); color:#000; border-color:var(--cyan); }

        .audio-player { width:100%; max-width:520px; background:var(--card); border:1px solid rgba(139,92,246,0.2); border-radius:16px; padding:20px; animation:reveal .4s ease both; }
        .audio-label { font-family:'Bebas Neue',sans-serif; font-size:16px; letter-spacing:2px; color:var(--purple); }
        .result-caption { max-width:520px; font-size:12px; color:var(--muted2); font-style:italic; text-align:center; line-height:1.5; }
        .error-box { background:rgba(231,76,60,.06); border:1px solid rgba(231,76,60,.2); border-radius:12px; padding:14px 18px; font-size:13px; color:var(--red); max-width:500px; text-align:center; animation:fadeUp .3s ease both; }

        /* ── HISTORY ── */
        .history-view { flex:1; overflow-y:auto; padding:24px 28px; scrollbar-width:none; }
        .history-view::-webkit-scrollbar { display:none; }
        .history-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; }
        .history-card { background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; cursor:pointer; transition:all .2s; }
        .history-card:hover { border-color:var(--cyan); transform:translateY(-2px); box-shadow:0 10px 30px rgba(0,0,0,.4); }
        .history-img { width:100%; aspect-ratio:1/1; object-fit:cover; display:block; }
        .history-info { padding:10px 12px; }
        .history-tool { font-size:9px; color:var(--cyan); font-weight:600; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:3px; }
        .history-prompt { font-size:11.5px; color:var(--muted2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* ── PROFILE ── */
        .profile-view { flex:1; overflow-y:auto; padding:32px 40px; scrollbar-width:none; }
        .profile-view::-webkit-scrollbar { display:none; }
        .profile-card { background:var(--card); border:1px solid rgba(0,212,255,0.1); border-radius:20px; padding:28px; max-width:560px; display:flex; flex-direction:column; gap:20px; }
        .profile-header { display:flex; align-items:center; gap:16px; }
        .profile-avatar { width:64px; height:64px; border-radius:50%; border:3px solid var(--cyan); object-fit:cover; box-shadow:0 0 20px rgba(0,212,255,0.3); }
        .profile-name { font-family:'Bebas Neue',sans-serif; font-size:24px; letter-spacing:2px; }
        .profile-email { font-size:13px; color:var(--muted2); }
        .profile-plan { display:inline-block; background:var(--cyan-dim); color:var(--cyan); border:1px solid rgba(0,212,255,0.25); border-radius:6px; padding:3px 10px; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-top:4px; }
        .stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .stat-card { background:var(--card2); border:1px solid var(--border); border-radius:12px; padding:14px 16px; }
        .stat-value { font-family:'Space Mono',monospace; font-size:24px; color:var(--cyan); font-weight:700; }
        .stat-label { font-size:11px; color:var(--muted2); margin-top:3px; }
        .upgrade-btn { width:100%; padding:14px; background:linear-gradient(135deg,var(--cyan),var(--purple),var(--pink)); background-size:200% auto; border:none; border-radius:12px; color:#fff; font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:2px; cursor:pointer; transition:all .3s; box-shadow:0 6px 24px rgba(0,212,255,0.25); animation:gradFlow 4s linear infinite; }
        .upgrade-btn:hover { transform:translateY(-1px); box-shadow:0 10px 32px rgba(139,92,246,0.4); }

        /* ── TOAST ── */
        .toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); padding:11px 22px; border-radius:100px; font-size:13px; font-weight:500; z-index:9999; animation:toastIn .3s ease both; white-space:nowrap; box-shadow:0 8px 32px rgba(0,0,0,.5); }
        .toast-success { background:var(--green); color:#000; }
        .toast-error { background:var(--red); color:#fff; }
        .toast-info { background:var(--card2); color:var(--text); border:1px solid var(--border2); }

        /* ── MOBILE ── */
        .mobile-topbar { display:none; }
        .mobile-overlay { display:none; }
        @media(max-width:900px) { :root { --sidebar:250px; } .controls { width:270px; min-width:270px; } }
        @media(max-width:767px) {
          .app { position:relative; }
          .sidebar { position:fixed; top:0; left:0; bottom:0; z-index:100; transform:translateX(-100%); transition:transform .3s ease; width:280px; min-width:280px; }
          .sidebar.open { transform:translateX(0); }
          .mobile-overlay { display:block; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:99; backdrop-filter:blur(3px); }
          .mobile-topbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); background:var(--panel); flex-shrink:0; }
          .hamburger { background:none; border:1px solid var(--border2); border-radius:8px; color:var(--text); font-size:18px; padding:6px 10px; cursor:pointer; }
          .main-topbar { display:none; }
          .workspace { flex-direction:column; overflow-y:auto; }
          .controls { width:100%; min-width:unset; border-right:none; border-bottom:1px solid var(--border); overflow-y:visible; padding:16px; }
          .canvas { padding:16px; justify-content:flex-start; min-height:400px; }
          .history-view,.profile-view { padding:16px; }
        }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app">
        <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
          <div className="sidebar-brand">
            <img src="/logo192.png" alt="RP Vision AI" className="brand-logo" />
            <span className="brand-name">RP VISION AI</span>
            <span className="brand-v">V2</span>
          </div>

          <div className="credits-bar">
            <div className="credits-row">
              <span className="credits-label">Daily Credits</span>
              <span className="credits-count">{creditsLeft} / {FREE_CREDITS_PER_DAY}</span>
            </div>
            <div className="credits-track">
              <div className="credits-fill" style={{ width:(creditsLeft/FREE_CREDITS_PER_DAY*100)+"%" }} />
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-label">AI Tools</div>
            {TOOLS.map(t => (
              <div key={t.id} className={"nav-item"+(activeTool.id===t.id&&view==="create"?" active":"")}
                onClick={() => { setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-lbl">{t.label}</span>
                <span className="nav-cr">{t.credits}cr</span>
              </div>
            ))}
          </div>

          <div className="sidebar-views">
            <div className={"view-btn"+(view==="history"?" active":"")} onClick={() => { setView("history"); setSidebarOpen(false); }}>
              <span className="view-icon">◫</span><span className="view-lbl">History</span>
            </div>
            <div className={"view-btn"+(view==="profile"?" active":"")} onClick={() => { setView("profile"); setSidebarOpen(false); }}>
              <span className="view-icon">◯</span><span className="view-lbl">Profile</span>
            </div>
          </div>

          <div className="upgrade-card" onClick={() => showToast("Razorpay payments coming soon! 🚀","info")}>
            <div className="upgrade-title">⬡ Upgrade to Pro</div>
            <div className="upgrade-sub">Get more credits & unlock all features</div>
            <div className="upgrade-plans">
              <span className="uplan up-cyan">₹99/mo</span>
              <span className="uplan up-purple">₹299/mo</span>
              <span className="uplan up-pink">₹599/mo</span>
            </div>
          </div>

          <div className="sidebar-user">
            <img className="user-avatar" src={user.photoURL} alt="" />
            <div style={{ flex:1, minWidth:0 }}>
              <div className="user-name">{user.displayName}</div>
              <div className="user-plan">FREE PLAN</div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Out</button>
          </div>
        </aside>

        <main className="main">
          <div className="mobile-topbar">
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:3, background:"linear-gradient(135deg,#00d4ff,#8b5cf6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>RP VISION AI</span>
            <span style={{ fontSize:11, color:"var(--muted2)" }}>{creditsLeft}cr left</span>
          </div>

          <div className="main-topbar">
            <div>
              <div className="topbar-title">{activeTool.label}</div>
              <div className="topbar-desc">{activeTool.desc}</div>
            </div>
            <div className="topbar-right">
              <div className={"status-dot"+(loading?" busy":"")} />
              {view==="history" && <span className="topbar-badge">{history.length} items</span>}
              {view==="create"  && <span className="topbar-badge">{creditsLeft} credits left</span>}
            </div>
          </div>

          <div className="progress-bar">
            <div className="progress-fill-bar" style={{ width:progress+"%" }} />
          </div>

          {view==="create" && (
            <div className="workspace">
              <div className="controls">
                {!["upscale","remove-bg"].includes(activeTool.id) && (
                  <div className="ctrl-section">
                    <div className="ctrl-lbl">Prompt</div>
                    <div className="prompt-wrap">
                      <textarea value={prompt} onChange={e => setPrompt(e.target.value.slice(0,500))}
                        placeholder={activeTool.id==="text-to-audio"?"Describe the sound or speech..." : activeTool.id==="image-to-video"?"Describe the animation..." : "Describe what you want to create..."} rows={4} />
                      <span className="char-count">{prompt.length}/500</span>
                    </div>
                  </div>
                )}

                {needsImageInput && (
                  <div className="ctrl-section">
                    <div className="ctrl-lbl">Upload Image</div>
                    <ImageUploader file={inputFile} previewUrl={inputPreviewUrl} onFileChange={handleFileChange} onClear={handleFileClear} />
                  </div>
                )}

                {["text-to-image","image-to-image"].includes(activeTool.id) && (
                  <div className="ctrl-section">
                    <div className="ctrl-lbl">Art Style</div>
                    <div className="style-grid">
                      {STYLES.map((s,i) => (
                        <div key={i} className={"style-pill"+(style===i?" active":"")} onClick={() => setStyle(style===i?null:i)}>{s.label}</div>
                      ))}
                    </div>
                  </div>
                )}

                <button className="gen-btn" disabled={loading||creditsLeft<activeTool.credits} onClick={generate}>
                  {loading ? <><div className="spinner" style={{width:20,height:20,borderWidth:2}} />&nbsp;<span>Generating...</span></> : <><span>{activeTool.icon} Generate</span><span className="gen-btn-credits">{activeTool.credits} cr</span></>}
                </button>

                {creditsLeft < activeTool.credits && !loading && (
                  <div style={{ fontSize:11, color:"var(--red)", textAlign:"center" }}>Not enough credits. Resets at midnight.</div>
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
                {result && !loading && (<>
                  {result.type==="image" && (
                    <div className="result-frame">
                      <img src={result.url} alt="Generated" />
                      <div className="result-overlay">
                        <button className="overlay-btn" onClick={() => download(result.url)}>↓ Download</button>
                        <button className="overlay-btn" onClick={() => setResult(null)}>✕ Clear</button>
                        <button className="overlay-btn" onClick={generate}>↻ Redo</button>
                      </div>
                    </div>
                  )}
                  {result.type==="audio" && (
                    <div className="audio-player">
                      <div className="audio-label">◎ TEXT TO SPEECH</div>
                      <div style={{ fontSize:13, color:"var(--muted2)", marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>"{result.text}"</div>
                      <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
                        <button className="overlay-btn" style={{ background:"var(--purple-dim)", borderColor:"rgba(139,92,246,0.3)", color:"var(--purple)" }} onClick={() => {
                          window.speechSynthesis.cancel();
                          const u = new SpeechSynthesisUtterance(result.text);
                          u.rate=0.9; u.pitch=1; u.volume=1;
                          const v = window.speechSynthesis.getVoices().find(v=>v.lang.startsWith("en")&&v.name.includes("Google"))||window.speechSynthesis.getVoices().find(v=>v.lang.startsWith("en"));
                          if(v) u.voice=v;
                          window.speechSynthesis.speak(u);
                        }}>▶ Play Again</button>
                        <button className="overlay-btn" onClick={() => window.speechSynthesis.cancel()}>⏹ Stop</button>
                      </div>
                      <div style={{ fontSize:11, color:"var(--muted)", marginTop:10 }}>💡 Uses browser built-in speech engine</div>
                    </div>
                  )}
                  {prompt && <div className="result-caption">"{prompt}"</div>}
                </>)}
              </div>
            </div>
          )}

          {view==="history" && (
            <div className="history-view">
              <div style={{ marginBottom:20 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:3 }}>Generation History</div>
                <div style={{ fontSize:12, color:"var(--muted2)", marginTop:3 }}>Your last 20 generations</div>
              </div>
              {historyLoading ? <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spinner /></div>
              : history.length===0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:60, opacity:.3, textAlign:"center" }}>
                  <div style={{ fontSize:44 }}>◫</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, color:"var(--muted2)" }}>NO HISTORY YET</div>
                  <div style={{ fontSize:12, color:"var(--muted)" }}>Generate something to see it here</div>
                </div>
              ) : (
                <div className="history-grid">
                  {history.map(h => (
                    <div key={h.id} className="history-card" onClick={() => { setResult({ type:"image", url:h.outputUrl }); setActiveTool(TOOLS.find(t=>t.id===h.toolId)||TOOLS[0]); setView("create"); }}>
                      <img className="history-img" src={h.outputUrl} alt="" onError={e=>e.target.style.display="none"} />
                      <div className="history-info">
                        <div className="history-tool">{h.toolId?.replace(/-/g," ")}</div>
                        <div className="history-prompt">{h.prompt||"No prompt"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view==="profile" && (
            <div className="profile-view">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:3 }}>My Profile</div>
                <div style={{ fontSize:12, color:"var(--muted2)", marginTop:3 }}>Manage your account</div>
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
                  <div className="stat-card"><div className="stat-value">{creditsLeft}</div><div className="stat-label">Credits Left Today</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color:"var(--purple)" }}>{creditsUsed}</div><div className="stat-label">Credits Used Today</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color:"var(--pink)" }}>{FREE_CREDITS_PER_DAY}</div><div className="stat-label">Daily Free Credits</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color:"var(--green)" }}>7</div><div className="stat-label">AI Tools Available</div></div>
                </div>
                <button className="upgrade-btn" onClick={() => showToast("Razorpay payments coming soon! 🚀","info")}>
                  ⬡ UPGRADE TO PRO — COMING SOON
                </button>
                <button style={{ background:"none", border:"1px solid rgba(231,76,60,.25)", borderRadius:10, color:"var(--red)", padding:10, cursor:"pointer", fontSize:13, fontWeight:500 }} onClick={handleLogout}>Sign Out</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
