/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from "react";

const BACKEND = "https://rp-vision-backend.onrender.com";

const MODELS = [
  { id:"claude-sonnet-4-20250514",  name:"Claude Sonnet 4",  icon:"🟣", color:"#8b5cf6", badge:"Smart"  },
  { id:"claude-haiku-4-5-20251001", name:"Claude Haiku 4.5", icon:"🔵", color:"#00d4ff", badge:"Fast"   },
];

const QUICK = [
  { icon:"💻", text:"Write a Python function to reverse a string" },
  { icon:"🎨", text:"Write HTML + CSS for a beautiful card component" },
  { icon:"⚛️",  text:"Explain React useState and useEffect with example" },
  { icon:"🚀", text:"Give me 5 profitable SaaS ideas for 2026" },
  { icon:"🐛", text:"How do I fix CORS error in Express.js?" },
  { icon:"😂", text:"Tell me a funny programming joke" },
  { icon:"📰", text:"What are the latest trends in AI?" },
  { icon:"🎯", text:"How to center a div in CSS — all methods" },
];

function formatText(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g,
      '<pre style="background:#060612;border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:14px 16px;overflow-x:auto;font-size:12px;line-height:1.7;margin:10px 0;font-family:monospace;color:#c4b5fd;white-space:pre-wrap"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g,
      '<code style="background:rgba(139,92,246,0.12);color:#a78bfa;padding:2px 7px;border-radius:5px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#eeeef5;font-weight:600">$1</strong>')
    .replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#eeeef5;margin:12px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm,  '<div style="font-size:15px;font-weight:700;color:#eeeef5;margin:14px 0 6px">$1</div>')
    .replace(/^- (.+)$/gm,   '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm,'<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#00d4ff;flex-shrink:0;font-weight:600">›</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
}

export default function AIChat({ userName = "User" }) {
  const [sessions, setSessions]     = useState([{ id:1, title:"New Chat", msgs:[] }]);
  const [activeId, setActiveId]     = useState(1);
  const [msgs, setMsgs]             = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [model, setModel]           = useState(MODELS[0]);
  const [showModels, setShowModels] = useState(false);
  const [copied, setCopied]         = useState(null);
  const [error, setError]           = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  const newChat = () => {
    const id = Date.now();
    setSessions(p => [...p, { id, title:"New Chat", msgs:[] }]);
    setActiveId(id);
    setMsgs([]);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const switchChat = (id) => {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    setActiveId(id);
    setMsgs(s.msgs);
    setError(null);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setSessions(p => {
      const next = p.filter(x => x.id !== id);
      if (!next.length) {
        const fresh = [{ id:Date.now(), title:"New Chat", msgs:[] }];
        setActiveId(fresh[0].id); setMsgs([]); return fresh;
      }
      const last = next[next.length - 1];
      setActiveId(last.id); setMsgs(last.msgs);
      return next;
    });
  };

  const send = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    setError(null);

    const userMsg  = { role:"user", content:q };
    const newMsgs  = [...msgs, userMsg];
    setMsgs(newMsgs);
    setLoading(true);

    setSessions(p => p.map(s => s.id === activeId
      ? { ...s, title: s.msgs.length === 0 ? q.slice(0,28)+"…" : s.title, msgs:newMsgs }
      : s));

    try {
      const res = await fetch(`${BACKEND}/chat`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          messages: newMsgs.map(m => ({ role:m.role, content:m.content })),
          model: model.id,
          userName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      const aiMsg = { role:"assistant", content:data.reply };
      const final = [...newMsgs, aiMsg];
      setMsgs(final);
      setSessions(p => p.map(s => s.id === activeId ? { ...s, msgs:final } : s));
    } catch(err) {
      setError(err.message);
      const errMsg = { role:"assistant", content:`⚠️ ${err.message}\n\nPlease try again.` };
      setMsgs(p => [...p, errMsg]);
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{flex:1,display:"flex",height:"100%",overflow:"hidden",fontFamily:"'DM Sans',sans-serif"}}>

      {/* ── Sessions Sidebar ── */}
      <div style={{width:230,display:"flex",flexDirection:"column",borderRight:"1px solid rgba(255,255,255,0.05)",background:"#07070f",flexShrink:0}}>

        {/* New Chat */}
        <div style={{padding:"12px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <button onClick={newChat} style={{width:"100%",padding:"10px 0",background:"linear-gradient(135deg,#00d4ff,#8b5cf6)",border:"none",borderRadius:10,color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:0.5,transition:"opacity .2s"}}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.88"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
            ＋ New Chat
          </button>
        </div>

        {/* Model Picker */}
        <div style={{padding:"10px 10px 8px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontSize:9,color:"#44445a",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>AI Model</div>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowModels(p=>!p)} style={{width:"100%",background:"#0d0d1a",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"9px 10px",color:"#eeeef5",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"'DM Sans',sans-serif",transition:"border-color .2s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(139,92,246,0.4)"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
              <span style={{fontSize:16}}>{model.icon}</span>
              <span style={{flex:1,textAlign:"left",fontWeight:500}}>{model.name}</span>
              <span style={{fontSize:9,background:model.color+"22",color:model.color,padding:"2px 7px",borderRadius:100,border:`1px solid ${model.color}44`,fontWeight:600}}>{model.badge}</span>
              <span style={{color:"#44445a",fontSize:10}}>{showModels?"▴":"▾"}</span>
            </button>
            {showModels && (
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#0d0d1a",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,overflow:"hidden",zIndex:99,boxShadow:"0 12px 32px rgba(0,0,0,0.7)"}}>
                {MODELS.map(m=>(
                  <div key={m.id} onClick={()=>{setModel(m);setShowModels(false);}}
                    style={{padding:"11px 12px",cursor:"pointer",display:"flex",gap:10,alignItems:"center",background:model.id===m.id?"rgba(139,92,246,0.1)":"transparent",borderBottom:"1px solid rgba(255,255,255,0.04)",transition:"background .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(139,92,246,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background=model.id===m.id?"rgba(139,92,246,0.1)":"transparent"}>
                    <span style={{fontSize:20}}>{m.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#eeeef5"}}>{m.name}</div>
                      <div style={{fontSize:10,color:"#7777a0"}}>{m.badge} · Free</div>
                    </div>
                    {model.id===m.id && <span style={{color:m.color,fontSize:14}}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sessions */}
        <div style={{flex:1,overflowY:"auto",padding:"8px 6px",scrollbarWidth:"none"}}>
          <div style={{fontSize:9,color:"#44445a",letterSpacing:2,textTransform:"uppercase",padding:"0 6px",marginBottom:6}}>Chats</div>
          {[...sessions].reverse().map(s=>(
            <div key={s.id} onClick={()=>switchChat(s.id)}
              style={{padding:"9px 10px",borderRadius:9,cursor:"pointer",marginBottom:3,display:"flex",alignItems:"center",gap:8,background:s.id===activeId?"rgba(0,212,255,0.06)":"transparent",border:s.id===activeId?"1px solid rgba(0,212,255,0.15)":"1px solid transparent",transition:"all .15s"}}
              onMouseEnter={e=>{if(s.id!==activeId)e.currentTarget.style.background="rgba(255,255,255,0.03)";}}
              onMouseLeave={e=>{if(s.id!==activeId)e.currentTarget.style.background="transparent";}}>
              <span style={{fontSize:12,color:s.id===activeId?"#00d4ff":"#44445a",flexShrink:0}}>◈</span>
              <span style={{fontSize:12,color:s.id===activeId?"#eeeef5":"#7777a0",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</span>
              <button onClick={(e)=>deleteChat(s.id,e)}
                style={{background:"none",border:"none",color:"#e74c3c",fontSize:11,cursor:"pointer",opacity:0,padding:"2px 4px",borderRadius:4,transition:"opacity .15s",flexShrink:0}}
                onMouseEnter={e=>{e.target.style.opacity=1;e.target.style.background="rgba(231,76,60,0.15)";}}
                onMouseLeave={e=>{e.target.style.opacity=0;e.target.style.background="none";}}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Chat ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

        {/* Header */}
        <div style={{padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(7,7,15,0.9)",backdropFilter:"blur(12px)",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,background:"linear-gradient(135deg,#00d4ff,#8b5cf6,#ff2d78)",backgroundSize:"200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AI ASSISTANT</div>
            <div style={{fontSize:11,color:"#7777a0",marginTop:1}}>{model.icon} {model.name} · Ask me anything — coding, questions, jokes & more!</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,background:"#0d0d1a",border:"1px solid rgba(255,255,255,0.08)",padding:"5px 12px",borderRadius:100}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:loading?"#e8c14a":"#2ecc71",boxShadow:`0 0 8px ${loading?"#e8c14a":"#2ecc71"}`,transition:"all .3s"}}/>
            <span style={{fontSize:11,color:"#7777a0"}}>{loading?"Thinking...":"Online · Free"}</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"24px",display:"flex",flexDirection:"column",gap:18,scrollbarWidth:"none"}}>

          {msgs.length===0 && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:24,paddingTop:10,maxWidth:680,margin:"0 auto",width:"100%"}}>
              <div style={{textAlign:"center"}}>
                <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,rgba(0,212,255,0.1),rgba(139,92,246,0.15))",border:"2px solid rgba(139,92,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 16px"}}>◈</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:4,color:"#eeeef5"}}>HOW CAN I HELP YOU?</div>
                <div style={{fontSize:13,color:"#7777a0",marginTop:8,lineHeight:1.8}}>Ask me coding questions, get explanations, jokes, startup ideas,<br/>news, general questions — everything!</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,width:"100%"}}>
                {QUICK.map((q,i)=>(
                  <button key={i} onClick={()=>send(q.text)}
                    style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"12px 14px",color:"#7777a0",fontSize:12.5,cursor:"pointer",textAlign:"left",transition:"all .2s",fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,display:"flex",gap:10,alignItems:"flex-start"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(139,92,246,0.35)";e.currentTarget.style.color="#eeeef5";e.currentTarget.style.background="rgba(139,92,246,0.06)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.color="#7777a0";e.currentTarget.style.background="#0d0d1a";}}>
                    <span style={{fontSize:16,flexShrink:0}}>{q.icon}</span>
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:12,flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-start",maxWidth:"82%",alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:m.role==="user"?13:20,fontWeight:700,
                background:m.role==="user"?"linear-gradient(135deg,#00d4ff,#8b5cf6)":"linear-gradient(135deg,rgba(139,92,246,0.15),rgba(255,45,120,0.1))",
                border:m.role==="user"?"none":"1px solid rgba(139,92,246,0.25)",color:m.role==="user"?"#000":"#8b5cf6"}}>
                {m.role==="user"?"U":model.icon}
              </div>
              <div style={{padding:"13px 16px",
                borderRadius:m.role==="user"?"16px 4px 16px 16px":"4px 16px 16px 16px",
                background:m.role==="user"?"linear-gradient(135deg,rgba(0,212,255,0.1),rgba(139,92,246,0.1))":"#0d0d1a",
                border:m.role==="user"?"1px solid rgba(0,212,255,0.18)":"1px solid rgba(255,255,255,0.06)",
                fontSize:13.5,lineHeight:1.75,color:"#eeeef5",wordBreak:"break-word"}}>
                <div dangerouslySetInnerHTML={{__html:formatText(m.content)}}/>
                {m.role==="assistant" && (
                  <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",gap:12}}>
                    <button onClick={()=>copy(m.content,i)}
                      style={{background:"none",border:"none",color:copied===i?"#2ecc71":"#44445a",fontSize:11,cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:4,transition:"color .2s"}}
                      onMouseEnter={e=>{if(copied!==i)e.currentTarget.style.color="#7777a0";}}
                      onMouseLeave={e=>{if(copied!==i)e.currentTarget.style.color="#44445a";}}>
                      {copied===i?"✓ Copied!":"⎘ Copy"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{display:"flex",gap:12,alignItems:"flex-start",alignSelf:"flex-start"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,rgba(139,92,246,0.15),rgba(255,45,120,0.1))",border:"1px solid rgba(139,92,246,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{model.icon}</div>
              <div style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"4px 16px 16px 16px",padding:"14px 18px",display:"flex",gap:5,alignItems:"center"}}>
                {[0,150,300].map((d,i)=>(
                  <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#8b5cf6",animationName:"dotBounce",animationDuration:"1.2s",animationDelay:`${d}ms`,animationIterationCount:"infinite",animationTimingFunction:"ease-in-out"}}/>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{padding:"14px 20px 16px",borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(7,7,15,0.95)",flexShrink:0}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"#0d0d1a",border:"1.5px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"12px 14px",transition:"border-color .2s"}}
            onFocus={e=>e.currentTarget.style.borderColor="rgba(139,92,246,0.35)"}
            onBlur={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
            <textarea ref={inputRef} value={input}
              onChange={e=>{ setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,130)+"px"; }}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}
              placeholder="Ask anything — code, jokes, questions, news... (Enter to send)"
              style={{flex:1,background:"none",border:"none",color:"#eeeef5",fontSize:13.5,resize:"none",outline:"none",fontFamily:"'DM Sans',sans-serif",lineHeight:1.6,height:22,maxHeight:130,overflowY:"auto",padding:0,scrollbarWidth:"none"}}
            />
            <button onClick={()=>send()} disabled={loading||!input.trim()}
              style={{width:40,height:40,borderRadius:11,border:"none",cursor:input.trim()&&!loading?"pointer":"not-allowed",background:input.trim()&&!loading?"linear-gradient(135deg,#00d4ff,#8b5cf6)":"rgba(255,255,255,0.05)",color:input.trim()&&!loading?"#000":"#44445a",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
              {loading?"⏳":"↑"}
            </button>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8,padding:"0 2px"}}>
            <span style={{fontSize:10,color:"#44445a"}}>Enter to send · Shift+Enter for new line</span>
            <span style={{fontSize:10,color:"#44445a"}}>Powered by <span style={{color:model.color,fontWeight:600}}>{model.name}</span> · Free ✓</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dotBounce {
          0%,60%,100%{transform:translateY(0);opacity:0.3}
          30%{transform:translateY(-7px);opacity:1}
        }
        ::-webkit-scrollbar{display:none;}
      `}</style>
    </div>
  );
}
