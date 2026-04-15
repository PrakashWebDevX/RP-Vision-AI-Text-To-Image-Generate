/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect, useCallback } from "react";

const MODELS = [
  { id: "claude-sonnet-4-20250514",  name: "Claude Sonnet 4",  icon: "🟣", color: "#8b5cf6", badge: "Smart" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", icon: "🔵", color: "#00d4ff", badge: "Fast"  },
];

const QUICK = [
  { icon: "💻", text: "Write a Python function to reverse a string" },
  { icon: "🎨", text: "Write HTML + CSS for a beautiful button" },
  { icon: "⚛️",  text: "Explain React useState hook with example" },
  { icon: "🚀", text: "Give me 5 SaaS startup ideas for 2026" },
  { icon: "🐛", text: "How do I fix CORS error in Express.js?" },
  { icon: "😂", text: "Tell me a programming joke" },
  { icon: "📰", text: "What are the latest trends in AI?" },
  { icon: "🎯", text: "How to center a div in CSS?" },
];

function formatText(text) {
  return text
    .replace(
      /```(\w*)\n?([\s\S]*?)```/g,
      '<pre style="background:#060612;border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:14px 16px;overflow-x:auto;font-size:12px;line-height:1.7;margin:10px 0;font-family:monospace;color:#c4b5fd;white-space:pre-wrap"><code>$2</code></pre>'
    )
    .replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(139,92,246,0.12);color:#a78bfa;padding:2px 7px;border-radius:5px;font-size:12px;font-family:monospace">$1</code>'
    )
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#eeeef5;font-weight:600">$1</strong>')
    .replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#eeeef5;margin:12px 0 6px">$1</div>')
    .replace(/^## (.+)$/gm,  '<div style="font-size:15px;font-weight:700;color:#eeeef5;margin:14px 0 6px">$1</div>')
    .replace(/^- (.+)$/gm,   '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm,'<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#00d4ff;flex-shrink:0;font-weight:600">›</span><span>$1</span></div>')
    .replace(/\n/g, "<br/>");
}

export default function AIChat({ userName = "User" }) {
  const [sessions, setSessions]     = useState([{ id: 1, title: "New Chat", msgs: [] }]);
  const [activeId, setActiveId]     = useState(1);
  const [msgs, setMsgs]             = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [model, setModel]           = useState(MODELS[0]);
  const [showModels, setShowModels] = useState(false);
  const [copied, setCopied]         = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const sidebarRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    const handler = (e) => {
      if (
        sidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        !e.target.closest("[data-hamburger]")
      ) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [sidebarOpen]);

  // Close model picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (showModels && !e.target.closest("[data-modelpicker]")) {
        setShowModels(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModels]);

  const newChat = () => {
    const id = Date.now();
    setSessions((p) => [...p, { id, title: "New Chat", msgs: [] }]);
    setActiveId(id);
    setMsgs([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const switchChat = (id) => {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setActiveId(id);
    setMsgs(s.msgs);
    setSidebarOpen(false);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setSessions((p) => {
      const next = p.filter((x) => x.id !== id);
      if (!next.length) {
        const fresh = [{ id: Date.now(), title: "New Chat", msgs: [] }];
        setActiveId(fresh[0].id);
        setMsgs([]);
        return fresh;
      }
      const last = next[next.length - 1];
      setActiveId(last.id);
      setMsgs(last.msgs);
      return next;
    });
  };

  const send = useCallback(async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "22px";
    }

    const userMsg = { role: "user", content: q };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setLoading(true);

    setSessions((p) =>
      p.map((s) =>
        s.id === activeId
          ? { ...s, title: s.msgs.length === 0 ? q.slice(0, 28) + "…" : s.title, msgs: newMsgs }
          : s
      )
    );

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 1024,
          system: `You are a helpful AI assistant built into RP Vision AI — an AI creative platform. Help users with coding (HTML,CSS,JS,Python,React,Node), answer any question, explain concepts clearly, tell jokes, discuss news, give advice and everything else. Be friendly, concise and helpful. The user's name is ${userName}. When showing code, always use markdown code blocks.`,
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data  = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong. Please try again!";
      const aiMsg = { role: "assistant", content: reply };
      const final = [...newMsgs, aiMsg];
      setMsgs(final);
      setSessions((p) => p.map((s) => (s.id === activeId ? { ...s, msgs: final } : s)));
    } catch (err) {
      const errMsg = { role: "assistant", content: `⚠️ Error: ${err.message}\n\nPlease try again.` };
      setMsgs((p) => [...p, errMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, msgs, loading, model, activeId, userName]);

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ─── Sidebar content (shared between desktop & mobile overlay) ─── */
  const SidebarContent = () => (
    <>
      {/* New Chat */}
      <div style={{ padding: "12px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={newChat}
          style={{
            width: "100%", padding: "10px 0",
            background: "linear-gradient(135deg,#00d4ff,#8b5cf6)",
            border: "none", borderRadius: 10, color: "#000",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            letterSpacing: 0.5,
          }}
        >
          ＋ New Chat
        </button>
      </div>

      {/* Model Picker */}
      <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 9, color: "#44445a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Model
        </div>
        <div style={{ position: "relative" }} data-modelpicker>
          <button
            onClick={() => setShowModels((p) => !p)}
            style={{
              width: "100%", background: "#0d0d1a",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
              padding: "8px 10px", color: "#eeeef5", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <span>{model.icon}</span>
            <span style={{ flex: 1, textAlign: "left", fontWeight: 500 }}>{model.name}</span>
            <span style={{
              fontSize: 9, background: model.color + "22", color: model.color,
              padding: "2px 6px", borderRadius: 100, border: `1px solid ${model.color}44`,
            }}>{model.badge}</span>
            <span style={{ color: "#44445a", fontSize: 10 }}>{showModels ? "▴" : "▾"}</span>
          </button>

          {showModels && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, overflow: "hidden", zIndex: 200,
              boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
            }}>
              {MODELS.map((m) => (
                <div
                  key={m.id}
                  onClick={() => { setModel(m); setShowModels(false); }}
                  style={{
                    padding: "11px 12px", cursor: "pointer",
                    display: "flex", gap: 10, alignItems: "center",
                    background: model.id === m.id ? "rgba(139,92,246,0.1)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#eeeef5" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "#7777a0" }}>{m.badge} · Free</div>
                  </div>
                  {model.id === m.id && <span style={{ color: m.color, fontSize: 14 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px", scrollbarWidth: "none" }}>
        <div style={{ fontSize: 9, color: "#44445a", letterSpacing: 2, textTransform: "uppercase", padding: "0 6px", marginBottom: 6 }}>
          Chats
        </div>
        {[...sessions].reverse().map((s) => (
          <div
            key={s.id}
            onClick={() => switchChat(s.id)}
            style={{
              padding: "9px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 3,
              display: "flex", alignItems: "center", gap: 8,
              background: s.id === activeId ? "rgba(0,212,255,0.06)" : "transparent",
              border: s.id === activeId ? "1px solid rgba(0,212,255,0.15)" : "1px solid transparent",
              transition: "all .15s", position: "relative",
            }}
          >
            <span style={{ fontSize: 12, color: s.id === activeId ? "#00d4ff" : "#44445a", flexShrink: 0 }}>◈</span>
            <span style={{
              fontSize: 12, color: s.id === activeId ? "#eeeef5" : "#7777a0",
              flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{s.title}</span>
            <button
              onClick={(e) => deleteChat(s.id, e)}
              style={{
                background: "none", border: "none", color: "#e74c3c",
                fontSize: 11, cursor: "pointer", padding: "2px 4px", borderRadius: 4, flexShrink: 0,
              }}
            >✕</button>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @keyframes typing-dot {
          0%,60%,100% { transform: translateY(0); opacity: 0.3; }
          30%          { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        ::-webkit-scrollbar { display: none; }

        /* ── Responsive helpers ── */
        .aichat-sidebar {
          width: 230px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255,255,255,0.05);
          background: #07070f;
          flex-shrink: 0;
          height: 100%;
        }

        /* Mobile overlay sidebar */
        .aichat-sidebar-overlay {
          position: fixed;
          inset: 0;
          z-index: 300;
          display: flex;
        }
        .aichat-sidebar-overlay .sidebar-panel {
          width: min(280px, 82vw);
          background: #07070f;
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          height: 100%;
          animation: slideIn 0.22s ease-out;
        }
        .aichat-sidebar-overlay .sidebar-backdrop {
          flex: 1;
          background: rgba(0,0,0,0.55);
        }

        /* Quick prompts: 2 cols on desktop, 1 col on small mobile */
        .quick-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          width: 100%;
        }
        @media (max-width: 420px) {
          .quick-grid { grid-template-columns: 1fr; }
        }

        /* Message max-width: narrower on mobile */
        .msg-bubble-wrap {
          max-width: 85%;
        }
        @media (max-width: 600px) {
          .msg-bubble-wrap { max-width: 92%; }
        }

        /* Hide desktop sidebar on mobile */
        @media (max-width: 640px) {
          .aichat-desktop-sidebar { display: none !important; }
        }

        /* Hide hamburger on desktop */
        .aichat-hamburger { display: none; }
        @media (max-width: 640px) {
          .aichat-hamburger { display: flex; }
        }

        /* Input footer bottom safe area for iOS */
        .aichat-input-footer {
          padding: 14px 20px 16px;
          padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
        }

        /* Hint text: hide on very small screens */
        @media (max-width: 380px) {
          .aichat-hint-text { display: none; }
        }
      `}</style>

      <div style={{
        flex: 1, display: "flex", height: "100%", overflow: "hidden",
        fontFamily: "'DM Sans',sans-serif", position: "relative",
      }}>

        {/* ── DESKTOP Sidebar ─────────────────────────── */}
        <div className="aichat-sidebar aichat-desktop-sidebar">
          <SidebarContent />
        </div>

        {/* ── MOBILE Sidebar Overlay ──────────────────── */}
        {sidebarOpen && (
          <div className="aichat-sidebar-overlay">
            <div className="sidebar-panel" ref={sidebarRef}>
              {/* Close button inside mobile sidebar header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                <span style={{
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2,
                  background: "linear-gradient(135deg,#00d4ff,#8b5cf6)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>RP VISION AI</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, color: "#7777a0", fontSize: 16, cursor: "pointer",
                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>
              <SidebarContent />
            </div>
            <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* ── RIGHT: Chat Area ─────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(7,7,15,0.9)", backdropFilter: "blur(12px)", flexShrink: 0,
            gap: 10,
          }}>
            {/* Left: hamburger (mobile) + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {/* Hamburger — only visible on mobile via CSS */}
              <button
                data-hamburger
                className="aichat-hamburger"
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9, color: "#eeeef5", width: 36, height: 36,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0,
                }}
              >
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    display: "block", width: 16, height: 1.5,
                    background: "#7777a0", borderRadius: 2,
                  }} />
                ))}
              </button>

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 3,
                  background: "linear-gradient(135deg,#00d4ff,#8b5cf6,#ff2d78)",
                  backgroundSize: "200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  whiteSpace: "nowrap",
                }}>
                  AI ASSISTANT
                </div>
                <div style={{
                  fontSize: 10, color: "#7777a0", marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {model.icon} {model.name} · Ask me anything!
                </div>
              </div>
            </div>

            {/* Right: status pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.08)",
              padding: "5px 10px", borderRadius: 100, flexShrink: 0,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 8px #2ecc71" }} />
              <span style={{ fontSize: 10, color: "#7777a0", whiteSpace: "nowrap" }}>Online · Free</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "20px 16px",
            display: "flex", flexDirection: "column", gap: 18, scrollbarWidth: "none",
          }}>
            {msgs.length === 0 && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 20, paddingTop: 12, maxWidth: 680, margin: "0 auto", width: "100%",
              }}>
                {/* Welcome */}
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%",
                    background: "linear-gradient(135deg,rgba(0,212,255,0.1),rgba(139,92,246,0.1))",
                    border: "2px solid rgba(139,92,246,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32, margin: "0 auto 14px",
                  }}>◈</div>
                  <div style={{
                    fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 4, color: "#eeeef5",
                  }}>HOW CAN I HELP YOU?</div>
                  <div style={{ fontSize: 12.5, color: "#7777a0", marginTop: 6, lineHeight: 1.7, padding: "0 8px" }}>
                    Coding, questions, jokes, concepts — I do it all!
                  </div>
                </div>

                {/* Quick Prompts */}
                <div className="quick-grid">
                  {QUICK.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => send(q.text)}
                      style={{
                        background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 12, padding: "11px 13px", color: "#7777a0",
                        fontSize: 12.5, cursor: "pointer", textAlign: "left",
                        fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5,
                        display: "flex", gap: 8, alignItems: "flex-start",
                        transition: "all .2s",
                      }}
                    >
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{q.icon}</span>
                      <span>{q.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div
                key={i}
                className="msg-bubble-wrap"
                style={{
                  display: "flex", gap: 10,
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                  alignItems: "flex-start",
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: m.role === "user" ? 12 : 17, fontWeight: 700,
                  background: m.role === "user"
                    ? "linear-gradient(135deg,#00d4ff,#8b5cf6)"
                    : "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(255,45,120,0.1))",
                  border: m.role === "user" ? "none" : "1px solid rgba(139,92,246,0.25)",
                  color: m.role === "user" ? "#000" : "#8b5cf6",
                }}>
                  {m.role === "user" ? "U" : model.icon}
                </div>

                {/* Bubble */}
                <div style={{
                  padding: "12px 14px",
                  borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  background: m.role === "user"
                    ? "linear-gradient(135deg,rgba(0,212,255,0.12),rgba(139,92,246,0.12))"
                    : "#0d0d1a",
                  border: m.role === "user"
                    ? "1px solid rgba(0,212,255,0.2)"
                    : "1px solid rgba(255,255,255,0.06)",
                  fontSize: 13.5, lineHeight: 1.75, color: "#eeeef5",
                  wordBreak: "break-word", overflowWrap: "break-word",
                  minWidth: 0,
                }}>
                  <div dangerouslySetInnerHTML={{ __html: formatText(m.content) }} />
                  {m.role === "assistant" && (
                    <div style={{
                      marginTop: 10, paddingTop: 8,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", gap: 12,
                    }}>
                      <button
                        onClick={() => copy(m.content, i)}
                        style={{
                          background: "none", border: "none",
                          color: copied === i ? "#2ecc71" : "#44445a",
                          fontSize: 11, cursor: "pointer", padding: 0,
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {copied === i ? "✓ Copied!" : "⎘ Copy"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", alignSelf: "flex-start" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(255,45,120,0.1))",
                  border: "1px solid rgba(139,92,246,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                }}>{model.icon}</div>
                <div style={{
                  background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "4px 16px 16px 16px", padding: "14px 18px",
                  display: "flex", gap: 5, alignItems: "center",
                }}>
                  {[0, 150, 300].map((d, i) => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%", background: "#8b5cf6",
                      animation: `typing-dot 1.2s ease-in-out ${d}ms infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Footer */}
          <div
            className="aichat-input-footer"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(7,7,15,0.95)", flexShrink: 0,
            }}
          >
            <div style={{
              display: "flex", gap: 10, alignItems: "flex-end",
              background: "#0d0d1a", border: "1.5px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: "10px 12px", transition: "border-color .2s",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask anything… (Enter to send)"
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none", color: "#eeeef5",
                  fontSize: 13.5, resize: "none", outline: "none",
                  fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6,
                  height: 22, maxHeight: 120, overflowY: "auto",
                  padding: 0, scrollbarWidth: "none",
                  /* prevent iOS zoom on focus (font-size >= 16px equivalent) */
                  touchAction: "manipulation",
                }}
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                style={{
                  width: 38, height: 38, borderRadius: 11, border: "none",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  background: input.trim() && !loading
                    ? "linear-gradient(135deg,#00d4ff,#8b5cf6)"
                    : "rgba(255,255,255,0.05)",
                  color: input.trim() && !loading ? "#000" : "#44445a",
                  fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all .2s",
                }}
              >
                {loading ? "⏳" : "↑"}
              </button>
            </div>

            {/* Hint row */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginTop: 7, padding: "0 2px",
            }}>
              <span className="aichat-hint-text" style={{ fontSize: 10, color: "#44445a" }}>
                Enter to send · Shift+Enter for new line
              </span>
              <span style={{ fontSize: 10, color: "#44445a" }}>
                Powered by <span style={{ color: model.color }}>{model.name}</span> · Free ✓
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
