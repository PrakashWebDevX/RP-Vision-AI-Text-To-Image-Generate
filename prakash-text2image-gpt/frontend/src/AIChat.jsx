import { useState, useRef, useEffect } from "react";

const BOT_ICON = (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect width="28" height="28" rx="14" fill="url(#botGrad)" />
    <path
      d="M14 7l2.5 4.5H20l-3 3.5 1.5 5L14 17l-4.5 3 1.5-5-3-3.5h3.5L14 7z"
      fill="white"
      fillOpacity="0.9"
    />
    <defs>
      <linearGradient id="botGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00d4ff" />
        <stop offset="1" stopColor="#7b2ff7" />
      </linearGradient>
    </defs>
  </svg>
);

const SEND_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: "assistant",
    text: "Hi! I'm your AI Assistant powered by Claude Sonnet 4. I can help with coding, answer questions, generate creative content, and much more. How can I help you today?",
    time: "Just now",
  },
];

const SUGGESTIONS = [
  "Generate an image for me",
  "Help me write code",
  "Explain a concept",
  "Creative writing",
];

export default function ChatSection() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg = {
      id: Date.now(),
      role: "user",
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));

    const responses = [
      "That's a great question! I'd be happy to help you with that. Let me think through this carefully...",
      "Sure! Here's what I know about that topic. It's quite fascinating when you dig into the details.",
      "Absolutely! I can assist with that. Here's a breakdown of how I'd approach it...",
      "Interesting! Let me provide you with a comprehensive answer to make sure you get exactly what you need.",
    ];

    const botMsg = {
      id: Date.now() + 1,
      role: "assistant",
      text: responses[Math.floor(Math.random() * responses.length)],
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setIsTyping(false);
    setMessages((prev) => [...prev, botMsg]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {BOT_ICON}
          <div>
            <p style={styles.headerTitle}>AI Assistant</p>
            <p style={styles.headerSub}>Claude Sonnet 4 · Free</p>
          </div>
        </div>
        <div style={styles.onlineBadge}>
          <span style={styles.onlineDot} />
          Online
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesArea}>
        {/* Welcome hero — only shown when only 1 message (initial) */}
        {messages.length === 1 && (
          <div style={styles.hero}>
            <div style={styles.heroIcon}>{BOT_ICON}</div>
            <h2 style={styles.heroTitle}>How can I help you?</h2>
            <p style={styles.heroSub}>
              I can help with coding, answering questions, generating images, and more.
            </p>
            <div style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} style={styles.suggestionChip} onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.messageRow,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "assistant" && (
              <div style={styles.avatarSmall}>{BOT_ICON}</div>
            )}
            <div style={styles.bubbleWrap}>
              <div
                style={{
                  ...styles.bubble,
                  ...(msg.role === "user" ? styles.bubbleUser : styles.bubbleBot),
                }}
              >
                {msg.text}
              </div>
              <p
                style={{
                  ...styles.timeStamp,
                  textAlign: msg.role === "user" ? "right" : "left",
                }}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div style={styles.messageRow}>
            <div style={styles.avatarSmall}>{BOT_ICON}</div>
            <div style={styles.typingBubble}>
              <span style={{ ...styles.dot, animationDelay: "0ms" }} />
              <span style={{ ...styles.dot, animationDelay: "150ms" }} />
              <span style={{ ...styles.dot, animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={styles.inputBar}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything — code, jokes & more!"
          rows={1}
          style={styles.textarea}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          style={{
            ...styles.sendBtn,
            opacity: !input.trim() || isTyping ? 0.45 : 1,
            cursor: !input.trim() || isTyping ? "not-allowed" : "pointer",
          }}
        >
          {SEND_ICON}
        </button>
      </div>
      <p style={styles.footer}>
        Enter to send · Shift+Enter for new line · Powered by{" "}
        <span style={styles.footerAccent}>Claude Sonnet 4</span>
      </p>

      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg-bubble { animation: fadeUp 0.25s ease; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    maxHeight: "100dvh",
    background: "linear-gradient(160deg, #07070f 0%, #0d0d1f 60%, #070714 100%)",
    color: "#e8e8f0",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    overflow: "hidden",
    position: "relative",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(7, 7, 20, 0.85)",
    backdropFilter: "blur(12px)",
    flexShrink: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    color: "#ffffff",
    letterSpacing: "0.01em",
  },
  headerSub: {
    margin: 0,
    fontSize: "11px",
    color: "rgba(255,255,255,0.45)",
  },
  onlineBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    color: "#4ade80",
    background: "rgba(74, 222, 128, 0.1)",
    border: "1px solid rgba(74, 222, 128, 0.25)",
    padding: "4px 10px",
    borderRadius: "20px",
  },
  onlineDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#4ade80",
    display: "inline-block",
    boxShadow: "0 0 6px #4ade80",
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(255,255,255,0.12) transparent",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "24px 8px 28px",
    gap: "10px",
  },
  heroIcon: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "rgba(0, 212, 255, 0.08)",
    border: "1.5px solid rgba(0, 212, 255, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "4px",
  },
  heroTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    background: "linear-gradient(90deg, #00d4ff, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    margin: 0,
    fontSize: "13px",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.55,
    maxWidth: "280px",
  },
  suggestions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "center",
    marginTop: "8px",
  },
  suggestionChip: {
    padding: "8px 14px",
    borderRadius: "20px",
    border: "1px solid rgba(0,212,255,0.25)",
    background: "rgba(0,212,255,0.06)",
    color: "#a0e4f1",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.18s",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    marginBottom: "6px",
    animation: "fadeUp 0.25s ease",
  },
  avatarSmall: {
    width: "28px",
    height: "28px",
    flexShrink: 0,
    marginBottom: "18px",
  },
  bubbleWrap: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "78%",
  },
  bubble: {
    padding: "10px 14px",
    borderRadius: "16px",
    fontSize: "14px",
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
  bubbleBot: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderBottomLeftRadius: "4px",
    color: "#e0e0f0",
  },
  bubbleUser: {
    background: "linear-gradient(135deg, #1a6bff 0%, #7b2ff7 100%)",
    borderBottomRightRadius: "4px",
    color: "#ffffff",
  },
  timeStamp: {
    margin: "3px 2px 0",
    fontSize: "10px",
    color: "rgba(255,255,255,0.28)",
  },
  typingBubble: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "12px 16px",
    borderRadius: "16px",
    borderBottomLeftRadius: "4px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  dot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "rgba(0, 212, 255, 0.7)",
    display: "inline-block",
    animation: "blink 1.2s ease-in-out infinite",
  },
  inputBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    padding: "12px 12px 8px",
    background: "rgba(7,7,20,0.9)",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(12px)",
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#e8e8f0",
    fontSize: "14px",
    padding: "10px 14px",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
    minHeight: "42px",
    maxHeight: "120px",
    overflowY: "auto",
    caretColor: "#00d4ff",
  },
  sendBtn: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #00d4ff, #7b2ff7)",
    border: "none",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "transform 0.15s, opacity 0.15s",
  },
  footer: {
    textAlign: "center",
    fontSize: "10px",
    color: "rgba(255,255,255,0.22)",
    padding: "4px 12px 10px",
    margin: 0,
    flexShrink: 0,
  },
  footerAccent: {
    color: "rgba(0,212,255,0.6)",
  },
};
