/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from "react";

const QUICK = [
  { icon:"💻", text:"Write a Python function to reverse a string" },
  { icon:"🎨", text:"Write HTML + CSS for a beautiful button" },
  { icon:"⚛️", text:"Explain React useState hook with example" },
  { icon:"🚀", text:"Give me 5 SaaS startup ideas for 2026" },
  { icon:"🐛", text:"How do I fix CORS error in Express.js?" },
  { icon:"😂", text:"Tell me a programming joke" },
  { icon:"📰", text:"What are the latest trends in AI?" },
  { icon:"🎯", text:"How to center a div in CSS?" },
];

function formatText(text) {
  return text.replace(/\n/g, "<br/>");
}

export default function AIChat() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = () => {
    if (!input.trim()) return;

    const newMsgs = [...msgs, { role: "user", content: input }];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);

    // Fake AI response (safe for build)
    setTimeout(() => {
      const reply = "This is a demo AI response.";
      setMsgs([...newMsgs, { role: "assistant", content: reply }]);
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      
      {/* LEFT SIDE */}
      <div style={{ width: 220, background: "#07070f", padding: 10 }}>
        <button
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 10,
            cursor: "pointer"
          }}
          onClick={() => setMsgs([])}
        >
          + New Chat
        </button>
      </div>

      {/* RIGHT SIDE */}
      <div style={{ flex: 1, padding: 20 }}>

        {/* QUICK PROMPTS */}
        {msgs.length === 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {QUICK.map((q, i) => (
              <button
                key={i}
                onClick={() => setInput(q.text)}
                style={{ display: "flex", gap: 8, padding: 10 }}
              >
                <span>{q.icon}</span>
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* MESSAGES */}
        <div style={{ marginTop: 20 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <b>{m.role}:</b>{" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: formatText(m.content)
                }}
              />
            </div>
          ))}

          {loading && <div>Typing...</div>}
          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={send}>Send</button>
        </div>

      </div>
    </div>
  );
}
