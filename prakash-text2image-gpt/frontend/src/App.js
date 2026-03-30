import { useState, useRef, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, query, where, orderBy, limit, getDocs, deleteDoc, serverTimestamp
} from "firebase/firestore";

const BACKEND = "https://rp-vision-backend.onrender.com";
const RAZORPAY_KEY_ID = "rzp_live_SUFBH3FrVkhnDX";

const PLANS = [ /* paste your PLANS array here */ ];
const TOOLS = [ /* paste your TOOLS array here */ ];
const STYLES = [ /* paste your STYLES array here */ ];

const CHAT_MODELS = [
  { value: "claude", label: "Claude Sonnet", icon: "🌟" },
  { value: "gemini", label: "Gemini", icon: "🔥" },
];

const FREE_CREDITS_PER_DAY = 10;

function todayKey() { return new Date().toISOString().split("T")[0]; }

// Keep all your helper functions here (getOrCreateUser, checkAndDeductCredits, uploadToCloudinary, saveToHistory, etc.)
// Just make sure fetch lines use proper backticks like `${BACKEND}/something`

// Keep your ImageUploader, UpgradeModal, LoginScreen functions here exactly as they are in your original file.

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

  // Keep your existing useEffects and functions (generate, loadHistory, etc.)

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
      setChatMessages(prev => [...prev, { role: "assistant", content: "Chat service busy. Try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (e) => setChatInput(e.results[0][0].transcript);
    recognition.start();
  };

  if (authLoading) return <div>Loading...</div>;
  if (!user) return <LoginScreen onLogin={() => signInWithPopup(auth, provider)} />;

  return (
    <>
      {/* Your full original <style> tag with all CSS */}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}
      {showUpgrade && <UpgradeModal user={user} onClose={() => setShowUpgrade(false)} onSuccess={(p) => { setUserPlan(p.id); setPlanCredits(p.credits); }} showToast={(msg, type) => {}} />}

      <div className="app">
        <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
          {/* Your original sidebar brand, credits, tools */}

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
            <div className={"nav-item" + (view === "chat" ? " active" : "")} onClick={() => setView("chat")}>
              <span className="nav-icon">💬</span>
              <span className="nav-lbl">AI Chat Agent</span>
              <span className="nav-cr">Free</span>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="main-topbar">
            <div>
              <div className="topbar-title">{view === "chat" ? "💬 AI Chat Agent" : activeTool.label}</div>
              <div className="topbar-desc">{view === "chat" ? "Ask anything..." : activeTool.desc}</div>
            </div>
            {view === "chat" && (
              <select value={selectedChatModel} onChange={(e) => setSelectedChatModel(e.target.value)}>
                {CHAT_MODELS.map(m => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
              </select>
            )}
          </div>

          {/* Your original create view */}
          {view === "create" && (
            <div className="workspace">
              {/* YOUR ORIGINAL CONTROLS AND CANVAS CODE HERE */}
            </div>
          )}

          {/* AI CHAT VIEW */}
          {view === "chat" && (
            <div className="workspace" style={{ flexDirection: "column" }}>
              <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflowY: "auto", background: "#111", borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>
                      <div style={{ fontSize: "50px" }}>💬</div>
                      <div>Ask me anything</div>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} style={{ marginBottom: "16px", textAlign: msg.role === "user" ? "right" : "left" }}>
                        <div style={{ display: "inline-block", maxWidth: "80%", padding: "12px 16px", borderRadius: "16px", background: msg.role === "user" ? "#00d4ff30" : "#222" }}>
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
                    style={{ flex: 1, padding: "14px", borderRadius: "12px" }}
                  />
                  <button onClick={startVoiceInput} style={{ padding: "14px", borderRadius: "12px", background: "#8b5cf6" }}>🎤</button>
                  <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                    style={{ padding: "14px 24px", borderRadius: "12px", background: "#00d4ff", color: "white" }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
