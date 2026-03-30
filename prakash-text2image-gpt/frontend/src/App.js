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

const PLANS = [ /* ... your existing PLANS array ... */ ];
const TOOLS = [ /* ... your existing TOOLS array ... */ ];

const STYLES = [ /* ... your existing STYLES array ... */ ];

const FREE_CREDITS_PER_DAY = 10;

const CHAT_MODELS = [
  { value: "claude", label: "Claude Sonnet 4.6", icon: "🌟" },
  { value: "claude-fast", label: "Claude Haiku (Fast)", icon: "⚡" },
  { value: "gemini", label: "Gemini 3 Flash", icon: "🔥" },
  { value: "gemini-fast", label: "Gemini 2.5 Lite", icon: "⚡" },
];

function todayKey() { return new Date().toISOString().split("T")[0]; }

// ... [Keep all your existing helper functions: getOrCreateUser, checkAndDeductCredits, uploadToCloudinary, saveToHistory, fetchHistory, deleteHistoryItem, loadRazorpayScript, initiatePayment ...] 
// (I didn't change them - they remain exactly as you had)

function Spinner() { return <div className="spinner" />; }
function Toast({ msg, type }) { return msg ? <div className={"toast toast-"+type}>{msg}</div> : null; }
function ImageUploader({ file, previewUrl, onFileChange, onClear }) { /* ... your existing ImageUploader ... */ }

// ... [Keep your UpgradeModal, LoginScreen exactly as they were] ...

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

  // ── NEW CHAT STATES ──
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChatModel, setSelectedChatModel] = useState("claude");
  const [chatLoading, setChatLoading] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const progressRef = useRef(null);

  // ... [Keep all your existing useEffect, handleFileChange, handleFileClear, handleLogin, handleLogout, startProgress, stopProgress, showToast, creditsLeft, generate function, loadHistory, download, handleUpgradeSuccess ...] ...

  // ── NEW: SEND CHAT MESSAGE ──
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    const currentInput = chatInput.trim();
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
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, the chat service is busy right now. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── NEW: VOICE INPUT ──
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

  // ... rest of your existing code (splash screen, login screen, etc.) ...

  return (
    <>
      {/* Keep your existing <style> tag and all CSS - no change needed */}

      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {sidebarOpen && <div className="mobile-overlay" onClick={()=>setSidebarOpen(false)}/>}
      {showUpgrade && <UpgradeModal user={user} onClose={()=>setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} showToast={showToast}/>}

      <div className="app">
        <aside className={"sidebar"+(sidebarOpen?" open":"")}>
          {/* ... your existing sidebar brand, credits, user ... */}

          <div className="nav-section">
            <div className="nav-label">AI Tools</div>
            {TOOLS.map(t => (
              <div key={t.id} className={"nav-item"+(activeTool.id===t.id && view==="create" ? " active" : "")}
                onClick={()=>{ setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-lbl">{t.label}</span>
                <span className="nav-cr">{t.credits}cr</span>
              </div>
            ))}

            {/* NEW AI CHAT BUTTON */}
            <div 
              className={"nav-item"+(view==="chat" ? " active" : "")}
              onClick={() => { 
                setView("chat"); 
                setSidebarOpen(false); 
              }}
            >
              <span className="nav-icon">💬</span>
              <span className="nav-lbl">AI Chat Agent</span>
              <span className="nav-cr">Free</span>
            </div>
          </div>

          {/* ... your existing sidebar-views (History, Profile) ... */}
        </aside>

        <main className="main">
          {/* Mobile topbar ... keep as is */}

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
            {/* ... existing credits badge ... */}
          </div>

          <div className="progress-bar">
            <div className="progress-fill-bar" style={{width:progress+"%"}}/>
          </div>

          {/* CREATE VIEW - Your Original Tools */}
          {view === "create" && (
            <div className="workspace">
              {/* Paste your entire existing workspace (controls + canvas) here - unchanged */}
              {/* I kept it exactly as you provided earlier */}
              {/* ... your controls, ImageUploader, style-grid, gen-btn, canvas, result etc. ... */}
            </div>
          )}

          {/* AI CHAT VIEW */}
          {view === "chat" && (
            <div className="workspace" style={{flexDirection: "column", overflow: "hidden"}}>
              <div style={{flex:1, display:"flex", flexDirection:"column", padding:"20px", overflow:"hidden"}}>
                <div style={{
                  flex:1, 
                  overflowY:"auto", 
                  padding:"20px", 
                  background:"var(--card)", 
                  borderRadius:"16px",
                  marginBottom:"16px"
                }}>
                  {chatMessages.length === 0 ? (
                    <div style={{textAlign:"center", padding:"80px 20px", opacity:0.7}}>
                      <div style={{fontSize:"60px", marginBottom:"20px"}}>💬</div>
                      <div style={{fontSize:"20px", fontWeight:600}}>Free AI Chat Agent</div>
                      <div style={{fontSize:"14px", color:"var(--muted2)", marginTop:"12px"}}>
                        Ask anything: Coding (HTML, CSS, JS, Python...), General Questions, News, Jokes, Ideas...
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
                  <button onClick={startVoiceInput} style={{padding:"14px 18px", borderRadius:"12px", background:"var(--purple-dim)", border:"none", fontSize:"20px", cursor:"pointer"}}>
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

          {/* Keep your existing History and Profile views unchanged */}
          {view==="history" && ( /* your history code */ )}
          {view==="profile" && ( /* your profile code */ )}
        </main>
      </div>
    </>
  );
}
