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

const PLANS = [ /* your PLANS array */ ];
const TOOLS = [ /* your TOOLS array */ ];
const STYLES = [ /* your STYLES array */ ];

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

// Keep all your helper functions (getOrCreateUser, checkAndDeductCredits, uploadToCloudinary, saveToHistory, fetchHistory, deleteHistoryItem, loadRazorpayScript, initiatePayment) exactly as they are in your file.

function Spinner() { return <div className="spinner" />; }
function Toast({ msg, type }) { return msg ? <div className={"toast toast-"+type}>{msg}</div> : null; }

function ImageUploader({ file, previewUrl, onFileChange, onClear }) {
  const inputRef = useRef(null);
  const handleDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f&&f.type.startsWith("image/")) onFileChange(f); };
  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFileChange(e.target.files[0]);}} />
      {!file ? (
        <div className="upload-drop-zone" onClick={()=>inputRef.current.click()} onDrop={handleDrop} onDragOver={e=>e.preventDefault()}>
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

// Keep your UpgradeModal and LoginScreen exactly as they are in your original file.

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

  // NEW CHAT STATES
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChatModel, setSelectedChatModel] = useState("claude");
  const [chatLoading, setChatLoading] = useState(false);

  const progressRef = useRef(null);

  // Keep all your existing useEffect, handleFileChange, generate, loadHistory, download, handleUpgradeSuccess etc.

  // NEW: Send Chat Message
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
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          model: selectedChatModel
        })
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Chat service is busy. Please try again." }]);
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
    recognition.onresult = (e) => setChatInput(e.results[0][0].transcript);
    recognition.start();
  };

  if (authLoading) return <div>Loading...</div>;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      {/* Your full <style> tag with all CSS - keep exactly as in your original file */}

      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {sidebarOpen && <div className="mobile-overlay" onClick={()=>setSidebarOpen(false)}/>}
      {showUpgrade && <UpgradeModal user={user} onClose={()=>setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} showToast={showToast}/>}

      <div className="app">
        <aside className={"sidebar"+(sidebarOpen?" open":"")}>
          {/* Your original sidebar brand, credits, nav-section for tools */}

          <div className="nav-section">
            <div className="nav-label">AI Tools</div>
            {TOOLS.map(t => (
              <div key={t.id} className={"nav-item"+(activeTool.id===t.id&&view==="create"?" active":"")}
                onClick={()=>{ setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-lbl">{t.label}</span>
                <span className="nav-cr">{t.credits}cr</span>
              </div>
            ))}
            {/* NEW AI CHAT BUTTON */}
            <div className={"nav-item"+(view==="chat"?" active":"")} onClick={() => { setView("chat"); setSidebarOpen(false); }}>
              <span className="nav-icon">💬</span>
              <span className="nav-lbl">AI Chat Agent</span>
              <span className="nav-cr">Free</span>
            </div>
          </div>

          {/* Your original sidebar-views for History and Profile */}
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
            <div className="progress-fill-bar" style={{width:progress+"%"}}/>
          </div>

          {/* Your original create view */}
          {view==="create" && (
            <div className="workspace">
              {/* YOUR ORIGINAL CONTROLS AND CANVAS CODE HERE */}
              {/* Paste the full <div className="controls"> ... </div> and <div className="canvas"> ... </div> from your original file */}
            </div>
          )}

          {/* AI CHAT VIEW */}
          {view === "chat" && (
            <div className="workspace" style={{flexDirection: "column", overflow: "hidden"}}>
              <div style={{flex:1, padding:"20px", display:"flex", flexDirection:"column"}}>
                <div style={{flex:1, overflowY:"auto", background:"var(--card)", borderRadius:"16px", padding:"20px", marginBottom:"16px"}}>
                  {chatMessages.length === 0 ? (
                    <div style={{textAlign:"center", padding:"80px 20px", opacity:0.7}}>
                      <div style={{fontSize:"60px"}}>💬</div>
                      <div style={{fontSize:"20px", fontWeight:600}}>Free AI Chat Agent</div>
                      <div style={{fontSize:"14px", color:"var(--muted2)"}}>Ask anything: Coding, News, Jokes, General Questions...</div>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} style={{marginBottom: "18px", textAlign: msg.role === "user" ? "right" : "left"}}>
                        <div style={{
                          display: "inline-block",
                          maxWidth: "75%",
                          padding: "13px 17px",
                          borderRadius: "16px",
                          background: msg.role === "user" ? "var(--cyan-dim)" : "var(--card2)"
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && <div>Thinking...</div>}
                </div>

                <div style={{display:"flex", gap:"10px"}}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && sendChatMessage()}
                    placeholder="Ask anything... (coding, jokes, news...)"
                    style={{flex:1, padding:"14px 18px", borderRadius:"12px", background:"var(--card)", border:"1px solid var(--border2)"}}
                  />
                  <button onClick={startVoiceInput} style={{padding:"14px 18px", borderRadius:"12px", background:"var(--purple-dim)", border:"none", fontSize:"20px"}}>🎤</button>
                  <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                    style={{padding:"14px 28px", borderRadius:"12px", background:"linear-gradient(135deg, var(--cyan), var(--purple))", color:"#fff", border:"none"}}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Your original history and profile views */}
          {view==="history" && ( /* your original history */ )}
          {view==="profile" && ( /* your original profile */ )}
        </main>
      </div>
    </>
  );
}
