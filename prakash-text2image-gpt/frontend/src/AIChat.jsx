/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from "react";

const MODELS = [
  { id:"claude-sonnet-4-20250514", name:"Claude Sonnet 4", icon:"⚙️", color:"#8b5cf6", badge:"Smart" },
  { id:"claude-haiku-4-5-20251001", name:"Claude Haiku 4.5", icon:"⚡", color:"#00d4ff", badge:"Fast" },
];

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

export default function AIChat({ userName = "User" }) {
  const [sessions, setSessions] = useState([{ id:1, title:"New Chat", msgs:[] }]);
  const [activeId, setActiveId] = useState(1);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  },[msgs]);

  const newChat = () => {
    const id = Date.now();
    setSessions([...sessions, { id, title:"New Chat", msgs:[] }]);
    setActiveId(id);
    setMsgs([]);
  };

  const send = () => {
    if (!input.trim()) return;

    const newMsgs = [...msgs, { role:"user", content:input }];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);

    setTimeout(()=>{
      const reply = "This is a demo response.";
      const final = [...newMsgs, { role:"assistant", content:reply }];
      setMsgs(final);
      setLoading(false);
    },1000);
  };

  return (
    <div style={{display:"flex",height:"100%"}}>

      {/* Sidebar */}
      <div style={{width:220,background:"#07070f",padding:10}}>
        <button onClick={newChat} style={{width:"100%",marginBottom:10}}>
          + New Chat
        </button>

        {sessions.map(s=>(
          <div key={s.id}
            onClick={()=>{ setActiveId(s.id); setMsgs(s.msgs); }}
            style={{padding:8,cursor:"pointer",color:"#fff"}}>
            {s.title}
          </div>
        ))}
      </div>

      {/* Chat */}
      <div style={{flex:1,padding:20}}>

        {/* Quick */}
        {msgs.length === 0 && (
          <div style={{display:"grid",gap:10}}>
            {QUICK.map((q,i)=>(
              <button key={i}
                onClick={()=>setInput(q.text)}
                style={{display:"flex",gap:8}}>
                <span>{q.icon}</span>
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div style={{marginTop:20}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{marginBottom:10}}>
              <b>{m.role}:</b>{" "}
              <span dangerouslySetInnerHTML={{__html:formatText(m.content)}}/>
            </div>
          ))}
          {loading && <div>Typing...</div>}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{marginTop:20,display:"flex",gap:10}}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            style={{flex:1}}
          />
          <button onClick={send}>Send</button>
        </div>

      </div>
    </div>
  );
}
