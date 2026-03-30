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
    id:"starter", name:"Starter", price:99, credits:500,
    color:"var(--cyan)", dim:"var(--cyan-dim)", border:"rgba(0,212,255,0.3)",
    tag:null,
    features:["500 credits/month","All 7 AI tools","HD image quality","Email support"],
  },
  {
    id:"pro", name:"Pro", price:299, credits:2000,
    color:"var(--purple)", dim:"var(--purple-dim)", border:"rgba(139,92,246,0.3)",
    tag:"MOST POPULAR",
    features:["2000 credits/month","All 7 AI tools","4K image quality","Priority support"],
  },
  {
    id:"unlimited", name:"Unlimited", price:599, credits:99999,
    color:"var(--pink)", dim:"var(--pink-dim)", border:"rgba(255,45,120,0.3)",
    tag:"BEST VALUE",
    features:["Unlimited credits","All 7 AI tools","4K image quality","24/7 support"],
  },
];

const TOOLS = [
  { id:"text-to-image", label:"Text to Image", icon:"⬡", credits:1, desc:"Generate images from text prompts" },
  { id:"image-to-image", label:"Image to Image", icon:"⬢", credits:2, desc:"Transform images with AI" },
  { id:"text-to-video", label:"Text to Video", icon:"◈", credits:5, desc:"Generate cinematic video frames" },
  { id:"image-to-video", label:"Image to Video", icon:"◉", credits:5, desc:"Animate any image with AI" },
  { id:"text-to-audio", label:"Text to Audio", icon:"◎", credits:3, desc:"Generate speech from text" },
  { id:"upscale", label:"Image Upscaler", icon:"◐", credits:2, desc:"Upscale images to HD quality" },
  { id:"remove-bg", label:"Remove Background", icon:"◑", credits:1, desc:"Remove image backgrounds instantly" },
];

const STYLES = [
  { label:"Photorealistic", tag:"photorealistic, 8k ultra detailed, RAW photo" },
  { label:"Cinematic", tag:"cinematic lighting, movie still, dramatic, anamorphic" },
  { label:"Anime", tag:"anime style, studio ghibli, vibrant, detailed illustration" },
  { label:"Oil Paint", tag:"oil painting, classical art, textured canvas, masterpiece" },
  { label:"Cyberpunk", tag:"cyberpunk, neon lights, futuristic, blade runner aesthetic" },
  { label:"Fantasy", tag:"fantasy art, magical, ethereal lighting, concept art" },
];

const CHAT_MODELS = [
  { value: "claude", label: "Claude Sonnet 4.6", icon: "🌟" },
  { value: "claude-fast", label: "Claude Haiku (Fast)", icon: "⚡" },
  { value: "gemini", label: "Gemini 3 Flash", icon: "🔥" },
  { value: "gemini-fast", label: "Gemini 2.5 Lite", icon: "⚡" },
];

const FREE_CREDITS_PER_DAY = 10;

function todayKey() { return new Date().toISOString().split("T")[0]; }

// Keep ALL your existing helper functions here exactly as they were in your original App.js
// (getOrCreateUser, checkAndDeductCredits, uploadToCloudinary, saveToHistory, fetchHistory, deleteHistoryItem, loadRazorpayScript, initiatePayment, etc.)

// ... Paste all your helper functions, ImageUploader, UpgradeModal, LoginScreen here ...

// ── MAIN APP ──────────────────────────────────────────────
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

  // New Chat States
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChatModel, setSelectedChatModel] = useState("claude");
  const [chatLoading, setChatLoading] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const progressRef = useRef(null);

  // Keep all your existing useEffects, handlers (generate, loadHistory, etc.) here...

  // NEW CHAT FUNCTIONS
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          model: selectedChatModel
        })
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, the chat service is busy. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice input not supported in your browser", "error");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    setIsVoiceListening(true);
    recognition.onresult = (e) => setChatInput(e.results[0][0].transcript);
    recognition.onerror = () => { setIsVoiceListening(false); showToast("Voice recognition failed", "error"); };
    recognition.onend = () => setIsVoiceListening(false);
    recognition.start();
  };

  // ... keep your existing generate, handleLogin, etc. functions ...

  if (authLoading) { /* your splash screen */ return ...; }
  if (!user) return <LoginScreen onLogin={handleLogin}/>;

  return (
    <>
      {/* Your full <style> tag with all CSS - keep exactly as before */}

      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {sidebarOpen && <div className="mobile-overlay" onClick={()=>setSidebarOpen(false)}/>}
      {showUpgrade && <UpgradeModal user={user} onClose={()=>setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} showToast={showToast}/>}

      <div className="app">
        <aside className={"sidebar"+(sidebarOpen?" open":"")}>
          {/* Sidebar brand, credits, AI Tools list + NEW CHAT BUTTON */}
          <div className="nav-section">
            <div className="nav-label">AI Tools</div>
            {TOOLS.map(t => (
              <div key={t.id} className={"nav-item"+(activeTool.id===t.id && view==="create"?" active":"")}
                onClick={()=>{ setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-lbl">{t.label}</span>
                <span className="nav-cr">{t.credits}cr</span>
              </div>
            ))}
            <div 
              className={"nav-item"+(view==="chat"?" active":"")}
              onClick={() => { setView("chat"); setSidebarOpen(false); }}
            >
              <span className="nav-icon">💬</span>
              <span className="nav-lbl">AI Chat Agent</span>
              <span className="nav-cr">Free</span>
            </div>
          </div>
          {/* History and Profile buttons remain the same */}
        </aside>

        <main className="main">
          {/* Mobile topbar and main-topbar (updated for chat) */}
          <div className="main-topbar">
            <div>
              <div className="topbar-title">
                {view === "chat" ? "💬 AI Chat Agent" : activeTool.label}
              </div>
              <div className="topbar-desc">
                {view === "chat" ? "Ask anything — Coding, Questions, News, Jokes..." : activeTool.desc}
              </div>
            </div>
            {view === "chat" && (
              <select 
                value={selectedChatModel} 
                onChange={(e) => setSelectedChatModel(e.target.value)}
                style={{padding:"8px 12px", borderRadius:"8px", background:"var(--card)", border:"1px solid var(--border)", color:"var(--text)"}}
              >
                {CHAT_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                ))}
              </select>
            )}
          </div>

          <div className="progress-bar">
            <div className="progress-fill-bar" style={{width:progress+"%"}}/>
          </div>

          {/* === CREATE VIEW (your original 7 tools) === */}
          {view === "create" && (
            <div className="workspace">
              {/* PASTE YOUR ENTIRE ORIGINAL WORKSPACE CODE HERE (controls + canvas) */}
              {/* From <div className="controls"> ... to the end of canvas */}
              {/* Make sure this section is exactly as in your working version */}
            </div>
          )}

          {/* === AI CHAT VIEW === */}
          {view === "chat" && (
            <div className="workspace" style={{flexDirection: "column", overflow: "hidden"}}>
              <div style={{flex: 1, display: "flex", flexDirection: "column", padding: "20px", overflow: "hidden"}}>
                <div style={{
                  flex: 1, 
                  overflowY: "auto", 
                  padding: "20px", 
                  background: "var(--card)", 
                  borderRadius: "16px",
                  marginBottom: "16px"
                }}>
                  {chatMessages.length === 0 ? (
                    <div style={{textAlign:"center", padding:"80px 20px", opacity:0.7}}>
                      <div style={{fontSize:"60px", marginBottom:"20px"}}>💬</div>
                      <div style={{fontSize:"20px", fontWeight:600}}>Free AI Chat Agent</div>
                      <div style={{fontSize:"14px", color:"var(--muted2)", marginTop:"12px"}}>
                        Ask anything: Coding (HTML, CSS, JS, Python...), General Questions, News, Jokes...
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} style={{marginBottom: "18px", textAlign: msg.role === "user" ? "right" : "left"}}>
                        <div style={{
                          display:"inline-block",
                          maxWidth:"75%",
                          padding:"13px 17px",
                          borderRadius:"16px",
                          background: msg.role === "user" ? "var(--cyan-dim)" : "var(--card2)",
                          border: msg.role === "user" ? "1px solid var(--cyan)" : "1px solid var(--border)",
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && <div style={{padding:"12px", color:"var(--muted2)"}}>Thinking...</div>}
                </div>

                <div style={{display:"flex", gap:"10px"}}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && sendChatMessage()}
                    placeholder="Ask anything... (coding, jokes, news...)"
                    style={{
                      flex:1, padding:"14px 18px", borderRadius:"12px", 
                      background:"var(--card)", border:"1px solid var(--border2)", color:"var(--text)"
                    }}
                  />
                  <button 
                    onClick={startVoiceInput} 
                    style={{padding:"14px 18px", borderRadius:"12px", background:"var(--purple-dim)", border:"none", fontSize:"20px", cursor:"pointer"}}
                  >
                    🎤
                  </button>
                  <button 
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    style={{
                      padding:"14px 28px", borderRadius:"12px", 
                      background: "linear-gradient(135deg, var(--cyan), var(--purple))",
                      color:"#fff", border:"none", fontWeight:600, cursor: chatLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History and Profile views - keep exactly as in your original code */}
          {view==="history" && ( /* your original history code */ )}
          {view==="profile" && ( /* your original profile code */ )}
        </main>
      </div>
    </>
  );
}
