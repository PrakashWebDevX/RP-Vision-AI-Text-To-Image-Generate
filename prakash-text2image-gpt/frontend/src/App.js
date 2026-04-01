/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from "react";
import "./App.css";

const BACKEND = "https://rp-vision-backend.onrender.com";

const MODELS = [
  { id:"claude-sonnet-4-20250514",  name:"Claude Sonnet 4",  icon:"[S]", color:"#000080", badge:"Smart"  },
  { id:"claude-haiku-4-5-20251001", name:"Claude Haiku 4.5", icon:"[H]", color:"#000080", badge:"Fast"   },
];

const QUICK = [
  { icon:"[>]", text:"Write a Python function to reverse a string" },
  { icon:"[>]", text:"Write HTML + CSS for a beautiful card component" },
  { icon:"[>]", text:"Explain React useState and useEffect with example" },
  { icon:"[>]", text:"Give me 5 profitable SaaS ideas for 2026" },
  { icon:"[>]", text:"How do I fix CORS error in Express.js?" },
  { icon:"[>]", text:"Tell me a funny programming joke" },
  { icon:"[>]", text:"What are the latest trends in AI?" },
  { icon:"[>]", text:"How to center a div in CSS — all methods" },
];

function formatText(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g,
      '<pre class="win2k-code">$2</pre>')
    .replace(/`([^`]+)`/g,
      '<code style="font-family:Courier New,monospace;font-size:11px;background:#f0f0f0;border:1px solid #808080;padding:0 3px;color:#000080">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<div style="font-size:11px;font-weight:bold;margin:8px 0 3px;text-decoration:underline">$1</div>')
    .replace(/^## (.+)$/gm,  '<div style="font-size:12px;font-weight:bold;margin:10px 0 4px;text-decoration:underline">$1</div>')
    .replace(/^- (.+)$/gm,   '<div style="display:flex;gap:6px;margin:2px 0"><span style="flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm,'<div style="display:flex;gap:6px;margin:2px 0"><span style="flex-shrink:0;font-weight:bold">›</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
}

/* ── Bevel helpers ── */
const R = {
  background:"#d4d0c8",
  borderTop:"2px solid #ffffff",
  borderLeft:"2px solid #ffffff",
  borderRight:"2px solid #404040",
  borderBottom:"2px solid #404040",
  boxShadow:"inset 1px 1px 0 #ececec,inset -1px -1px 0 #808080",
};

const INSET = {
  background:"#ffffff",
  borderTop:"2px solid #808080",
  borderLeft:"2px solid #808080",
  borderRight:"2px solid #ffffff",
  borderBottom:"2px solid #ffffff",
  boxShadow:"inset 1px 1px 0 #404040",
};

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
  const [time, setTime]             = useState(new Date());
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
        method:"POST",
        headers:{ "Content-Type":"application/json" },
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
      const errMsg = { role:"assistant", content:`ERROR: ${err.message}\n\nPlease try again.` };
      setMsgs(p => [...p, errMsg]);
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const timeStr = time.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

  return (
    <div className="app-window" style={{ fontFamily:"Tahoma,'MS Sans Serif',Arial,sans-serif" }}>

      {/* ── TITLE BAR ── */}
      <div className="win2k-titlebar">
        {/* App icon */}
        <div style={{width:16,height:16,background:"#ffff00",border:"1px solid #000080",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:"bold",flexShrink:0,color:"#000080"}}>AI</div>
        <span style={{flex:1,fontSize:11,fontWeight:"bold"}}>RP Vision AI Assistant — [{model.name}]</span>
        <div style={{display:"flex",gap:2}}>
          <div className="win2k-titlebar-btn" title="Minimize">_</div>
          <div className="win2k-titlebar-btn" title="Maximize">□</div>
          <div className="win2k-titlebar-btn" title="Close" style={{fontWeight:"bold"}}>✕</div>
        </div>
      </div>

      {/* ── MENU BAR ── */}
      <div className="win2k-menubar">
        {["File","Edit","View","Chat","Model","Help"].map(m => (
          <div key={m} className="win2k-menubar-item">{m}</div>
        ))}
      </div>

      {/* ── TOOLBAR ── */}
      <div className="win2k-toolbar">
        <button className="win2k-button" onClick={newChat} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px"}}>
          <span style={{fontSize:12,lineHeight:1}}>📄</span> New Chat
        </button>
        <div className="win2k-toolbar-sep"/>
        <button className="win2k-button" style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px"}}>
          <span style={{fontSize:12,lineHeight:1}}>💾</span> Save
        </button>
        <button className="win2k-button" style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px"}}>
          <span style={{fontSize:12,lineHeight:1}}>🖨️</span> Print
        </button>
        <div className="win2k-toolbar-sep"/>
        <button className="win2k-button" style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px"}}>
          <span style={{fontSize:12,lineHeight:1}}>✂️</span> Cut
        </button>
        <button className="win2k-button" style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px"}}>
          <span style={{fontSize:12,lineHeight:1}}>📋</span> Copy
        </button>
        <button className="win2k-button" style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px"}}>
          <span style={{fontSize:12,lineHeight:1}}>📌</span> Paste
        </button>
        <div className="win2k-toolbar-sep"/>
        {/* Model selector in toolbar */}
        <span style={{fontSize:11,marginRight:4}}>Model:</span>
        <div style={{position:"relative"}}>
          <button className="win2k-button" onClick={()=>setShowModels(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,minWidth:160}}>
            <span style={{flex:1,textAlign:"left"}}>{model.name}</span>
            <span style={{fontSize:8}}>{showModels?"▲":"▼"}</span>
          </button>
          {showModels && (
            <div style={{position:"absolute",top:"calc(100% + 1px)",left:0,background:"#d4d0c8",zIndex:999,...R,minWidth:180}}>
              {MODELS.map(m => (
                <div key={m.id} onClick={()=>{ setModel(m); setShowModels(false); }}
                  style={{padding:"4px 12px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:8,
                    background:model.id===m.id?"#000080":"transparent",
                    color:model.id===m.id?"#ffffff":"#000000"}}
                  onMouseEnter={e=>{ if(model.id!==m.id){ e.currentTarget.style.background="#000080"; e.currentTarget.style.color="#ffffff"; }}}
                  onMouseLeave={e=>{ if(model.id!==m.id){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#000000"; }}}>
                  {model.id===m.id && <span style={{width:12,flexShrink:0}}>✓</span>}
                  {model.id!==m.id && <span style={{width:12,flexShrink:0}}></span>}
                  <span>{m.name}</span>
                  <span style={{marginLeft:"auto",fontSize:9,background:"#d4d0c8",color:"#000080",border:"1px solid #808080",padding:"0 4px"}}>{m.badge}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="win2k-toolbar-sep"/>
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:loading?"#ff8c00":"#00aa00",border:"1px solid #404040"}}/>
          <span style={{fontSize:11,color:"#444444"}}>{loading?"Processing...":"Online"}</span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* ── LEFT PANEL: Sessions ── */}
        <div style={{width:200,display:"flex",flexDirection:"column",background:"#d4d0c8",borderRight:"2px solid #808080",flexShrink:0}}>

          {/* Panel title */}
          <div style={{background:"linear-gradient(90deg,#000080,#1084d0)",color:"#ffffff",padding:"3px 6px",fontSize:11,fontWeight:"bold",flexShrink:0}}>
            Chat History
          </div>

          {/* Sessions list */}
          <div style={{flex:1,overflowY:"auto",padding:"4px 2px"}}>
            {[...sessions].reverse().map(s => (
              <div key={s.id} onClick={()=>switchChat(s.id)}
                style={{
                  padding:"3px 6px",cursor:"pointer",marginBottom:1,
                  display:"flex",alignItems:"center",gap:4,
                  background:s.id===activeId?"#000080":"transparent",
                  color:s.id===activeId?"#ffffff":"#000000",
                  fontSize:11,
                }}
                onMouseEnter={e=>{ if(s.id!==activeId){ e.currentTarget.style.background="#0000dd"; e.currentTarget.style.color="#ffffff"; }}}
                onMouseLeave={e=>{ if(s.id!==activeId){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#000000"; }}}>
                <span style={{fontSize:10,flexShrink:0}}>💬</span>
                <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11}}>{s.title}</span>
                <button onClick={(e)=>deleteChat(s.id,e)}
                  style={{background:"none",border:"none",color:"inherit",fontSize:10,cursor:"pointer",padding:"1px 3px",flexShrink:0,lineHeight:1}}
                  title="Delete">✕</button>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{padding:"4px",borderTop:"2px solid #808080",flexShrink:0}}>
            <button className="win2k-button" onClick={newChat} style={{width:"100%",padding:"4px 0",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
              📄 New Chat
            </button>
          </div>
        </div>

        {/* ── CHAT PANEL ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,background:"#d4d0c8"}}>

          {/* Address bar */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 6px",borderBottom:"2px solid #808080",background:"#d4d0c8",flexShrink:0}}>
            <span style={{fontSize:11,flexShrink:0}}>Address:</span>
            <div style={{flex:1,...INSET,padding:"2px 4px",fontSize:11,color:"#000080"}}>
              rpvision://ai-assistant/{model.id}
            </div>
            <button className="win2k-button" style={{padding:"2px 10px",fontSize:11}}>Go</button>
          </div>

          {/* Messages Area */}
          <div style={{flex:1,overflowY:"auto",padding:"8px",display:"flex",flexDirection:"column",gap:8,background:"#ffffff",...INSET}}>

            {msgs.length===0 && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,paddingTop:20,maxWidth:600,margin:"0 auto",width:"100%"}}>

                {/* Welcome dialog-style box */}
                <div style={{...R,width:"100%",maxWidth:520}}>
                  <div style={{background:"linear-gradient(90deg,#000080,#1084d0)",color:"#ffffff",padding:"3px 6px",fontSize:11,fontWeight:"bold",display:"flex",alignItems:"center",gap:6,marginBottom:0}}>
                    <div style={{width:14,height:14,background:"#ffff00",border:"1px solid #000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:"bold",color:"#000080",flexShrink:0}}>?</div>
                    Welcome to RP Vision AI Assistant
                  </div>
                  <div style={{padding:"14px 16px",background:"#d4d0c8",fontSize:11,lineHeight:1.8}}>
                    <p style={{margin:"0 0 10px",fontWeight:"bold"}}>How can I help you today?</p>
                    <p style={{margin:0,color:"#444444"}}>Ask me about coding, get explanations, startup ideas, jokes, latest news, and much more. Select a quick prompt below or type your question.</p>
                  </div>
                </div>

                {/* Quick prompts as a list box */}
                <div style={{...R,width:"100%",maxWidth:520}}>
                  <div style={{background:"linear-gradient(90deg,#000080,#1084d0)",color:"#ffffff",padding:"3px 6px",fontSize:11,fontWeight:"bold",marginBottom:0}}>
                    Quick Prompts
                  </div>
                  <div style={{padding:"4px",...INSET,background:"#ffffff",display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>
                    {QUICK.map((q,i)=>(
                      <div key={i} onClick={()=>send(q.text)}
                        style={{padding:"4px 8px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"flex-start",gap:6,
                          borderBottom:"1px solid #f0f0f0"}}
                        onMouseEnter={e=>{ e.currentTarget.style.background="#000080"; e.currentTarget.style.color="#ffffff"; }}
                        onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#000000"; }}>
                        <span style={{flexShrink:0,marginTop:1}}>▶</span>
                        <span style={{lineHeight:1.4}}>{q.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Error banner */}
            {error && (
              <div style={{background:"#ffffff",...R,padding:"6px 10px",display:"flex",alignItems:"center",gap:8,fontSize:11,flexShrink:0}}>
                <span style={{fontSize:16}}>⚠️</span>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Messages */}
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:8,flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-start",maxWidth:"88%",alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
                {/* Avatar */}
                <div style={{
                  width:32,height:32,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:"bold",...R,
                  background:m.role==="user"?"#d4d0c8":"#d4d0c8",
                  color:"#000080",
                  borderRadius:0,
                }}>
                  {m.role==="user"?"USR":"BOT"}
                </div>
                {/* Bubble */}
                <div style={{
                  padding:"6px 10px",
                  background:m.role==="user"?"#ffffc0":"#ffffff",
                  fontSize:11,lineHeight:1.6,color:"#000000",
                  ...(m.role==="user"?{
                    borderTop:"2px solid #ffffff",
                    borderLeft:"2px solid #ffffff",
                    borderRight:"2px solid #404040",
                    borderBottom:"2px solid #404040",
                  }:{
                    borderTop:"2px solid #808080",
                    borderLeft:"2px solid #808080",
                    borderRight:"2px solid #ffffff",
                    borderBottom:"2px solid #ffffff",
                  }),
                  wordBreak:"break-word",maxWidth:"100%",
                }}>
                  <div style={{marginBottom:4,fontSize:9,color:"#808080",display:"flex",justifyContent:"space-between",gap:12}}>
                    <strong style={{color:"#000080"}}>{m.role==="user"?userName:"RP Vision AI"}</strong>
                    <span>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <div dangerouslySetInnerHTML={{__html:formatText(m.content)}}/>
                  {m.role==="assistant" && (
                    <div style={{marginTop:6,paddingTop:4,borderTop:"1px solid #d4d0c8",display:"flex",gap:6}}>
                      <button className="win2k-button" onClick={()=>copy(m.content,i)} style={{fontSize:10,padding:"1px 8px"}}>
                        {copied===i?"✓ Copied":"Copy"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{display:"flex",gap:8,alignItems:"flex-start",alignSelf:"flex-start"}}>
                <div style={{width:32,height:32,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:"bold",...R,color:"#000080"}}>BOT</div>
                <div style={{background:"#ffffff",borderTop:"2px solid #808080",borderLeft:"2px solid #808080",borderRight:"2px solid #ffffff",borderBottom:"2px solid #ffffff",padding:"8px 14px",display:"flex",gap:4,alignItems:"center",fontSize:11}}>
                  <span style={{color:"#000080"}}>Processing</span>
                  {[0,200,400].map((d,i)=>(
                    <div key={i} style={{width:5,height:5,background:"#000080",borderRadius:"50%",animation:`win2k-dots 1.2s ease-in-out ${d}ms infinite`}}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* ── INPUT AREA ── */}
          <div style={{padding:"6px 8px",borderTop:"2px solid #808080",background:"#d4d0c8",flexShrink:0}}>
            <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
              <div style={{flex:1,...INSET,padding:0,display:"flex",alignItems:"flex-end"}}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e=>{ setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,100)+"px"; }}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
                  placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
                  style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:"Tahoma,'MS Sans Serif',Arial,sans-serif",fontSize:11,color:"#000000",padding:"4px 6px",resize:"none",lineHeight:1.5,height:22,maxHeight:100,overflowY:"auto",width:"100%"}}
                />
              </div>
              <button className="win2k-button" onClick={()=>send()} disabled={loading||!input.trim()}
                style={{padding:"5px 16px",fontSize:11,flexShrink:0,height:32,display:"flex",alignItems:"center",gap:4}}>
                {loading?"Wait...":"Send ▶"}
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:9,color:"#808080"}}>
              <span>Press Enter to send · Shift+Enter for new line</span>
              <span>Powered by {model.name} · Free</span>
            </div>
          </div>

        </div>

        {/* ── RIGHT PANEL: Info ── */}
        <div style={{width:160,display:"flex",flexDirection:"column",background:"#d4d0c8",borderLeft:"2px solid #808080",flexShrink:0}}>
          <div style={{background:"linear-gradient(90deg,#000080,#1084d0)",color:"#ffffff",padding:"3px 6px",fontSize:11,fontWeight:"bold",flexShrink:0}}>
            Properties
          </div>
          <div style={{padding:"6px",fontSize:11,flex:1,overflowY:"auto"}}>

            <div className="win2k-groupbox">
              <div className="win2k-groupbox-label">Connection</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:loading?"#ff8c00":"#00aa00",border:"1px solid #404040",flexShrink:0}}/>
                <span>{loading?"Busy":"Online"}</span>
              </div>
              <div style={{color:"#808080",fontSize:9}}>Server: onrender.com</div>
            </div>

            <div className="win2k-groupbox">
              <div className="win2k-groupbox-label">Model Info</div>
              <div style={{fontSize:9,lineHeight:1.8,color:"#444444"}}>
                <div><strong>Name:</strong></div>
                <div style={{color:"#000080"}}>{model.name}</div>
                <div style={{marginTop:4}}><strong>Speed:</strong></div>
                <div>{model.badge}</div>
                <div style={{marginTop:4}}><strong>Cost:</strong></div>
                <div style={{color:"#008000"}}>Free</div>
              </div>
            </div>

            <div className="win2k-groupbox">
              <div className="win2k-groupbox-label">Session</div>
              <div style={{fontSize:9,lineHeight:1.8,color:"#444444"}}>
                <div><strong>Chats:</strong> {sessions.length}</div>
                <div><strong>Messages:</strong> {msgs.length}</div>
                <div><strong>User:</strong> {userName}</div>
              </div>
            </div>

            <div className="win2k-groupbox">
              <div className="win2k-groupbox-label">Quick Help</div>
              <div style={{fontSize:9,lineHeight:1.8,color:"#444444"}}>
                <div>• Enter = Send</div>
                <div>• Shift+Enter = New line</div>
                <div>• Click ✕ to delete chat</div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ── STATUS BAR ── */}
      <div className="win2k-statusbar">
        <div className="win2k-statusbar-panel" style={{flex:1}}>
          {loading?"Processing request...":msgs.length>0?`${msgs.length} messages in this conversation`:"Ready"}
        </div>
        <div className="win2k-statusbar-panel">
          {model.name}
        </div>
        <div className="win2k-statusbar-panel">
          {sessions.length} chat{sessions.length!==1?"s":""}
        </div>
        <div className="win2k-statusbar-panel" style={{minWidth:60,textAlign:"center"}}>
          🌐 {timeStr}
        </div>
      </div>

      <style>{`
        @keyframes win2k-dots {
          0%,60%,100%{ transform:translateY(0); opacity:0.4; }
          30%{ transform:translateY(-4px); opacity:1; }
        }
      `}</style>
    </div>
  );
}
