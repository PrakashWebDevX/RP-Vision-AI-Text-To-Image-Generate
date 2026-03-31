/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from "react";

// ✅ SAFE IMPORT (prevents crash if package missing)
let Icons = {};
try {
  Icons = require("lucide-react");
} catch (e) {
  Icons = {};
}

const {
  Cpu, Zap, Code, Palette, Atom, Rocket, Bug,
  Laugh, Newspaper, Target
} = Icons;

// ✅ fallback icons (if lucide fails)
const IconFallback = ({ children }) => (
  <span style={{fontSize:16}}>{children}</span>
);

const MODELS = [
  {
    id:"claude-sonnet-4-20250514",
    name:"Claude Sonnet 4",
    icon: Cpu ? <Cpu size={16}/> : <IconFallback>⚙️</IconFallback>,
    color:"#8b5cf6",
    badge:"Smart"
  },
  {
    id:"claude-haiku-4-5-20251001",
    name:"Claude Haiku 4.5",
    icon: Zap ? <Zap size={16}/> : <IconFallback>⚡</IconFallback>,
    color:"#00d4ff",
    badge:"Fast"
  },
];

const QUICK = [
  { icon: Code ? <Code size={16}/> : <IconFallback>💻</IconFallback>, text:"Write a Python function to reverse a string" },
  { icon: Palette ? <Palette size={16}/> : <IconFallback>🎨</IconFallback>, text:"Write HTML + CSS for a beautiful button" },
  { icon: Atom ? <Atom size={16}/> : <IconFallback>⚛️</IconFallback>, text:"Explain React useState hook with example" },
  { icon: Rocket ? <Rocket size={16}/> : <IconFallback>🚀</IconFallback>, text:"Give me 5 SaaS startup ideas for 2026" },
  { icon: Bug ? <Bug size={16}/> : <IconFallback>🐛</IconFallback>, text:"How do I fix CORS error in Express.js?" },
  { icon: Laugh ? <Laugh size={16}/> : <IconFallback>😂</IconFallback>, text:"Tell me a programming joke" },
  { icon: Newspaper ? <Newspaper size={16}/> : <IconFallback>📰</IconFallback>, text:"What are the latest trends in AI?" },
  { icon: Target ? <Target size={16}/> : <IconFallback>🎯</IconFallback>, text:"How to center a div in CSS?" },
];

function formatText(text) {
  return text.replace(/\n/g, "<br/>");
}

export default function AIChat() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [model] = useState(MODELS[0]);
  const bottomRef = useRef(null);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  },[msgs]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs([...msgs, { role:"user", content:input }]);
    setInput("");
  };

  return (
    <div style={{display:"flex",height:"100%"}}>

      {/* Sidebar */}
      <div style={{width:220,background:"#07070f",padding:10}}>
        {MODELS.map((m,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:10}}>
            <span style={{display:"flex",alignItems:"center"}}>{m.icon}</span>
            <span style={{color:"#fff"}}>{m.name}</span>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div style={{flex:1,padding:20}}>
        
        {/* Quick prompts */}
        <div style={{display:"grid",gap:10}}>
          {QUICK.map((q,i)=>(
            <button key={i}
              onClick={()=>setInput(q.text)}
              style={{display:"flex",gap:8,padding:10}}>
              <span style={{display:"flex",alignItems:"center"}}>{q.icon}</span>
              <span>{q.text}</span>
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{marginTop:20}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{marginBottom:10}}>
              <b>{m.role}:</b>{" "}
              <span dangerouslySetInnerHTML={{__html:formatText(m.content)}}/>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{marginTop:20,display:"flex",gap:10}}>
          <input
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
