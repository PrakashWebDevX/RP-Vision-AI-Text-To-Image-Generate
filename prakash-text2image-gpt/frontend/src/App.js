import { useState, useRef, useCallback, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, query, where, orderBy, limit, getDocs, deleteDoc, serverTimestamp
} from "firebase/firestore";
const BACKEND = "https://rp-vision-backend.onrender.com";
const RAZORPAY_KEY_ID = "rzp_live_SUFBH3FrVkhnDX";
const PLANS = [
  {
    id:"starter", name:"Starter", price:99, credits:500,
    color:"var(--cyan)", dim:"var(--cyan-dim)", border:"rgba(0,212,255,0.3)",
    tag:null,
    features:["500 credits/month","All 7 AI tools","HD image quality","Email support"],
  },
  {
    id:"pro", name:"Pro", price:299, credits:2000,
    color:"var(--purple)", dim:"var(--purple-dim)", border:"rgba(139,92,246,0.3)",
    tag:"MOST POPULAR",
    features:["2000 credits/month","All 7 AI tools","4K image quality","Priority support"],
  },
  {
    id:"unlimited", name:"Unlimited", price:599, credits:99999,
    color:"var(--pink)", dim:"var(--pink-dim)", border:"rgba(255,45,120,0.3)",
    tag:"BEST VALUE",
    features:["Unlimited credits","All 7 AI tools","4K image quality","24/7 support"],
  },
];
const TOOLS = [
  { id:"text-to-image", label:"Text to Image", icon:"⬡", credits:1, desc:"Generate images from text prompts" },
  { id:"image-to-image", label:"Image to Image", icon:"⬢", credits:2, desc:"Transform images with AI" },
  { id:"text-to-video", label:"Text to Video", icon:"◈", credits:5, desc:"Generate cinematic video frames" },
  { id:"image-to-video", label:"Image to Video", icon:"◉", credits:5, desc:"Animate any image with AI" },
  { id:"text-to-audio", label:"Text to Audio", icon:"◎", credits:3, desc:"Generate speech from text" },
  { id:"upscale", label:"Image Upscaler", icon:"◐", credits:2, desc:"Upscale images to HD quality" },
  { id:"remove-bg", label:"Remove Background", icon:"◑", credits:1, desc:"Remove image backgrounds instantly" },
];
const STYLES = [
  { label:"Photorealistic", tag:"photorealistic, 8k ultra detailed, RAW photo" },
  { label:"Cinematic", tag:"cinematic lighting, movie still, dramatic, anamorphic" },
  { label:"Anime", tag:"anime style, studio ghibli, vibrant, detailed illustration" },
  { label:"Oil Paint", tag:"oil painting, classical art, textured canvas, masterpiece" },
  { label:"Cyberpunk", tag:"cyberpunk, neon lights, futuristic, blade runner aesthetic" },
  { label:"Fantasy", tag:"fantasy art, magical, ethereal lighting, concept art" },
];
const FREE_CREDITS_PER_DAY = 10;
function todayKey() { return new Date().toISOString().split("T")[0]; }
async function getOrCreateUser(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid:user.uid, email:user.email, name:user.displayName, photo:user.photoURL, plan:"free", planCredits:0, createdAt:serverTimestamp(), credits:{ date:todayKey(), used:0 } });
    return { plan:"free", planCredits:0, credits:{ date:todayKey(), used:0 } };
  }
  return snap.data();
}
async function checkAndDeductCredits(uid, cost, plan, planCredits) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const today = todayKey();
  // Paid plan — use planCredits
  if (plan !== "free" && plan !== undefined) {
    if (plan === "unlimited") return true;
    const pc = data.planCredits || 0;
    if (pc < cost) return false;
    await updateDoc(ref, { planCredits: pc - cost });
    return true;
  }
  // Free plan — daily credits
  let used = data.credits?.date === today ? data.credits.used : 0;
  if (used + cost > FREE_CREDITS_PER_DAY) return false;
  await updateDoc(ref, { credits:{ date:today, used:used+cost } });
  return true;
}
const CLOUDINARY_CLOUD = "dt6dp806u";
const CLOUDINARY_PRESET = "RPVISIONAI";
async function uploadToCloudinary(blob) {
  try {
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    fd.append("folder", "rp-vision-ai");
    const res = await fetch(https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload, { method:"POST", body:fd });
    const data = await res.json();
    if (data.secure_url) return data.secure_url;
    return null;
  } catch (err) { console.error("Cloudinary error:", err); return null; }
}
async function saveToHistory(uid, toolId, outputUrl, prompt) {
  try {
    await addDoc(collection(db, "history"), { uid, toolId, outputUrl, prompt, createdAt:serverTimestamp() });
  } catch (err) { console.error("saveToHistory error:", err); }
}
async function fetchHistory(uid) {
  try {
    const q = query(collection(db,"history"), where("uid","==",uid), orderBy("createdAt","desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch (err) { console.error("fetchHistory error:", err); return []; }
}
async function deleteHistoryItem(docId) {
  try { await deleteDoc(doc(db,"history",docId)); return true; }
  catch (err) { console.error("Delete error:", err); return false; }
}
// ── RAZORPAY PAYMENT ──────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}
async function initiatePayment(plan, user, onSuccess, onError) {
  const loaded = await loadRazorpayScript();
  if (!loaded) { onError("Failed to load payment gateway. Please try again."); return; }
  try {
    // Create order on backend
    const res = await fetch(${BACKEND}/create-order, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ amount:plan.price*100, currency:"INR", planId:plan.id }),
    });
    const order = await res.json();
    if (!order.id) throw new Error("Order creation failed");
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: plan.price * 100,
      currency: "INR",
      name: "RP Vision AI",
      description: ${plan.name} Plan — ${plan.credits === 99999 ? "Unlimited" : plan.credits} credits,
      image: "/logo192.png",
      order_id: order.id,
      prefill: { name:user.displayName, email:user.email },
      theme: { color:"#8b5cf6" },
      handler: async (response) => {
        try {
          // Verify payment on backend
          const vRes = await fetch(${BACKEND}/verify-payment, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ ...response, planId:plan.id, uid:user.uid }),
          });
          const vData = await vRes.json();
          if (vData.success) {
            // Update Firestore
            await updateDoc(doc(db,"users",user.uid), {
              plan: plan.id,
              planCredits: plan.credits === 99999 ? 99999 : plan.credits,
            });
            onSuccess(plan);
          } else { onError("Payment verification failed. Contact support."); }
        } catch (e) { onError("Verification error: " + e.message); }
      },
      modal: { ondismiss: () => {} },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err) { onError("Payment error: " + err.message); }
}
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
// ── UPGRADE MODAL ─────────────────────────────────────────
function UpgradeModal({ user, onClose, onSuccess, showToast }) {
  const [paying, setPaying] = useState(null);
  const handlePay = async (plan) => {
    setPaying(plan.id);
    await initiatePayment(
      plan, user,
      (p) => { onSuccess(p); showToast(🎉 ${p.name} plan activated! Enjoy your credits!, "success"); onClose(); },
      (err) => { showToast(err, "error"); setPaying(null); }
    );
    setPaying(null);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-header">
          <div className="modal-title">UPGRADE YOUR PLAN</div>
          <div className="modal-sub">Choose the plan that fits your needs</div>
        </div>
        <div className="modal-plans">
          {PLANS.map(plan => (
            <div key={plan.id} className={"modal-plan"+(plan.tag==="MOST POPULAR"?" modal-plan-popular":"")} style={{"--pc":plan.color,"--pb":plan.border,"--pd":plan.dim}}>
              {plan.tag && <div className="plan-tag" style={{background:plan.color,color:plan.id==="pro"?"#fff":"#000"}}>{plan.tag}</div>}
              <div className="plan-name" style={{color:plan.color}}>{plan.name}</div>
              <div className="plan-price">
                <span className="plan-rs">₹</span>
                <span className="plan-amount">{plan.price}</span>
                <span className="plan-period">/month</span>
              </div>
              <div className="plan-credits" style={{color:plan.color}}>
                {plan.credits===99999?"Unlimited":plan.credits} credits
              </div>
              <div className="plan-features">
                {plan.features.map((f,i) => (
                  <div key={i} className="plan-feature">
                    <span style={{color:plan.color}}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button
                className="plan-btn"
                style={{background:plan.color,color:plan.id==="unlimited"?"#fff":"#000"}}
                disabled={paying===plan.id}
                onClick={()=>handlePay(plan)}>
                {paying===plan.id ? <span className="btn-spin"/> : Pay ₹${plan.price}}
              </button>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <span>🔒 Secured by Razorpay</span>
          <span>✅ UPI · GPay · PhonePe · Cards</span>
          <span>🔄 Cancel anytime</span>
        </div>
      </div>
    </div>
  );
}
// ── PREMIUM LOGIN SCREEN ──────────────────────────────────
function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);
  const handleLogin = async () => { setLoading(true); try { await onLogin(); } finally { setLoading(false); } };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;
    let animId;
    const stars = Array.from({length:120}, () => ({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.5+0.3, o:Math.random(), speed:Math.random()*0.008+0.002,
      color:["#00d4ff","#8b5cf6","#ff2d78","#ffffff"][Math.floor(Math.random()*4)]
    }));
    const particles = Array.from({length:30}, () => ({
      x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-0.5)*0.4, vy:(Math.random()-0.5)*0.4,
      r:Math.random()*2+1,
      color:["rgba(0,212,255,0.6)","rgba(139,92,246,0.6)","rgba(255,45,120,0.6)"][Math.floor(Math.random()*3)]
    }));
    function draw(t) {
      ctx.clearRect(0,0,W,H);
      const bg = ctx.createRadialGradient(W*0.3,H*0.4,0,W*0.5,H*0.5,W*0.8);
      bg.addColorStop(0,"rgba(0,30,40,1)"); bg.addColorStop(0.4,"rgba(5,0,20,1)"); bg.addColorStop(1,"rgba(0,0,5,1)");
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
      [[W*0.2,H*0.3,W*0.35,"rgba(0,212,255,0.08)"],[W*0.8,H*0.7,W*0.3,"rgba(255,45,120,0.07)"],[W*0.5,H*0.5,W*0.4,"rgba(139,92,246,0.05)"]].forEach(([cx,cy,r,c])=>{
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,c); g.addColorStop(1,"transparent");
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      });
      stars.forEach(s=>{
        s.o+=s.speed*Math.sin(t*0.001+s.x);
        if(s.o>1)s.speed*=-1; if(s.o<0.1)s.speed=Math.abs(s.speed);
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
        ctx.fillStyle=s.color; ctx.globalAlpha=Math.max(0.1,s.o); ctx.fill(); ctx.globalAlpha=1;
      });
      particles.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.color; ctx.globalAlpha=0.7; ctx.fill(); ctx.globalAlpha=1;
      });
      animId=requestAnimationFrame(draw);
    }
    animId=requestAnimationFrame(draw);
    const ro=new ResizeObserver(()=>{W=canvas.width=canvas.offsetWidth;H=canvas.height=canvas.offsetHeight;});
    ro.observe(canvas);
    return ()=>{cancelAnimationFrame(animId);ro.disconnect();};
  }, []);
  return (
    <>
      <style>{ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Space+Mono&display=swap'); &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-root{position:fixed;inset:0;z-index:9999;overflow:hidden;font-family:'Rajdhani',sans-serif;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-canvas{position:absolute;inset:0;width:100%;height:100%;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-page{position:relative;z-index:1;display:flex;height:100vh;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-left{flex:1.2;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:60px 50px;position:relative;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-left::after{content:'';position:absolute;right:0;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,transparent,rgba(0,212,255,0.3) 20%,rgba(139,92,246,0.5) 50%,rgba(255,45,120,0.3) 80%,transparent);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.logo-container{position:relative;display:flex;flex-direction:column;align-items:center;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.logo-glow-ring{position:absolute;width:280px;height:280px;border-radius:50%;border:1px solid rgba(0,212,255,0.15);animation:ringPulse 3s ease-in-out infinite;top:50%;left:50%;transform:translate(-50%,-50%);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.logo-glow-ring2{position:absolute;width:240px;height:240px;border-radius:50%;border:1px solid rgba(139,92,246,0.2);animation:ringPulse 3s ease-in-out infinite 1s;top:50%;left:50%;transform:translate(-50%,-50%);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes ringPulse{0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.logo-img{width:180px;height:180px;object-fit:contain;position:relative;z-index:1;filter:drop-shadow(0 0 40px rgba(0,212,255,0.5)) drop-shadow(0 0 80px rgba(139,92,246,0.3));animation:logoFloat 5s ease-in-out infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes logoFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-12px) scale(1.02)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.brand-title{font-family:'Orbitron',monospace;font-size:2.2rem;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-top:24px;background:linear-gradient(135deg,#00d4ff 0%,#8b5cf6 40%,#ff2d78 80%,#00d4ff 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gradShift 4s linear infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes gradShift{0%{background-position:0%}100%{background-position:200%}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.brand-sub{font-size:0.75rem;letter-spacing:0.5em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-top:8px;text-align:center;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stats-row{display:flex;gap:36px;margin-top:44px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-item{text-align:center;position:relative;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-item::after{content:'';position:absolute;right:-18px;top:15%;bottom:15%;width:1px;background:rgba(255,255,255,0.08);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-item:last-child::after{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-num{font-family:'Orbitron',monospace;font-size:1.8rem;font-weight:800;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-num.cyan{color:#00d4ff;text-shadow:0 0 20px rgba(0,212,255,0.5);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-num.purple{color:#8b5cf6;text-shadow:0 0 20px rgba(139,92,246,0.5);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-num.pink{color:#ff2d78;text-shadow:0 0 20px rgba(255,45,120,0.5);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-label{font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-top:4px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.features-list{display:flex;flex-direction:column;gap:12px;margin-top:44px;width:100%;max-width:360px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.feature-item{display:flex;align-items:center;gap:14px;padding:13px 18px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);transition:all 0.3s;cursor:default;backdrop-filter:blur(4px);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.feature-item:hover{background:rgba(0,212,255,0.05);border-color:rgba(0,212,255,0.2);transform:translateX(6px);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.feature-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.fi-cyan{background:rgba(0,212,255,0.12);border:1px solid rgba(0,212,255,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.fi-purple{background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.fi-pink{background:rgba(255,45,120,0.12);border:1px solid rgba(255,45,120,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.feature-text strong{display:block;color:#fff;font-size:0.9rem;font-weight:600;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.feature-text span{color:rgba(255,255,255,0.45);font-size:0.8rem;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-right{flex:0.9;display:flex;align-items:center;justify-content:center;padding:40px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-card{width:100%;max-width:440px;position:relative;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-bg{background:rgba(8,8,20,0.85);border-radius:24px;padding:52px 48px;border:1px solid rgba(139,92,246,0.2);backdrop-filter:blur(30px);box-shadow:0 0 0 1px rgba(0,212,255,0.05),0 40px 100px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.05);animation:cardReveal 0.8s cubic-bezier(0.16,1,0.3,1) both;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes cardReveal{from{opacity:0;transform:translateY(30px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-corner{position:absolute;width:24px;height:24px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-corner.tl{top:-1px;left:-1px;border-top:2px solid #00d4ff;border-left:2px solid #00d4ff;border-radius:24px 0 0 0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-corner.tr{top:-1px;right:-1px;border-top:2px solid #8b5cf6;border-right:2px solid #8b5cf6;border-radius:0 24px 0 0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-corner.bl{bottom:-1px;left:-1px;border-bottom:2px solid #8b5cf6;border-left:2px solid #8b5cf6;border-radius:0 0 0 24px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-corner.br{bottom:-1px;right:-1px;border-bottom:2px solid #ff2d78;border-right:2px solid #ff2d78;border-radius:0 0 24px 0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.scan-line{position:absolute;left:0;right:0;height:2px;top:0;border-radius:24px 24px 0 0;background:linear-gradient(90deg,transparent,rgba(0,212,255,0.6),rgba(139,92,246,0.6),rgba(255,45,120,0.6),transparent);animation:scan 5s ease-in-out infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes scan{0%{top:0%;opacity:0}5%{opacity:1}95%{opacity:1}100%{top:100%;opacity:0}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-title{font-family:'Orbitron',monospace;font-size:1.6rem;font-weight:700;color:#fff;letter-spacing:0.05em;margin-bottom:6px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-sub{color:rgba(255,255,255,0.35);font-size:0.9rem;letter-spacing:0.05em;margin-bottom:42px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.google-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:14px;padding:16px 24px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:14px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:1.05rem;font-weight:600;letter-spacing:0.08em;cursor:pointer;position:relative;overflow:hidden;transition:all 0.3s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.google-btn:hover:not(:disabled){background:rgba(255,255,255,0.07);border-color:rgba(0,212,255,0.4);box-shadow:0 0 30px rgba(0,212,255,0.12);transform:translateY(-2px);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.google-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.google-btn-arrow{position:absolute;right:18px;opacity:0;transform:translateX(-8px);transition:all 0.3s;color:#00d4ff;font-size:1.2rem;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.google-btn:hover:not(:disabled) .google-btn-arrow{opacity:1;transform:translateX(0);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.g-icon{width:22px;height:22px;flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.btn-spinner{width:20px;height:20px;border:2px solid rgba(0,212,255,0.2);border-top-color:#00d4ff;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes spin{to{transform:rotate(360deg)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.divider{display:flex;align-items:center;gap:14px;margin:28px 0;color:rgba(255,255,255,0.18);font-size:0.75rem;letter-spacing:0.2em;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.divider::before,.divider::after{content:'';flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.08),transparent);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.coming-soon{text-align:center;color:rgba(255,255,255,0.25);font-size:0.85rem;letter-spacing:0.05em;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.trust-row{display:flex;justify-content:space-between;margin-top:32px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.trust-item{display:flex;align-items:center;gap:6px;font-size:0.7rem;color:rgba(255,255,255,0.28);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.trust-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.td-cyan{background:#00d4ff;box-shadow:0 0 8px rgba(0,212,255,0.8);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.td-purple{background:#8b5cf6;box-shadow:0 0 8px rgba(139,92,246,0.8);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.td-pink{background:#ff2d78;box-shadow:0 0 8px rgba(255,45,120,0.8);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.terms-text{margin-top:22px;font-size:0.7rem;color:rgba(255,255,255,0.18);text-align:center;line-height:1.8;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.terms-link{background:none;border:none;color:rgba(0,212,255,0.5);cursor:pointer;font-size:0.7rem;padding:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-badges{display:flex;gap:8px;margin-top:28px;justify-content:center;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-badge{font-size:0.68rem;padding:4px 10px;border-radius:100px;font-weight:600;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.pb-free{background:rgba(0,212,255,0.08);color:#00d4ff;border:1px solid rgba(0,212,255,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.pb-pro{background:rgba(139,92,246,0.08);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.pb-unlimited{background:rgba(255,45,120,0.08);color:#ff2d78;border:1px solid rgba(255,45,120,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@media(max-width:768px){ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-page{flex-direction:column;overflow-y:auto;height:auto;min-height:100vh;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-left{padding:50px 24px 30px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-left::after{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.logo-img{width:130px;height:130px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.brand-title{font-size:1.5rem;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-right{padding:24px 20px 50px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.card-bg{padding:36px 28px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.login-root{overflow-y:auto;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}</style>
      <div className="login-root">
        <canvas ref={canvasRef} className="login-canvas"/>
        <div className="login-page">
          <div className="login-left">
            <div className="logo-container">
              <div className="logo-glow-ring"/><div className="logo-glow-ring2"/>
              <img src="/logo192.png" alt="RP Vision AI" className="logo-img"/>
            </div>
            <div className="brand-title">RP Vision AI</div>
            <div className="brand-sub">Create Without Limits</div>
            <div className="stats-row">
              <div className="stat-item"><div className="stat-num cyan">7</div><div className="stat-label">AI Models</div></div>
              <div className="stat-item"><div className="stat-num purple">10</div><div className="stat-label">Free Credits</div></div>
              <div className="stat-item"><div className="stat-num pink">4K</div><div className="stat-label">Output</div></div>
            </div>
            <div className="features-list">
              <div className="feature-item"><div className="feature-icon fi-cyan">⚡</div><div className="feature-text"><strong>Instant Generation</strong><span>Text to image in seconds</span></div></div>
              <div className="feature-item"><div className="feature-icon fi-purple">🎨</div><div className="feature-text"><strong>Multiple Art Styles</strong><span>Realistic, anime, abstract & more</span></div></div>
              <div className="feature-item"><div className="feature-icon fi-pink">🔓</div><div className="feature-text"><strong>Free Forever Plan</strong><span>10 credits daily, no credit card</span></div></div>
            </div>
          </div>
          <div className="login-right">
            <div className="login-card">
              <div className="card-bg">
                <div className="scan-line"/>
                <div className="card-corner tl"/><div className="card-corner tr"/>
                <div className="card-corner bl"/><div className="card-corner br"/>
                <div className="card-title">Welcome Back</div>
                <div className="card-sub">Sign in to start creating with AI</div>
                <button className="google-btn" onClick={handleLogin} disabled={loading}>
                  {loading ? <div className="btn-spinner"/> : (<>
                    <svg className="g-icon" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                    <span className="google-btn-arrow">→</span>
                  </>)}
                </button>
                <div className="divider">OR</div>
                <div className="coming-soon">More sign-in options coming soon</div>
                <div className="plan-badges">
                  <span className="plan-badge pb-free">Free · 10cr/day</span>
                  <span className="plan-badge pb-pro">Pro · ₹299/mo</span>
                  <span className="plan-badge pb-unlimited">Unlimited · ₹599/mo</span>
                </div>
                <div className="trust-row">
                  <div className="trust-item"><div className="trust-dot td-cyan"/> Secure OAuth</div>
                  <div className="trust-item"><div className="trust-dot td-purple"/> Instant Access</div>
                  <div className="trust-item"><div className="trust-dot td-pink"/> Free Forever</div>
                </div>
                <div className="terms-text">By continuing, you agree to our <button className="terms-link">Terms of Service</button> & <button className="terms-link">Privacy Policy</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
// ── MAIN APP ──────────────────────────────────────────────
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
  const progressRef = useRef(null);
  useEffect(() => {
    if (inputPreviewUrl) URL.revokeObjectURL(inputPreviewUrl);
    setInputFile(null); setInputPreviewUrl(null); setResult(null); setError(null);
  }, [activeTool.id]);
  const handleFileChange = (file) => {
    if (inputPreviewUrl) URL.revokeObjectURL(inputPreviewUrl);
    setInputFile(file); setInputPreviewUrl(URL.createObjectURL(file));
  };
  const handleFileClear = () => {
    if (inputPreviewUrl) URL.revokeObjectURL(inputPreviewUrl);
    setInputFile(null); setInputPreviewUrl(null);
  };
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const data = await getOrCreateUser(u);
        setUser(u);
        setUserPlan(data.plan || "free");
        setPlanCredits(data.planCredits || 0);
        const today = todayKey();
        setCreditsUsed(data.credits?.date===today ? data.credits.used : 0);
      } else { setUser(null); }
      setAuthLoading(false);
    });
    return unsub;
  }, []);
  const handleLogin = async () => { const res = await signInWithPopup(auth,provider); await getOrCreateUser(res.user); };
  const handleLogout = async () => { await signOut(auth); setResult(null); setHistory([]); };
  const startProgress = () => {
    setProgress(0); let p=0;
    progressRef.current = setInterval(()=>{ p+=Math.random()*3; if(p>=90){clearInterval(progressRef.current);p=90;} setProgress(p); },300);
  };
  const stopProgress = () => { clearInterval(progressRef.current); setProgress(100); setTimeout(()=>setProgress(0),600); };
  const showToast = (msg, type="info") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };
  const creditsLeft = userPlan==="unlimited" ? 9999 : userPlan!=="free" ? planCredits : FREE_CREDITS_PER_DAY - creditsUsed;
  const generate = useCallback(async () => {
    if (loading) return;
    const needsFile = ["image-to-image","remove-bg","upscale","image-to-video"].includes(activeTool.id);
    const needsPrompt = !["upscale","remove-bg","image-to-video"].includes(activeTool.id);
    const promptOptional = ["image-to-video"].includes(activeTool.id);
    if (needsPrompt && !promptOptional && !prompt.trim()) { showToast("Please enter a prompt!", "error"); return; }
    if (needsFile && !inputFile) { showToast("Please upload an image first! Click the upload box above.", "error"); return; }
    if (creditsLeft < activeTool.credits) { setShowUpgrade(true); return; }
    setError(null); setResult(null); setLoading(true); startProgress();
    const ok = await checkAndDeductCredits(user.uid, activeTool.credits, userPlan, planCredits);
    if (!ok) { setLoading(false); stopProgress(); setShowUpgrade(true); return; }
    if (userPlan!=="free" && userPlan!=="unlimited") setPlanCredits(c=>c-activeTool.credits);
    else setCreditsUsed(c=>c+activeTool.credits);
    try {
      const styleTag = style!==null ? STYLES[style].tag : "";
      const fullPrompt = [prompt.trim(), styleTag].filter(Boolean).join(", ");
      let endpoint = activeTool.id;
      if (activeTool.id==="remove-bg") endpoint="remove-background";
      let fetchOptions = {};
      if (needsFile && inputFile) {
        const fd = new FormData();
        fd.append("image", inputFile);
        if (activeTool.id==="image-to-image") fd.append("prompt", fullPrompt);
        if (activeTool.id==="image-to-video") fd.append("prompt", fullPrompt);
        fetchOptions = { method:"POST", body:fd };
      } else {
        fetchOptions = { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt:fullPrompt}) };
      }
      const res = await fetch(${BACKEND}/${endpoint}, fetchOptions);
      if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.error||Generation failed (${res.status})); }
      if (activeTool.id==="text-to-audio") {
        const data = await res.json();
        const text = data.text||prompt;
        if (!window.speechSynthesis) throw new Error("Browser doesn't support speech.");
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate=0.9; utterance.pitch=1; utterance.volume=1;
        const voices = window.speechSynthesis.getVoices();
        const v = voices.find(v=>v.lang.startsWith("en")&&v.name.includes("Google"))||voices.find(v=>v.lang.startsWith("en"));
        if (v) utterance.voice=v;
        window.speechSynthesis.speak(utterance);
        setResult({type:"audio",text,utterance});
        await saveToHistory(user.uid, activeTool.id, "", prompt);
        showToast("Audio generated!", "success");
      } else {
        const blob = await res.blob();
        const localUrl = URL.createObjectURL(blob);
        setResult({type:"image",url:localUrl});
        const cloudUrl = await uploadToCloudinary(blob);
        await saveToHistory(user.uid, activeTool.id, cloudUrl||localUrl, prompt);
        showToast("Generated successfully!", "success");
      }
    } catch (err) { setError(err.message); showToast(err.message,"error"); }
    finally { stopProgress(); setLoading(false); }
  }, [prompt,style,activeTool,inputFile,loading,creditsLeft,user,userPlan,planCredits]);
  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try { setHistory(await fetchHistory(user.uid)); } finally { setHistoryLoading(false); }
  }, [user]);
  useEffect(()=>{ if(view==="history"&&user) loadHistory(); },[view,user,loadHistory]);
  const download = (url,ext="png") => { const a=document.createElement("a"); a.href=url; a.download=rp-vision-${Date.now()}.${ext}; a.click(); };
  const handleUpgradeSuccess = (plan) => {
    setUserPlan(plan.id);
    setPlanCredits(plan.credits===99999?99999:plan.credits);
  };
  // ── SPLASH LOADING ──
  if (authLoading) return (
    <>
      <style>{ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600&display=swap'); &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes spin{to{transform:rotate(360deg)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes splashFadeIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes gradShift2{0%{background-position:0%}100%{background-position:200%}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes ring1{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.3}50%{transform:translate(-50%,-50%) scale(1.12);opacity:0.8}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes ring2{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.2}50%{transform:translate(-50%,-50%) scale(1.2);opacity:0.6}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes barLoad{0%{width:0%}60%{width:75%}85%{width:88%}100%{width:95%}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes dotPulse{0%,80%,100%{opacity:0.2;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-root{position:fixed;inset:0;background:#03030a;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;overflow:hidden;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-bg1{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(0,212,255,0.06) 0%,transparent 70%);top:50%;left:30%;transform:translate(-50%,-50%);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-bg2{position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.05) 0%,transparent 70%);top:40%;left:70%;transform:translate(-50%,-50%);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-content{display:flex;flex-direction:column;align-items:center;animation:splashFadeIn 0.8s cubic-bezier(0.16,1,0.3,1) both;position:relative;z-index:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-logo-wrap{position:relative;width:160px;height:160px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.s-ring{position:absolute;border-radius:50%;top:50%;left:50%;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.s-ring1{width:160px;height:160px;border:1.5px solid rgba(0,212,255,0.3);animation:ring1 2.5s ease-in-out infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.s-ring2{width:200px;height:200px;border:1px solid rgba(139,92,246,0.2);animation:ring2 2.5s ease-in-out infinite 0.3s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.s-arc{position:absolute;width:140px;height:140px;border-radius:50%;border:2.5px solid transparent;border-top-color:#00d4ff;border-right-color:rgba(0,212,255,0.3);animation:spin 1.2s linear infinite;top:50%;left:50%;transform:translate(-50%,-50%);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.s-arc2{position:absolute;width:155px;height:155px;border-radius:50%;border:1.5px solid transparent;border-bottom-color:#8b5cf6;animation:spin 1.8s linear infinite reverse;top:50%;left:50%;transform:translate(-50%,-50%);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-logo-img{width:110px;height:110px;object-fit:contain;position:relative;z-index:2;filter:drop-shadow(0 0 30px rgba(0,212,255,0.6)) drop-shadow(0 0 60px rgba(139,92,246,0.4));animation:logoFloat 3s ease-in-out infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-brand{font-family:'Orbitron',monospace;font-size:1.7rem;font-weight:900;letter-spacing:0.25em;background:linear-gradient(135deg,#00d4ff 0%,#8b5cf6 45%,#ff2d78 80%,#00d4ff 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gradShift2 3s linear infinite;margin-top:28px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-sub{font-family:'Rajdhani',sans-serif;font-size:0.72rem;letter-spacing:0.55em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-top:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-bar-wrap{width:200px;height:2px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:40px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-bar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#00d4ff,#8b5cf6,#ff2d78);animation:barLoad 2.5s ease-out forwards;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-dots{display:flex;gap:6px;margin-top:18px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-dot{width:5px;height:5px;border-radius:50%;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sd1{background:#00d4ff;animation:dotPulse 1.2s ease-in-out infinite 0s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sd2{background:#8b5cf6;animation:dotPulse 1.2s ease-in-out infinite 0.2s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sd3{background:#ff2d78;animation:dotPulse 1.2s ease-in-out infinite 0.4s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.splash-status{font-family:'Rajdhani',sans-serif;font-size:0.75rem;letter-spacing:0.15em;color:rgba(255,255,255,0.2);margin-top:14px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}</style>
      <div className="splash-root">
        <div className="splash-bg1"/><div className="splash-bg2"/>
        <div className="splash-content">
          <div className="splash-logo-wrap">
            <div className="s-ring s-ring1"/><div className="s-ring s-ring2"/>
            <div className="s-arc"/><div className="s-arc2"/>
            <img src="/logo192.png" alt="RP Vision AI" className="splash-logo-img"/>
          </div>
          <div className="splash-brand">RP VISION AI</div>
          <div className="splash-sub">Create Without Limits</div>
          <div className="splash-bar-wrap"><div className="splash-bar-fill"/></div>
          <div className="splash-dots"><div className="splash-dot sd1"/><div className="splash-dot sd2"/><div className="splash-dot sd3"/></div>
          <div className="splash-status">Initializing AI Engine...</div>
        </div>
      </div>
    </>
  );
  if (!user) return <LoginScreen onLogin={handleLogin}/>;
  const needsImageInput = ["image-to-image","image-to-video","upscale","remove-bg"].includes(activeTool.id);
  const needsFile = needsImageInput;
  const planInfo = PLANS.find(p=>p.id===userPlan);
  return (
    <>
      <style>{ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=Space+Mono&display=swap'); &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:root{ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--bg:#03030a;--panel:#07070f;--card:#0d0d1a;--card2:#111120; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--border:rgba(255,255,255,0.05);--border2:rgba(255,255,255,0.09); &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--cyan:#00d4ff;--purple:#8b5cf6;--pink:#ff2d78; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--cyan-dim:rgba(0,212,255,0.1);--purple-dim:rgba(139,92,246,0.1);--pink-dim:rgba(255,45,120,0.1); &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--cyan-glow:rgba(0,212,255,0.25);--purple-glow:rgba(139,92,246,0.25); &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--green:#2ecc71;--red:#e74c3c; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--text:#eeeef5;--muted:#44445a;--muted2:#7777a0; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--sidebar:282px; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;html{height:100%;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;body{height:100%;background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;overflow:hidden;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes spin{to{transform:rotate(360deg)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes shimmer{from{transform:translateX(-100%)}to{transform:translateX(200%)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes reveal{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes gradFlow{0%{background-position:0%}100%{background-position:200%}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@keyframes modalIn{from{opacity:0;transform:scale(0.92)translateY(20px)}to{opacity:1;transform:scale(1)translateY(0)}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.app{display:flex;height:100vh;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* SIDEBAR */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sidebar{width:var(--sidebar);min-width:var(--sidebar);background:var(--panel);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:none;flex-shrink:0;z-index:10;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sidebar::-webkit-scrollbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sidebar-brand{padding:20px 18px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.brand-logo{width:30px;height:30px;object-fit:contain;border-radius:8px;filter:drop-shadow(0 0 8px rgba(0,212,255,0.4));} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.brand-name{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:3px;background:linear-gradient(135deg,#00d4ff,#8b5cf6,#ff2d78);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gradFlow 4s linear infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.brand-v{font-size:9px;background:linear-gradient(135deg,#00d4ff,#8b5cf6);color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;letter-spacing:1px;margin-left:auto;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.credits-bar{margin:12px 12px 0;background:var(--card);border:1px solid rgba(0,212,255,0.12);border-radius:12px;padding:12px 14px;flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.credits-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.credits-label{font-size:10px;color:var(--muted2);font-weight:500;letter-spacing:.5px;text-transform:uppercase;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.credits-count{font-family:'Space Mono',monospace;font-size:12px;color:var(--cyan);font-weight:700;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.credits-track{height:4px;background:var(--border2);border-radius:4px;overflow:hidden;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.credits-fill{height:100%;background:linear-gradient(90deg,var(--cyan),var(--purple));border-radius:4px;transition:width .4s ease;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-section{padding:14px 10px 8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-label{font-size:9px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);padding:0 8px;margin-bottom:6px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:all .18s;user-select:none;margin-bottom:2px;border:1px solid transparent;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-item:hover{background:var(--card);border-color:var(--border);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-item.active{background:rgba(0,212,255,0.06);border-color:rgba(0,212,255,0.18);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-icon{font-size:15px;color:var(--muted2);flex-shrink:0;width:20px;text-align:center;transition:color .18s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-item.active .nav-icon{color:var(--cyan);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-lbl{font-size:13px;font-weight:500;color:var(--muted2);transition:color .18s;flex:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-item.active .nav-lbl{color:var(--text);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-cr{font-size:10px;background:var(--card2);color:var(--muted2);padding:2px 7px;border-radius:20px;border:1px solid var(--border2);flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.nav-item.active .nav-cr{background:var(--cyan-dim);color:var(--cyan);border-color:rgba(0,212,255,0.3);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sidebar-views{padding:8px 10px;border-top:1px solid var(--border);margin-top:auto;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.view-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:all .18s;margin-bottom:2px;border:1px solid transparent;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.view-btn:hover{background:var(--card);border-color:var(--border);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.view-btn.active{background:var(--card2);border-color:var(--border2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.view-icon{font-size:14px;width:20px;text-align:center;color:var(--muted2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.view-lbl{font-size:13px;font-weight:500;color:var(--muted2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.view-btn.active .view-lbl,.view-btn.active .view-icon{color:var(--text);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upgrade-card{margin:10px 12px;background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(255,45,120,0.05));border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 14px;cursor:pointer;transition:all .2s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upgrade-card:hover{background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(255,45,120,0.1));border-color:rgba(139,92,246,0.4);transform:translateY(-1px);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upgrade-title{font-size:12px;font-weight:600;color:#fff;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upgrade-sub{font-size:10px;color:var(--muted2);margin-top:2px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upgrade-plans{display:flex;gap:5px;margin-top:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.uplan{font-size:9px;padding:2px 7px;border-radius:100px;font-weight:600;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.up-cyan{background:var(--cyan-dim);color:var(--cyan);border:1px solid rgba(0,212,255,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.up-purple{background:var(--purple-dim);color:var(--purple);border:1px solid rgba(139,92,246,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.up-pink{background:var(--pink-dim);color:var(--pink);border:1px solid rgba(255,45,120,0.2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sidebar-user{padding:12px 14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.user-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid rgba(0,212,255,0.3);flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.user-name{font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.user-plan{font-size:10px;color:var(--cyan);font-weight:500;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.logout-btn{background:none;border:1px solid var(--border2);border-radius:7px;color:var(--muted2);font-size:11px;padding:4px 9px;cursor:pointer;transition:all .18s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.logout-btn:hover{border-color:var(--red);color:var(--red);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* MAIN */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.main-topbar{padding:14px 26px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:rgba(7,7,15,0.8);backdrop-filter:blur(10px);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.topbar-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:var(--text);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.topbar-desc{font-size:11px;color:var(--muted2);margin-top:1px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.topbar-badge{font-size:11px;color:var(--muted2);background:var(--card);border:1px solid var(--border2);padding:5px 13px;border-radius:100px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.status-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:blink 2s infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.status-dot.busy{background:var(--cyan);box-shadow:0 0 8px var(--cyan-glow);animation:blink .7s infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.progress-bar{height:2px;background:var(--border);flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.progress-fill-bar{height:100%;background:linear-gradient(90deg,var(--cyan),var(--purple),var(--pink));transition:width .3s ease;box-shadow:0 0 8px var(--cyan-glow);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* WORKSPACE */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.workspace{flex:1;display:flex;overflow:hidden;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.controls{width:310px;min-width:310px;border-right:1px solid var(--border);overflow-y:auto;scrollbar-width:none;padding:18px 16px;display:flex;flex-direction:column;gap:16px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.controls::-webkit-scrollbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.ctrl-section{display:flex;flex-direction:column;gap:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.ctrl-lbl{font-size:9.5px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;textarea{width:100%;background:var(--card);border:1.5px solid var(--border2);border-radius:12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:300;line-height:1.7;padding:12px 13px 32px;outline:none;transition:border-color .2s,box-shadow .2s;resize:none;min-height:100px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;textarea::placeholder{color:var(--muted);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;textarea:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,212,255,0.08);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.prompt-wrap{position:relative;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.char-count{position:absolute;bottom:10px;right:12px;font-size:10px;color:var(--muted);font-family:'Space Mono',monospace;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-drop-zone{border:2px dashed rgba(0,212,255,0.2);border-radius:14px;padding:30px 20px;text-align:center;cursor:pointer;transition:all .2s;background:rgba(0,212,255,0.02);display:flex;flex-direction:column;align-items:center;gap:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-drop-zone:hover{border-color:var(--cyan);background:var(--cyan-dim);transform:translateY(-1px);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-drop-icon{width:46px;height:46px;border-radius:50%;background:var(--cyan-dim);border:1.5px solid rgba(0,212,255,0.25);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--cyan);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-drop-title{font-size:13px;font-weight:600;color:var(--text);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-drop-sub{font-size:11px;color:var(--muted2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-preview-wrap{border-radius:12px;overflow:hidden;border:1.5px solid var(--border2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-preview-img{width:100%;display:block;max-height:200px;object-fit:cover;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-preview-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--card2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-preview-name{font-size:11px;color:var(--muted2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-clear-btn{background:none;border:1px solid rgba(231,76,60,.3);border-radius:6px;color:var(--red);font-size:11px;padding:3px 8px;cursor:pointer;transition:all .18s;font-family:'DM Sans',sans-serif;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upload-clear-btn:hover{background:rgba(231,76,60,.1);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.style-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.style-pill{background:var(--card);border:1.5px solid var(--border);border-radius:9px;padding:7px 10px;cursor:pointer;transition:all .18s;font-size:11.5px;font-weight:500;color:var(--muted2);text-align:center;user-select:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.style-pill:hover{border-color:var(--border2);color:var(--text);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.style-pill.active{border-color:var(--cyan);background:var(--cyan-dim);color:var(--cyan);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.gen-btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--cyan),var(--purple));border:none;border-radius:13px;color:#fff;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;box-shadow:0 6px 24px rgba(0,212,255,0.25);display:flex;align-items:center;justify-content:center;gap:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.gen-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--purple),var(--pink));opacity:0;transition:opacity .3s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.gen-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 32px rgba(0,212,255,0.35);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.gen-btn:hover::before{opacity:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.gen-btn:disabled{opacity:.35;cursor:not-allowed;transform:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.gen-btn span,.gen-btn div{position:relative;z-index:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.gen-btn-credits{font-family:'Space Mono',monospace;font-size:11px;background:rgba(0,0,0,0.25);padding:3px 8px;border-radius:6px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* CANVAS */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.canvas{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:16px;overflow-y:auto;scrollbar-width:none;background:radial-gradient(ellipse at center,rgba(0,212,255,0.02) 0%,transparent 70%);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.canvas::-webkit-scrollbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;animation:fadeUp .5s ease both;text-align:center;opacity:.3;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.empty-icon{font-size:56px;line-height:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.empty-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:4px;color:var(--muted2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.empty-sub{font-size:12px;color:var(--muted);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.loading-card{width:100%;max-width:520px;aspect-ratio:1/1;border-radius:20px;background:var(--card);border:1px solid rgba(0,212,255,0.1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;position:relative;overflow:hidden;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.loading-card::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(0,212,255,0.03) 50%,transparent 70%);animation:shimmer 2s infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.spinner{width:36px;height:36px;border:2.5px solid rgba(0,212,255,0.1);border-top-color:var(--cyan);border-radius:50%;animation:spin .8s linear infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.loading-label{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:3px;color:var(--cyan);text-shadow:0 0 20px var(--cyan-glow);z-index:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.loading-sub-text{font-size:11px;color:var(--muted2);z-index:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.result-frame{width:100%;max-width:520px;border-radius:20px;overflow:hidden;border:1px solid rgba(0,212,255,0.15);box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 0 1px rgba(139,92,246,0.1);animation:reveal .4s ease both;position:relative;cursor:pointer;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.result-frame img{display:block;width:100%;height:auto;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.result-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 50%);opacity:0;transition:opacity .25s;display:flex;align-items:flex-end;padding:16px;gap:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.result-frame:hover .result-overlay{opacity:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.overlay-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:white;font-size:11.5px;font-weight:500;padding:7px 14px;cursor:pointer;backdrop-filter:blur(10px);transition:all .18s;font-family:'DM Sans',sans-serif;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.overlay-btn:hover{background:var(--cyan);color:#000;border-color:var(--cyan);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.audio-player{width:100%;max-width:520px;background:var(--card);border:1px solid rgba(139,92,246,0.2);border-radius:16px;padding:20px;animation:reveal .4s ease both;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.audio-label{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:var(--purple);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.result-caption{max-width:520px;font-size:12px;color:var(--muted2);font-style:italic;text-align:center;line-height:1.5;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.error-box{background:rgba(231,76,60,.06);border:1px solid rgba(231,76,60,.2);border-radius:12px;padding:14px 18px;font-size:13px;color:var(--red);max-width:500px;text-align:center;animation:fadeUp .3s ease both;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* HISTORY */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-view{flex:1;overflow-y:auto;padding:24px 28px;scrollbar-width:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-view::-webkit-scrollbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:all .2s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-card:hover{border-color:var(--cyan);transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.4);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-info{padding:10px 12px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-tool{font-size:9px;color:var(--cyan);font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-prompt{font-size:11.5px;color:var(--muted2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* PROFILE */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-view{flex:1;overflow-y:auto;padding:32px 40px;scrollbar-width:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-view::-webkit-scrollbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-card{background:var(--card);border:1px solid rgba(0,212,255,0.1);border-radius:20px;padding:28px;max-width:560px;display:flex;flex-direction:column;gap:20px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-header{display:flex;align-items:center;gap:16px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-avatar{width:64px;height:64px;border-radius:50%;border:3px solid var(--cyan);object-fit:cover;box-shadow:0 0 20px rgba(0,212,255,0.3);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-name{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-email{font-size:13px;color:var(--muted2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.profile-plan-badge{display:inline-block;padding:3px 10px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-top:4px;border-radius:6px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-card{background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-value{font-family:'Space Mono',monospace;font-size:24px;color:var(--cyan);font-weight:700;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.stat-label{font-size:11px;color:var(--muted2);margin-top:3px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upgrade-btn-profile{width:100%;padding:14px;background:linear-gradient(135deg,var(--cyan),var(--purple),var(--pink));background-size:200% auto;border:none;border-radius:12px;color:#fff;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;cursor:pointer;transition:all .3s;box-shadow:0 6px 24px rgba(0,212,255,0.25);animation:gradFlow 4s linear infinite;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.upgrade-btn-profile:hover{transform:translateY(-1px);box-shadow:0 10px 32px rgba(139,92,246,0.4);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* TOAST */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:11px 22px;border-radius:100px;font-size:13px;font-weight:500;z-index:9999;animation:toastIn .3s ease both;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.toast-success{background:var(--green);color:#000;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.toast-error{background:var(--red);color:#fff;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.toast-info{background:var(--card2);color:var(--text);border:1px solid var(--border2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* UPGRADE MODAL */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-box{background:#080814;border:1px solid rgba(139,92,246,0.3);border-radius:24px;padding:36px 32px;width:100%;max-width:820px;max-height:90vh;overflow-y:auto;position:relative;animation:modalIn .4s cubic-bezier(0.16,1,0.3,1) both;scrollbar-width:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-box::-webkit-scrollbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-close{position:absolute;top:16px;right:16px;background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--muted2);font-size:16px;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-close:hover{border-color:var(--red);color:var(--red);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-header{text-align:center;margin-bottom:28px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:4px;background:linear-gradient(135deg,var(--cyan),var(--purple),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-sub{font-size:13px;color:var(--muted2);margin-top:6px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@media(max-width:680px){.modal-plans{grid-template-columns:1fr;}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-plan{background:var(--card);border:1.5px solid var(--border2);border-radius:16px;padding:22px 18px;display:flex;flex-direction:column;gap:10px;position:relative;transition:all .2s;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-plan:hover{border-color:var(--pc,var(--cyan));box-shadow:0 8px 32px rgba(0,0,0,.4);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-plan-popular{border-color:var(--pb,rgba(139,92,246,0.3));box-shadow:0 0 30px rgba(139,92,246,0.1);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-tag{position:absolute;top:-1px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;letter-spacing:1.5px;padding:3px 12px;border-radius:0 0 8px 8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-name{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;margin-top:8px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-price{display:flex;align-items:baseline;gap:3px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-rs{font-size:18px;color:var(--text);font-weight:600;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-amount{font-family:'Bebas Neue',sans-serif;font-size:42px;line-height:1;color:var(--text);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-period{font-size:12px;color:var(--muted2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-credits{font-size:13px;font-weight:600;margin-bottom:4px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-features{display:flex;flex-direction:column;gap:6px;flex:1;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-feature{font-size:12px;color:var(--muted2);display:flex;align-items:center;gap:6px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-btn{width:100%;padding:12px;border:none;border-radius:10px;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1.5px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:auto;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.1);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.plan-btn:disabled{opacity:.6;cursor:not-allowed;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.btn-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;display:inline-block;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-footer{display:flex;justify-content:center;gap:24px;margin-top:24px;padding-top:20px;border-top:1px solid var(--border);flex-wrap:wrap;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.modal-footer span{font-size:12px;color:var(--muted2);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* MOBILE */ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.mobile-topbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.mobile-overlay{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@media(max-width:900px){:root{--sidebar:250px;}.controls{width:270px;min-width:270px;}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@media(max-width:767px){ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.app{position:relative;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sidebar{position:fixed;top:0;left:0;bottom:0;z-index:100;transform:translateX(-100%);transition:transform .3s ease;width:280px;min-width:280px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.sidebar.open{transform:translateX(0);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.mobile-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99;backdrop-filter:blur(3px);} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.mobile-topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--panel);flex-shrink:0;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.hamburger{background:none;border:1px solid var(--border2);border-radius:8px;color:var(--text);font-size:18px;padding:6px 10px;cursor:pointer;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.main-topbar{display:none;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.workspace{flex-direction:column;overflow-y:auto;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.controls{width:100%;min-width:unset;border-right:none;border-bottom:1px solid var(--border);overflow-y:visible;padding:16px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.canvas{padding:16px;justify-content:flex-start;min-height:400px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.history-view,.profile-view{padding:16px;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}</style>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {sidebarOpen && <div className="mobile-overlay" onClick={()=>setSidebarOpen(false)}/>}
      {showUpgrade && <UpgradeModal user={user} onClose={()=>setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} showToast={showToast}/>}
      <div className="app">
        <aside className={"sidebar"+(sidebarOpen?" open":"")}>
          <div className="sidebar-brand">
            <img src="/logo192.png" alt="RP Vision AI" className="brand-logo"/>
            <span className="brand-name">RP VISION AI</span>
            <span className="brand-v">V2</span>
          </div>
          <div className="credits-bar">
            <div className="credits-row">
              <span className="credits-label">{userPlan==="free"?"Daily Credits":"Plan Credits"}</span>
              <span className="credits-count">{userPlan==="unlimited"?"∞":creditsLeft} {userPlan==="free"?/ ${FREE_CREDITS_PER_DAY}:""}</span>
            </div>
            {userPlan!=="unlimited" && (
              <div className="credits-track">
                <div className="credits-fill" style={{width:userPlan==="free"?(creditsLeft/FREE_CREDITS_PER_DAY*100)+"%":Math.min((creditsLeft/2000)*100,100)+"%"}}/>
              </div>
            )}
          </div>
          <div className="nav-section">
            <div className="nav-label">AI Tools</div>
            {TOOLS.map(t=>(
              <div key={t.id} className={"nav-item"+(activeTool.id===t.id&&view==="create"?" active":"")}
                onClick={()=>{ setActiveTool(t); setView("create"); setResult(null); setError(null); setSidebarOpen(false); }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-lbl">{t.label}</span>
                <span className="nav-cr">{t.credits}cr</span>
              </div>
            ))}
          </div>
          <div className="sidebar-views">
            <div className={"view-btn"+(view==="history"?" active":"")} onClick={()=>{ setView("history"); setSidebarOpen(false); }}>
              <span className="view-icon">◫</span><span className="view-lbl">History</span>
            </div>
            <div className={"view-btn"+(view==="profile"?" active":"")} onClick={()=>{ setView("profile"); setSidebarOpen(false); }}>
              <span className="view-icon">◯</span><span className="view-lbl">Profile</span>
            </div>
          </div>
          {userPlan==="free" && (
            <div className="upgrade-card" onClick={()=>setShowUpgrade(true)}>
              <div className="upgrade-title">⬡ Upgrade to Pro</div>
              <div className="upgrade-sub">Get more credits & unlock all features</div>
              <div className="upgrade-plans">
                <span className="uplan up-cyan">₹99/mo</span>
                <span className="uplan up-purple">₹299/mo</span>
                <span className="uplan up-pink">₹599/mo</span>
              </div>
            </div>
          )}
          <div className="sidebar-user">
            <img className="user-avatar" src={user.photoURL} alt=""/>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">{user.displayName}</div>
              <div className="user-plan">{userPlan.toUpperCase()} PLAN</div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Out</button>
          </div>
        </aside>
        <main className="main">
          <div className="mobile-topbar">
            <button className="hamburger" onClick={()=>setSidebarOpen(true)}>☰</button>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:3,background:"linear-gradient(135deg,#00d4ff,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>RP VISION AI</span>
            <span style={{fontSize:11,color:"var(--muted2)"}}>{userPlan==="unlimited"?"∞":creditsLeft}cr</span>
          </div>
          <div className="main-topbar">
            <div>
              <div className="topbar-title">{activeTool.label}</div>
              <div className="topbar-desc">{activeTool.desc}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div className={"status-dot"+(loading?" busy":"")}/>
              <span className="topbar-badge">{userPlan==="unlimited"?"∞":creditsLeft} credits left</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill-bar" style={{width:progress+"%"}}/>
          </div>
          {view==="create" && (
            <div className="workspace">
              <div className="controls">
                {!["upscale","remove-bg"].includes(activeTool.id) && (
                  <div className="ctrl-section">
                    <div className="ctrl-lbl">Prompt</div>
                    <div className="prompt-wrap">
                      <textarea value={prompt} onChange={e=>setPrompt(e.target.value.slice(0,500))}
                        placeholder={
                          activeTool.id==="text-to-audio" ? "Enter any text to convert to speech..." :
                          activeTool.id==="image-to-video" ? "Optional: Describe the motion/animation..." :
                          activeTool.id==="image-to-image" ? "Describe how to transform the image..." :
                          activeTool.id==="text-to-video" ? "Describe the cinematic scene..." :
                          "Describe what you want to create..."
                        } rows={4}/>
                      <span className="char-count">{prompt.length}/500</span>
                    </div>
                  </div>
                )}
                {needsImageInput && (
                  <div className="ctrl-section">
                    <div className="ctrl-lbl">
                      {activeTool.id==="upscale" ? "📤 Upload Image to Upscale" :
                       activeTool.id==="remove-bg" ? "📤 Upload Image to Remove Background" :
                       activeTool.id==="image-to-image" ? "📤 Upload Source Image" :
                       "📤 Upload Image to Animate"}
                    </div>
                    <ImageUploader file={inputFile} previewUrl={inputPreviewUrl} onFileChange={handleFileChange} onClear={handleFileClear}/>
                    {!inputFile && (
                      <div style={{fontSize:11,color:"var(--red)",textAlign:"center",marginTop:4,padding:"6px 10px",background:"rgba(231,76,60,0.06)",borderRadius:8,border:"1px solid rgba(231,76,60,0.15)"}}>
                        ⚠️ You must upload an image before generating
                      </div>
                    )}
                  </div>
                )}
                {["text-to-image","image-to-image"].includes(activeTool.id) && (
                  <div className="ctrl-section">
                    <div className="ctrl-lbl">Art Style</div>
                    <div className="style-grid">
                      {STYLES.map((s,i)=>(
                        <div key={i} className={"style-pill"+(style===i?" active":"")} onClick={()=>setStyle(style===i?null:i)}>{s.label}</div>
                      ))}
                    </div>
                  </div>
                )}
                <button className="gen-btn" disabled={loading||(needsFile&&!inputFile)} onClick={generate}>
                  {loading ? <><div className="spinner" style={{width:20,height:20,borderWidth:2}}/> <span>Generating...</span></> : <><span>{activeTool.icon} Generate</span><span className="gen-btn-credits">{activeTool.credits} cr</span></>}
                </button>
                {needsFile && !inputFile && !loading && (
                  <div style={{fontSize:11,color:"var(--muted2)",textAlign:"center"}}>
                    👆 Upload an image above to enable generation
                  </div>
                )}
                {creditsLeft < activeTool.credits && !loading && (
                  <div style={{fontSize:11,color:"var(--red)",textAlign:"center",cursor:"pointer"}} onClick={()=>setShowUpgrade(true)}>
                    Not enough credits. <u>Upgrade now →</u>
                  </div>
                )}
              </div>
              <div className="canvas">
                {!loading && !result && !error && (
                  <div className="empty-state">
                    <div className="empty-icon">{activeTool.icon}</div>
                    <div className="empty-title">{activeTool.label}</div>
                    <div className="empty-sub">{activeTool.desc}</div>
                  </div>
                )}
                {loading && (
                  <div className="loading-card">
                    <div className="spinner"/>
                    <div className="loading-label">GENERATING...</div>
                    <div className="loading-sub-text">This may take 10–30 seconds</div>
                  </div>
                )}
                {error && !loading && <div className="error-box">⚠ {error}</div>}
                {result && !loading && (<>
                  {result.type==="image" && (
                    <div className="result-frame">
                      <img src={result.url} alt="Generated"/>
                      <div className="result-overlay">
                        <button className="overlay-btn" onClick={()=>download(result.url)}>↓ Download</button>
                        <button className="overlay-btn" onClick={()=>setResult(null)}>✕ Clear</button>
                        <button className="overlay-btn" onClick={generate}>↻ Redo</button>
                      </div>
                    </div>
                  )}
                  {result.type==="audio" && (
                    <div className="audio-player">
                      <div className="audio-label">◎ TEXT TO SPEECH</div>
                      <div style={{fontSize:13,color:"var(--muted2)",marginTop:8,lineHeight:1.6,fontStyle:"italic"}}>"{result.text}"</div>
                      <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
                        <button className="overlay-btn" style={{background:"var(--purple-dim)",borderColor:"rgba(139,92,246,0.3)",color:"var(--purple)"}} onClick={()=>{
                          window.speechSynthesis.cancel();
                          const u=new SpeechSynthesisUtterance(result.text); u.rate=0.9; u.pitch=1; u.volume=1;
                          const v=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith("en")&&v.name.includes("Google"))||window.speechSynthesis.getVoices().find(v=>v.lang.startsWith("en"));
                          if(v)u.voice=v; window.speechSynthesis.speak(u);
                        }}>▶ Play Again</button>
                        <button className="overlay-btn" onClick={()=>window.speechSynthesis.cancel()}>⏹ Stop</button>
                      </div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:10}}>💡 Uses browser built-in speech engine</div>
                    </div>
                  )}
                  {prompt && <div className="result-caption">"{prompt}"</div>}
                </>)}
              </div>
            </div>
          )}
          {view==="history" && (
            <div className="history-view">
              <div style={{marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3}}>Generation History</div>
                  <div style={{fontSize:12,color:"var(--muted2)",marginTop:3}}>Your last 20 generations</div>
                </div>
                {history.length>0 && (
                  <button style={{background:"rgba(231,76,60,0.08)",border:"1px solid rgba(231,76,60,0.25)",borderRadius:8,color:"var(--red)",fontSize:12,padding:"6px 14px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}
                    onClick={async()=>{ if(!window.confirm("Delete ALL history?"))return; await Promise.all(history.map(h=>deleteHistoryItem(h.id))); setHistory([]); showToast("All history deleted!","success"); }}>
                    ✕ Clear All
                  </button>
                )}
              </div>
              {historyLoading ? <div style={{display:"flex",justifyContent:"center",padding:60}}><Spinner/></div>
              : history.length===0 ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:60,opacity:.3,textAlign:"center"}}>
                  <div style={{fontSize:44}}>◫</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:3,color:"var(--muted2)"}}>NO HISTORY YET</div>
                  <div style={{fontSize:12,color:"var(--muted)"}}>Generate something to see it here</div>
                </div>
              ) : (
                <div className="history-grid">
                  {history.map(h=>(
                    <div key={h.id} className="history-card" style={{position:"relative"}}>
                      <div onClick={()=>{ setResult({type:"image",url:h.outputUrl}); setActiveTool(TOOLS.find(t=>t.id===h.toolId)||TOOLS[0]); setView("create"); }}>
                        <img className="history-img" src={h.outputUrl} alt="" onError={e=>e.target.style.display="none"}/>
                        <div className="history-info">
                          <div className="history-tool">{h.toolId?.replace(/-/g," ")}</div>
                          <div className="history-prompt">{h.prompt||"No prompt"}</div>
                        </div>
                      </div>
                      <button style={{position:"absolute",top:8,right:8,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,0.7)",border:"1px solid rgba(231,76,60,0.4)",color:"var(--red)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",zIndex:2}}
                        onClick={async(e)=>{ e.stopPropagation(); const ok=await deleteHistoryItem(h.id); if(ok){setHistory(prev=>prev.filter(i=>i.id!==h.id)); showToast("Deleted!","success"); } }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {view==="profile" && (
            <div className="profile-view">
              <div style={{marginBottom:24}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3}}>My Profile</div>
                <div style={{fontSize:12,color:"var(--muted2)",marginTop:3}}>Manage your account</div>
              </div>
              <div className="profile-card">
                <div className="profile-header">
                  <img className="profile-avatar" src={user.photoURL} alt=""/>
                  <div>
                    <div className="profile-name">{user.displayName}</div>
                    <div className="profile-email">{user.email}</div>
                    <div className="profile-plan-badge" style={{
                      background: userPlan==="free"?"var(--cyan-dim)":userPlan==="pro"?"var(--purple-dim)":"var(--pink-dim)",
                      color: userPlan==="free"?"var(--cyan)":userPlan==="pro"?"var(--purple)":"var(--pink)",
                      border: 1px solid ${userPlan==="free"?"rgba(0,212,255,0.25)":userPlan==="pro"?"rgba(139,92,246,0.25)":"rgba(255,45,120,0.25)"}
                    }}>
                      {userPlan.toUpperCase()} PLAN
                    </div>
                  </div>
                </div>
                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-value">{userPlan==="unlimited"?"∞":creditsLeft}</div><div className="stat-label">Credits Remaining</div></div>
                  <div className="stat-card"><div className="stat-value" style={{color:"var(--purple)"}}>{userPlan==="free"?creditsUsed:"—"}</div><div className="stat-label">Used Today</div></div>
                  <div className="stat-card"><div className="stat-value" style={{color:"var(--pink)"}}>{userPlan==="free"?FREE_CREDITS_PER_DAY:planInfo?.credits===99999?"∞":planInfo?.credits||"—"}</div><div className="stat-label">{userPlan==="free"?"Daily Free Credits":"Plan Credits"}</div></div>
                  <div className="stat-card"><div className="stat-value" style={{color:"var(--green)"}}>7</div><div className="stat-label">AI Tools Available</div></div>
                </div>
                {userPlan==="free" && (
                  <button className="upgrade-btn-profile" onClick={()=>setShowUpgrade(true)}>
                    ⬡ UPGRADE PLAN — FROM ₹99/MONTH
                  </button>
                )}
                {userPlan!=="free" && (
                  <div style={{background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:12,padding:"14px 16px",fontSize:13,color:"var(--muted2)",textAlign:"center"}}>
                    ✅ You are on the <span style={{color:planInfo?.color,fontWeight:600}}>{userPlan.toUpperCase()}</span> plan — Enjoy your credits!
                  </div>
                )}
                <button style={{background:"none",border:"1px solid rgba(231,76,60,.25)",borderRadius:10,color:"var(--red)",padding:10,cursor:"pointer",fontSize:13,fontWeight:500}} onClick={handleLogout}>Sign Out</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
