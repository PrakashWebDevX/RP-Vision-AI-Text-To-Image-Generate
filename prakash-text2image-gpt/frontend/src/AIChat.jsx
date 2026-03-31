/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from "react";
import {
  Cpu, Zap, Code, Palette, Atom, Rocket, Bug,
  Laugh, Newspaper, Target
} from "lucide-react";

const MODELS = [
  { id:"claude-sonnet-4-20250514", name:"Claude Sonnet 4", icon:<Cpu size={16}/>, color:"#8b5cf6", badge:"Smart" },
  { id:"claude-haiku-4-5-20251001", name:"Claude Haiku 4.5", icon:<Zap size={16}/>, color:"#00d4ff", badge:"Fast" },
];

const QUICK = [
  { icon:<Code size={16}/>, text:"Write a Python function to reverse a string" },
  { icon:<Palette size={16}/>, text:"Write HTML + CSS for a beautiful button" },
  { icon:<Atom size={16}/>, text:"Explain React useState hook with example" },
  { icon:<Rocket size={16}/>, text:"Give me 5 SaaS startup ideas for 2026" },
  { icon:<Bug size={16}/>, text:"How do I fix CORS error in Express.js?" },
  { icon:<Laugh size={16}/>, text:"Tell me a programming joke" },
  { icon:<Newspaper size={16}/>, text:"What are the latest trends in AI?" },
  { icon:<Target size={16}/>, text:"How to center a div in CSS?" },
];

function formatText(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g,
      '<pre style="background:#060612;border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:14px 16px;overflow-x:auto;font-size:12px;line-height:1.7;margin:10px 0;font-family:monospace;color:#c4b5fd;white-space:pre-wrap"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g,
      '<code style="background:rgba(139,92,246,0.12);color:#a78bfa;padding:2px 7px;border-radius:5px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#eeeef5;font-weight:600">$1</strong>')
    .replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#eeeef5;margin:12px 0 6px">$1</div>')
    .replace(/^## (.+)$/gm,  '<div style="font-size:15px;font-weight:700;color:#eeeef5;margin:14px 0 6px">$1</div>')
    .replace(/^- (.+)$/gm,   '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm,'<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#00d4ff;flex-shrink:0;font-weight:600">›</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
}

export default function AIChat({ userName = "User" }) {
  const [sessions, setSessions] = useState([{ id:1, title:"New Chat", msgs:[] }]);
  const [activeId, setActiveId] = useState(1);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(MODELS[0]);
  const [showModels, setShowModels] = useState(false);
  const [copied, setCopied] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:"smooth" }); },[msgs,loading]);

  const newChat = () => {
    const id = Date.now();
    setSessions(p=>[...p, { id, title:"New Chat", msgs:[] }]);
    setActiveId(id);
    setMsgs([]);
    setTimeout(()=>inputRef.current?.focus(), 100);
  };

  const switchChat = (id) => {
    const s = sessions.find(x=>x.id===id);
    if (!s) return;
    setActiveId(id);
    setMsgs(s.msgs);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setSessions(p=>{
      const next = p.filter(x=>x.id!==id);
      if (!next.length) {
        const fresh = [{ id:Date.now(), title:"New Chat", msgs:[] }];
        setActiveId(fresh[0].id); setMsgs([]);
        return fresh;
      }
      const last = next[next.length-1];
      setActiveId(last.id); setMsgs(last.msgs);
      return next;
    });
  };

  const send = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");

    const userMsg  = { role:"user", content:q };
    const newMsgs  = [...msgs, userMsg];
    setMsgs(newMsgs);
    setLoading(true);

    setSessions(p=>p.map(s=>s.id===activeId
      ? { ...s, title: s.msgs.length===0 ? q.slice(0,28)+"…" : s.title, msgs:newMsgs }
      : s));

    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 1024,
          system:`You are a helpful AI assistant built into RP Vision AI...`,
          messages: newMsgs.map(m=>({ role:m.role, content:m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      const aiMsg = { role:"assistant", content:reply };
      const final = [...newMsgs, aiMsg];
      setMsgs(final);
      setSessions(p=>p.map(s=>s.id===activeId ? { ...s, msgs:final } : s));
    } catch(err) {
      const errMsg = { role:"assistant", content:`⚠️ Error: ${err.message}` };
      setMsgs(p=>[...p, errMsg]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{display:"flex",height:"100%"}}>

      {/* Sidebar */}
      <div style={{width:230,background:"#07070f"}}>
        {MODELS.map(m=>(
          <div key={m.id} style={{display:"flex",gap:10,alignItems:"center",padding:10}}>
            <span style={{display:"flex",alignItems:"center"}}>{m.icon}</span>
            <span>{m.name}</span>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div style={{flex:1}}>
        {QUICK.map((q,i)=>(
          <button key={i} style={{display:"flex",gap:8}}>
            <span style={{display:"flex",alignItems:"center"}}>{q.icon}</span>
            <span>{q.text}</span>
          </button>
        ))}
      </div>

    </div>
  );
}
