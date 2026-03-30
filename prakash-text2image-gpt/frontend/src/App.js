/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useCallback, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, query, where, orderBy, limit, getDocs, deleteDoc, serverTimestamp
} from "firebase/firestore";

const BACKEND = "https://rp-vision-backend.onrender.com";
const RAZORPAY_KEY_ID = "rzp_live_SUFBH3FrVkhnDX";

const PLANS = [
  {
    id: "starter", name: "Starter", price: 99, credits: 500,
    color: "var(--cyan)", dim: "var(--cyan-dim)", border: "rgba(0,212,255,0.3)",
    tag: null,
    features: ["500 credits/month", "All 7 AI tools", "HD image quality", "Email support"],
  },
  {
    id: "pro", name: "Pro", price: 299, credits: 2000,
    color: "var(--purple)", dim: "var(--purple-dim)", border: "rgba(139,92,246,0.3)",
    tag: "MOST POPULAR",
    features: ["2000 credits/month", "All 7 AI tools", "4K image quality", "Priority support"],
  },
  {
    id: "unlimited", name: "Unlimited", price: 599, credits: 99999,
    color: "var(--pink)", dim: "var(--pink-dim)", border: "rgba(255,45,120,0.3)",
    tag: "BEST VALUE",
    features: ["Unlimited credits", "All 7 AI tools", "4K image quality", "24/7 support"],
  },
];

const TOOLS = [
  { id: "text-to-image", label: "Text to Image", icon: "⬡", credits: 1, desc: "Generate images from text prompts" },
  { id: "image-to-image", label: "Image to Image", icon: "⬢", credits: 2, desc: "Transform images with AI" },
  { id: "text-to-video", label: "Text to Video", icon: "◈", credits: 5, desc: "Generate cinematic video frames" },
  { id: "image-to-video", label: "Image to Video", icon: "◉", credits: 5, desc: "Animate any image with AI" },
  { id: "text-to-audio", label: "Text to Audio", icon: "◎", credits: 3, desc: "Generate speech from text" },
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

const CHAT_MODELS = [
  { value: "claude", label: "Claude Sonnet 4.6", icon: "🌟" },
  { value: "claude-fast", label: "Claude Haiku (Fast)", icon: "⚡" },
  { value: "gemini", label: "Gemini 3 Flash", icon: "🔥" },
  { value: "gemini-fast", label: "Gemini 2.5 Lite", icon: "⚡" },
];

const FREE_CREDITS_PER_DAY = 10;
const CLOUDINARY_CLOUD = "dt6dp806u";
const CLOUDINARY_PRESET = "RPVISIONAI";

function todayKey() { return new Date().toISOString().split("T")[0]; }

// ================== HELPER FUNCTIONS ==================
async function getOrCreateUser(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL, plan: "free", planCredits: 0, createdAt: serverTimestamp(), credits: { date: todayKey(), used: 0 } });
    return { plan: "free", planCredits: 0, credits: { date: todayKey(), used: 0 } };
  }
  return snap.data();
}

async function checkAndDeductCredits(uid, cost, plan) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const today = todayKey();
  if (plan !== "free" && plan !== undefined) {
    if (plan === "unlimited") return true;
    const pc = data.planCredits || 0;
    if (pc < cost) return false;
    await updateDoc(ref, { planCredits: pc - cost });
    return true;
  }
  let used = data.credits?.date === today ? data.credits.used : 0;
  if (used + cost > FREE_CREDITS_PER_DAY) return false;
  await updateDoc(ref, { credits: { date: today, used: used + cost } });
  return true;
}

async function uploadToCloudinary(blob) {
  try {
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    fd.append("folder", "rp-vision-ai");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: fd });
    const data = await res.json();
    return data.secure_url || null;
  } catch (err) {
    console.error("Cloudinary error:", err);
    return null;
  }
}

async function saveToHistory(uid, toolId, outputUrl, prompt) {
  try {
    await addDoc(collection(db, "history"), { uid, toolId, outputUrl, prompt, createdAt: serverTimestamp() });
  } catch (err) { console.error("saveToHistory error:", err); }
}

async function fetchHistory(uid) {
  try {
    const q = query(collection(db, "history"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("fetchHistory error:", err);
    return [];
  }
}

async function deleteHistoryItem(docId) {
  try {
    await deleteDoc(doc(db, "history", docId));
    return true;
  } catch (err) {
    console.error("Delete error:", err);
    return false;
  }
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function initiatePayment(plan, user, onSuccess, onError) {
  const loaded = await loadRazorpayScript();
  if (!loaded) return onError("Failed to load payment gateway.");
  try {
    const res = await fetch(`${BACKEND}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: plan.price * 100, currency: "INR", planId: plan.id }),
    });
    const order = await res.json();
    if (!order.id) throw new Error("Order creation failed");

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: plan.price * 100,
      currency: "INR",
      name: "RP Vision AI",
      description: `${plan.name} Plan — ${plan.credits === 99999 ? "Unlimited" : plan.credits} credits`,
      image: "/logo192.png",
      order_id: order.id,
      prefill: { name: user.displayName, email: user.email },
      theme: { color: "#8b5cf6" },
      handler: async (response) => {
        try {
          const vRes = await fetch(`${BACKEND}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, planId: plan.id, uid: user.uid }),
          });
          const vData = await vRes.json();
          if (vData.success) {
            await updateDoc(doc(db, "users", user.uid), {
              plan: plan.id,
              planCredits: plan.credits === 99999 ? 99999 : plan.credits,
            });
            onSuccess(plan);
          } else onError("Payment verification failed.");
        } catch (e) { onError("Verification error: " + e.message); }
      },
    };
    new window.Razorpay(options).open();
  } catch (err) {
    onError("Payment error: " + err.message);
  }
}

function Spinner() { return <div className="spinner" />; }
function Toast({ msg, type }) { return msg ? <div className={`toast toast-${type}`}>{msg}</div> : null; }

function ImageUploader({ file, previewUrl, onFileChange, onClear }) {
  const inputRef = useRef(null);
  const handleDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) onFileChange(f); };
  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) onFileChange(e.target.files[0]); }} />
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

// Keep your UpgradeModal and LoginScreen here (paste your original versions if they are different)
function UpgradeModal({ user, onClose, onSuccess, showToast }) {
  const [paying, setPaying] = useState(null);
  const handlePay = async (plan) => {
    setPaying(plan.id);
    await initiatePayment(plan, user, (p) => { onSuccess(p); showToast(`🎉 ${p.name} plan activated!`, "success"); onClose(); }, (err) => { showToast(err, "error"); setPaying(null); });
    setPaying(null);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-header">
          <div className="modal-title">UPGRADE YOUR PLAN</div>
          <div className="modal-sub">Choose the plan that fits your needs</div>
        </div>
        <div className="modal-plans">
          {PLANS.map(plan => (
            <div key={plan.id} className={"modal-plan" + (plan.tag === "MOST POPULAR" ? " modal-plan-popular" : "")} style={{ "--pc": plan.color, "--pb": plan.border, "--pd": plan.dim }}>
              {plan.tag && <div className="plan-tag" style={{ background: plan.color, color: plan.id === "pro" ? "#fff" : "#000" }}>{plan.tag}</div>}
              <div className="plan-name" style={{ color: plan.color }}>{plan.name}</div>
              <div className="plan-price">
                <span className="plan-rs">₹</span>
                <span className="plan-amount">{plan.price}</span>
                <span className="plan-period">/month</span>
              </div>
              <div className="plan-credits" style={{ color: plan.color }}>
                {plan.credits === 99999 ? "Unlimited" : plan.credits} credits
              </div>
              <div className="plan-features">
                {plan.features.map((f, i) => (
                  <div key={i} className="plan-feature">
                    <span style={{ color: plan.color }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button
                className="plan-btn"
                style={{ background: plan.color, color: plan.id === "unlimited" ? "#fff" : "#000" }}
                disabled={paying === plan.id}
                onClick={() => handlePay(plan)}
              >
                {paying === plan.id ? <span className="btn-spin" /> : `Pay ₹${plan.price}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);
  const handleLogin = async () => { setLoading(true); try { await onLogin(); } finally { setLoading(false); } };

  // Your canvas animation code can go here if needed
  useEffect(() => {
    // your original canvas code
  }, []);

  return (
    <>
      <style>{`
        /* Your full login screen CSS here */
      `}</style>
      <div className="login-root">
        <canvas ref={canvasRef} className="login-canvas" />
        <div className="login-page">
          <div className="login-left">
            <div className="logo-container">
              <div className="logo-glow-ring" /><div className="logo-glow-ring2" />
              <img src="/logo192.png" alt="RP Vision AI" className="logo-img" />
            </div>
            <div className="brand-title">RP VISION AI</div>
            <div className="brand-sub">Create Without Limits</div>
          </div>
          <div className="login-right">
            <div className="login-card">
              <div className="card-bg">
                <button className="google-btn" onClick={handleLogin} disabled={loading}>
                  {loading ? <div className="btn-spinner" /> : "Continue with Google"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ================== MAIN APP ==================
export default function App() {
  const [user, setUser] = useState(null);
  const [userPlan, setUserPlan] = useState("free");
  const [planCredits, setPlanCredits] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(null);
  const [inputFile, setInputFile] = useState(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState(null);
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
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Chat States
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChatModel, setSelectedChatModel] = useState("claude");
  const [chatLoading, setChatLoading] = useState(false);

  const progressRef = useRef(null);

  // Your existing useEffects, handleFileChange, generate, loadHistory, download, handleUpgradeSuccess etc. go here.
  // (Keep them exactly as in your original file)

  // NEW CHAT FUNCTIONS
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...chatMessages, userMsg], model: selectedChatModel })
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Chat service busy. Try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice input not supported", "error");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (e) => setChatInput(e.results[0][0].transcript);
    recognition.start();
  };

  if (authLoading) return <div>Loading RP Vision AI...</div>;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      {/* Your full <style> block with all CSS - paste your original style here */}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}
      {showUpgrade && <UpgradeModal user={user} onClose={() => setShowUpgrade(false)} onSuccess={(p) => { setUserPlan(p.id); setPlanCredits(p.credits); }} showToast={showToast} />}

      <div className="app">
        <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
          {/* Your original sidebar brand, credits, tools list */}

          <div className="nav-section">
            <div className="nav-label">AI Tools</div>
            {TOOLS.map(t => (
              <div key={t.id} className={"nav-item" + (activeTool.id === t.id && view === "create" ? " active" : "")}
                onClick={() => { setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-lbl">{t.label}</span>
                <span className="nav-cr">{t.credits}cr</span>
              </div>
            ))}
            {/* AI Chat Button */}
            <div className={"nav-item" + (view === "chat" ? " active" : "")} onClick={() => { setView("chat"); setSidebarOpen(false); }}>
              <span className="nav-icon">💬</span>
              <span className="nav-lbl">AI Chat Agent</span>
              <span className="nav-cr">Free</span>
            </div>
          </div>

          {/* Your original History and Profile buttons */}
        </aside>

        <main className="main">
          <div className="main-topbar">
            <div>
              <div className="topbar-title">{view === "chat" ? "💬 AI Chat Agent" : activeTool.label}</div>
              <div className="topbar-desc">{view === "chat" ? "Ask anything — Coding, Questions, News, Jokes..." : activeTool.desc}</div>
            </div>
            {view === "chat" && (
              <select value={selectedChatModel} onChange={(e) => setSelectedChatModel(e.target.value)}>
                {CHAT_MODELS.map(m => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
              </select>
            )}
          </div>

          <div className="progress-bar">
            <div className="progress-fill-bar" style={{ width: progress + "%" }} />
          </div>

          {/* Your original create view */}
          {view === "create" && (
            <div className="workspace">
              {/* PASTE YOUR ORIGINAL CONTROLS + CANVAS CODE HERE */}
            </div>
          )}

          {/* AI CHAT VIEW */}
          {view === "chat" && (
            <div className="workspace" style={{ flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflowY: "auto", background: "var(--card)", borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 20px", opacity: 0.7 }}>
                      <div style={{ fontSize: "60px" }}>💬</div>
                      <div style={{ fontSize: "20px", fontWeight: 600 }}>Free AI Chat Agent</div>
                      <div style={{ fontSize: "14px", color: "var(--muted2)" }}>Ask anything: Coding, News, Jokes...</div>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} style={{ marginBottom: "18px", textAlign: msg.role === "user" ? "right" : "left" }}>
                        <div style={{ display: "inline-block", maxWidth: "75%", padding: "13px 17px", borderRadius: "16px", background: msg.role === "user" ? "var(--cyan-dim)" : "var(--card2)" }}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && <div>Thinking...</div>}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && sendChatMessage()}
                    placeholder="Ask anything..."
                    style={{ flex: 1, padding: "14px 18px", borderRadius: "12px", background: "var(--card)" }}
                  />
                  <button onClick={startVoiceInput} style={{ padding: "14px", borderRadius: "12px", background: "#8b5cf6", color: "white" }}>🎤</button>
                  <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                    style={{ padding: "14px 24px", borderRadius: "12px", background: "linear-gradient(var(--cyan), var(--purple))", color: "white" }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Your original history and profile views */}
          {view === "history" && (/* your original history code */)}
          {view === "profile" && (/* your original profile code */)}
        </main>
      </div>
    </>
  );
}
