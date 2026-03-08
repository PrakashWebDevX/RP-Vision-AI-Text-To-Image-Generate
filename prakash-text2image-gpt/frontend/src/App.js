import { useState, useRef, useCallback, useEffect } from "react";

const STYLE_PRESETS = [
  { label: "Photorealistic", icon: "◈", tag: "photorealistic, 8k ultra detailed, RAW photo" },
  { label: "Cinematic", icon: "◉", tag: "cinematic lighting, movie still, anamorphic lens, dramatic" },
  { label: "Anime", icon: "◎", tag: "anime style, studio ghibli, vibrant colors, detailed illustration" },
  { label: "Oil Paint", icon: "◐", tag: "oil painting, classical art, textured canvas, masterpiece" },
  { label: "Cyberpunk", icon: "◑", tag: "cyberpunk, neon lights, futuristic city, blade runner aesthetic" },
  { label: "Fantasy", icon: "◒", tag: "fantasy art, magical, ethereal lighting, concept art, artstation" },
];

const EXAMPLE_PROMPTS = [
  "Astronaut on crystal moon, Earth in visor, volumetric fog",
  "Ancient dragon atop gold coins, soft dawn light, epic fantasy",
  "Neon Tokyo alley in heavy rain, cinematic noir reflections",
  "Cyberpunk samurai, glowing tattoos, cherry blossoms, hyper-detailed",
];

const ASPECT_RATIOS = [
  { label: "Square", icon: "⬛" },
  { label: "Portrait", icon: "▬" },
  { label: "Wide", icon: "▭" },
];

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--accent)",
          display: "inline-block",
          animation: `dotBounce 1.2s ${i * 0.15}s infinite`
        }} />
      ))}
    </span>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedRatio, setSelectedRatio] = useState(0);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [progress, setProgress] = useState(0);
  const [mobileTab, setMobileTab] = useState("create");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const progressRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startProgress = () => {
    setProgress(0);
    let p = 0;
    progressRef.current = setInterval(() => {
      p += Math.random() * 2.5;
      if (p >= 90) { clearInterval(progressRef.current); p = 90; }
      setProgress(p);
    }, 250);
  };

  const stopProgress = () => {
    clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
  };

const generate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    setError(null);
    setLoading(true);
    startProgress();
    if (isMobile) setMobileTab("result");

    // Build prompt inline instead of calling buildFullPrompt
    const style = selectedStyle !== null ? STYLE_PRESETS[selectedStyle].tag : "";
    const fullPrompt = [prompt.trim(), style].filter(Boolean).join(", ");

try {
      const res = await fetch("https://rp-vision-backend.onrender.com/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      if (!res.ok) throw new Error("Generation failed. Check your backend.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setHistory(prev => [{ url, prompt: prompt.trim(), style: selectedStyle !== null ? STYLE_PRESETS[selectedStyle].label : "Default" }, ...prev.slice(0, 11)]);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      stopProgress();
      setLoading(false);
    }
  }, [prompt, selectedStyle, loading, isMobile]);

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `visiona-${Date.now()}.png`;
    a.click();
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #050508;
          --panel: #0c0c13;
          --card: #111119;
          --card2: #161620;
          --border: rgba(255,255,255,0.06);
          --border2: rgba(255,255,255,0.11);
          --accent: #e8c14a;
          --accent2: #f5d97a;
          --accent-dim: rgba(232,193,74,0.12);
          --accent-glow: rgba(232,193,74,0.28);
          --text: #eeeef5;
          --muted: #525268;
          --muted2: #8888a0;
          --red: #ff5555;
          --green: #50fa7b;
          --sidebar-w: 340px;
        }

        html, body { height: 100%; }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Outfit', sans-serif;
          font-weight: 400;
          overflow: hidden;
        }

        body::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 9999;
        }

        @keyframes dotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(200%); }
        }
        @keyframes imageReveal {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ═══════════════════════════
           DESKTOP LAYOUT (≥768px)
        ═══════════════════════════ */
        .desktop-layout {
          display: flex;
          height: 100vh;
        }

        .sidebar {
          width: var(--sidebar-w);
          min-width: var(--sidebar-w);
          background: var(--panel);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .sidebar::-webkit-scrollbar { display: none; }

        .brand {
          padding: 26px 26px 18px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .brand-name {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 30px;
          letter-spacing: 4px;
          color: var(--accent);
          line-height: 1;
          text-shadow: 0 0 40px var(--accent-glow);
        }
        .brand-sub {
          font-size: 10px;
          color: var(--muted2);
          letter-spacing: 2.5px;
          text-transform: uppercase;
          margin-top: 4px;
          font-weight: 300;
        }

        .sidebar-section {
          padding: 18px 22px;
          border-bottom: 1px solid var(--border);
        }
        .section-label {
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 12px;
        }

        textarea {
          width: 100%;
          background: var(--card);
          border: 1.5px solid var(--border2);
          border-radius: 14px;
          color: var(--text);
          font-family: 'Outfit', sans-serif;
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.7;
          padding: 13px 14px 38px;
          resize: none;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          min-height: 110px;
        }
        textarea::placeholder { color: var(--muted); }
        textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-dim);
        }

        .prompt-wrapper { position: relative; }
        .char-count {
          position: absolute;
          bottom: 11px;
          right: 13px;
          font-size: 10px;
          color: var(--muted);
        }

        .examples { display: flex; flex-direction: column; gap: 6px; }
        .example-btn {
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 9px;
          color: var(--muted2);
          font-family: 'Outfit', sans-serif;
          font-size: 11.5px;
          font-weight: 300;
          padding: 7px 11px;
          text-align: left;
          cursor: pointer;
          transition: all 0.18s;
          line-height: 1.4;
        }
        .example-btn:hover {
          border-color: var(--accent);
          color: var(--accent2);
          background: var(--accent-dim);
        }

        .style-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }
        .style-card {
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 11px;
          padding: 9px 11px;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          align-items: center;
          gap: 8px;
          user-select: none;
        }
        .style-card:hover { border-color: var(--border2); background: var(--card2); }
        .style-card.active { border-color: var(--accent); background: var(--accent-dim); }
        .style-icon { font-size: 14px; color: var(--accent); flex-shrink: 0; }
        .style-label { font-size: 11.5px; font-weight: 500; color: var(--muted2); }
        .style-card.active .style-label { color: var(--accent2); }

        .ratio-row { display: flex; gap: 7px; }
        .ratio-btn {
          flex: 1;
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 10px;
          padding: 8px 5px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all 0.18s;
          user-select: none;
        }
        .ratio-btn.active { border-color: var(--accent); background: var(--accent-dim); }
        .ratio-icon { font-size: 13px; color: var(--muted2); }
        .ratio-btn.active .ratio-icon { color: var(--accent); }
        .ratio-text { font-size: 9.5px; color: var(--muted); font-weight: 500; letter-spacing: 0.4px; }
        .ratio-btn.active .ratio-text { color: var(--accent2); }

        .generate-wrap {
          padding: 18px 22px 24px;
          margin-top: auto;
          flex-shrink: 0;
        }
        .generate-btn {
          width: 100%;
          padding: 15px;
          background: var(--accent);
          border: none;
          border-radius: 14px;
          color: #050508;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 19px;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
          box-shadow: 0 6px 28px var(--accent-glow);
        }
        .generate-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
          transition: left 0.4s;
        }
        .generate-btn:hover:not(:disabled)::before { left: 100%; }
        .generate-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 36px var(--accent-glow); }
        .generate-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        .main-header {
          padding: 18px 32px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--muted2);
          font-weight: 300;
        }
        .status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 8px var(--green);
          flex-shrink: 0;
          animation: blink 2s infinite;
        }
        .status-dot.loading {
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent-glow);
          animation: blink 0.8s infinite;
        }
        .history-badge {
          font-size: 11px;
          color: var(--muted2);
          background: var(--card);
          border: 1px solid var(--border2);
          padding: 4px 12px;
          border-radius: 100px;
        }

        .canvas-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 28px 32px;
          gap: 20px;
          overflow-y: auto;
          position: relative;
          scrollbar-width: none;
        }
        .canvas-area::-webkit-scrollbar { display: none; }

        .progress-track {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--border);
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent2));
          transition: width 0.3s ease;
          box-shadow: 0 0 10px var(--accent-glow);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          animation: fadeUp 0.5s ease both;
          text-align: center;
        }
        .empty-glyph { font-size: 52px; opacity: 0.18; line-height: 1; }
        .empty-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 17px;
          letter-spacing: 3.5px;
          color: var(--muted2);
          opacity: 0.5;
        }
        .empty-hint { font-size: 12px; color: var(--muted); font-weight: 300; opacity: 0.6; }

        .loading-box {
          width: 100%;
          max-width: 560px;
          aspect-ratio: 1 / 1;
          border-radius: 20px;
          background: var(--card);
          border: 1px solid var(--border2);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          position: relative;
          overflow: hidden;
        }
        .loading-box::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(232,193,74,0.05) 50%, transparent 70%);
          animation: shimmer 2s infinite;
        }

        .spinner {
          width: 38px; height: 38px;
          border: 2.5px solid var(--border2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .loading-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          letter-spacing: 3px;
          color: var(--accent);
          text-shadow: 0 0 30px var(--accent-glow);
          z-index: 1;
        }
        .loading-sub { font-size: 11.5px; color: var(--muted2); font-weight: 300; z-index: 1; }

        .error-box {
          background: rgba(255,85,85,0.07);
          border: 1px solid rgba(255,85,85,0.28);
          border-radius: 12px;
          padding: 14px 20px;
          font-size: 13px;
          color: var(--red);
          max-width: 500px;
          text-align: center;
          font-weight: 300;
          animation: fadeUp 0.3s ease both;
        }

        .image-frame {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          max-width: 560px;
          width: 100%;
          box-shadow: 0 28px 72px rgba(0,0,0,0.65), 0 0 0 1px var(--border2);
          animation: imageReveal 0.5s ease both;
          cursor: pointer;
        }
        .image-frame img { display: block; width: 100%; height: auto; }
        .img-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%);
          opacity: 0;
          transition: opacity 0.25s;
          display: flex;
          align-items: flex-end;
          padding: 18px;
          gap: 8px;
        }
        .image-frame:hover .img-overlay { opacity: 1; }
        .img-btn {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 9px;
          color: white;
          font-family: 'Outfit', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          padding: 7px 14px;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: all 0.18s;
        }
        .img-btn:hover { background: var(--accent); color: #050508; border-color: var(--accent); }

        .prompt-caption {
          max-width: 560px;
          width: 100%;
          text-align: center;
          font-size: 12.5px;
          color: var(--muted2);
          font-weight: 300;
          font-style: italic;
          line-height: 1.5;
          padding: 0 16px;
        }

        .history-strip {
          border-top: 1px solid var(--border);
          padding: 14px 28px;
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .history-strip::-webkit-scrollbar { display: none; }
        .history-label {
          font-size: 10px;
          color: var(--muted);
          font-weight: 500;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          align-self: center;
          flex-shrink: 0;
        }
        .history-thumb {
          flex-shrink: 0;
          width: 58px; height: 58px;
          border-radius: 9px;
          overflow: hidden;
          border: 1.5px solid var(--border);
          cursor: pointer;
          transition: all 0.18s;
        }
        .history-thumb:hover {
          border-color: var(--accent);
          transform: scale(1.06);
          box-shadow: 0 4px 16px var(--accent-glow);
        }
        .history-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

        /* ═══════════════════════════
           MOBILE LAYOUT (<768px)
        ═══════════════════════════ */
        .mobile-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .mobile-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
          background: var(--panel);
          flex-shrink: 0;
        }
        .mobile-brand {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px;
          letter-spacing: 4px;
          color: var(--accent);
          text-shadow: 0 0 30px var(--accent-glow);
        }
        .mobile-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--muted2);
        }

        .mobile-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          background: var(--panel);
          flex-shrink: 0;
        }
        .mobile-tab {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          color: var(--muted);
          font-family: 'Outfit', sans-serif;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .mobile-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        .mobile-create {
          flex: 1;
          overflow-y: auto;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          scrollbar-width: none;
        }
        .mobile-create::-webkit-scrollbar { display: none; }

        .m-label {
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }

        .mobile-textarea {
          width: 100%;
          background: var(--card);
          border: 1.5px solid var(--border2);
          border-radius: 14px;
          color: var(--text);
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 300;
          line-height: 1.7;
          padding: 14px 14px 40px;
          resize: none;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          min-height: 110px;
        }
        .mobile-textarea::placeholder { color: var(--muted); }
        .mobile-textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-dim);
        }

        .mobile-examples {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 4px;
        }
        .mobile-examples::-webkit-scrollbar { display: none; }
        .mobile-chip {
          flex-shrink: 0;
          background: var(--card);
          border: 1px solid var(--border2);
          border-radius: 100px;
          color: var(--muted2);
          font-family: 'Outfit', sans-serif;
          font-size: 11.5px;
          font-weight: 400;
          padding: 7px 14px;
          cursor: pointer;
          white-space: nowrap;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: all 0.18s;
        }
        .mobile-chip:active, .mobile-chip:hover {
          border-color: var(--accent);
          color: var(--accent2);
          background: var(--accent-dim);
        }

        .mobile-style-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .mobile-style-card {
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 12px;
          padding: 11px 8px;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          user-select: none;
        }
        .mobile-style-card.active { border-color: var(--accent); background: var(--accent-dim); }
        .m-style-icon { font-size: 18px; color: var(--accent); }
        .m-style-label { font-size: 10.5px; font-weight: 500; color: var(--muted2); }
        .mobile-style-card.active .m-style-label { color: var(--accent2); }

        .mobile-ratio {
          display: flex;
          gap: 8px;
        }
        .mobile-ratio-btn {
          flex: 1;
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 11px;
          padding: 10px 6px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          transition: all 0.18s;
          user-select: none;
        }
        .mobile-ratio-btn.active { border-color: var(--accent); background: var(--accent-dim); }
        .m-ratio-icon { font-size: 16px; color: var(--muted2); }
        .mobile-ratio-btn.active .m-ratio-icon { color: var(--accent); }
        .m-ratio-text { font-size: 10px; color: var(--muted); font-weight: 500; }
        .mobile-ratio-btn.active .m-ratio-text { color: var(--accent2); }

        .mobile-gen-bar {
          padding: 12px 16px env(safe-area-inset-bottom, 12px);
          border-top: 1px solid var(--border);
          background: var(--panel);
          flex-shrink: 0;
        }
        .mobile-gen-btn {
          width: 100%;
          padding: 15px;
          background: var(--accent);
          border: none;
          border-radius: 14px;
          color: #050508;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          letter-spacing: 2.5px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 6px 24px var(--accent-glow);
        }
        .mobile-gen-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .mobile-gen-btn:active:not(:disabled) { transform: scale(0.98); }

        .mobile-result {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 20px 16px 24px;
          scrollbar-width: none;
          position: relative;
        }
        .mobile-result::-webkit-scrollbar { display: none; }

        .m-progress-track {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--border);
        }
        .m-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent2));
          transition: width 0.3s ease;
          box-shadow: 0 0 10px var(--accent-glow);
        }

        .mobile-loading-box {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 18px;
          background: var(--card);
          border: 1px solid var(--border2);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          overflow: hidden;
          position: relative;
        }
        .mobile-loading-box::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(232,193,74,0.05) 50%, transparent 70%);
          animation: shimmer 2s infinite;
        }

        .mobile-image-frame {
          width: 100%;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid var(--border2);
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          animation: imageReveal 0.5s ease both;
        }
        .mobile-image-frame img { display: block; width: 100%; height: auto; }

        .mobile-action-row { display: flex; gap: 10px; width: 100%; }
        .mobile-action-btn {
          flex: 1;
          padding: 11px 8px;
          background: var(--card);
          border: 1.5px solid var(--border2);
          border-radius: 12px;
          color: var(--muted2);
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .mobile-action-btn:active { border-color: var(--accent); color: var(--accent2); background: var(--accent-dim); }

        .mobile-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          opacity: 0.35;
          text-align: center;
          margin-top: 60px;
        }

        .mobile-history-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          width: 100%;
          margin-top: 10px;
        }
        .mobile-history-thumb {
          aspect-ratio: 1;
          border-radius: 10px;
          overflow: hidden;
          border: 1.5px solid var(--border);
          cursor: pointer;
          transition: all 0.18s;
        }
        .mobile-history-thumb:active { border-color: var(--accent); transform: scale(0.95); }
        .mobile-history-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

        /* ═══════════════════════════
           RESPONSIVE SHOW/HIDE
        ═══════════════════════════ */
        @media (max-width: 767px) {
          .desktop-layout { display: none !important; }
          .mobile-layout { display: flex !important; }
        }
        @media (min-width: 768px) {
          .mobile-layout { display: none !important; }
          .desktop-layout { display: flex !important; }
        }

        /* Tablet (768–1024px) */
        @media (min-width: 768px) and (max-width: 1024px) {
          :root { --sidebar-w: 290px; }
          .brand-name { font-size: 26px; }
          .sidebar-section { padding: 15px 18px; }
          .generate-wrap { padding: 15px 18px 20px; }
          .main-header { padding: 15px 22px; }
          .canvas-area { padding: 20px 22px; }
          .history-strip { padding: 12px 22px; }
        }
      `}</style>

      {/* ══════════ DESKTOP ══════════ */}
      <div className="desktop-layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-name">RP VISION AI</div>
            <div className="brand-sub">AI Image Generator</div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">Describe Your Vision</div>
            <div className="prompt-wrapper">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, 500))}
                placeholder="A surreal landscape where ancient temples float above glowing neon oceans at dusk..."
                rows={5}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) generate(); }}
              />
              <span className="char-count">{prompt.length}/500</span>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">Quick Inspiration</div>
            <div className="examples">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button key={i} className="example-btn" onClick={() => setPrompt(p)}>✦ {p}</button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">Art Style</div>
            <div className="style-grid">
              {STYLE_PRESETS.map((s, i) => (
                <div key={i} className={`style-card ${selectedStyle === i ? "active" : ""}`}
                  onClick={() => setSelectedStyle(selectedStyle === i ? null : i)}>
                  <span className="style-icon">{s.icon}</span>
                  <span className="style-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">Aspect Ratio</div>
            <div className="ratio-row">
              {ASPECT_RATIOS.map((r, i) => (
                <div key={i} className={`ratio-btn ${selectedRatio === i ? "active" : ""}`}
                  onClick={() => setSelectedRatio(i)}>
                  <span className="ratio-icon">{r.icon}</span>
                  <span className="ratio-text">{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="generate-wrap">
            <button className="generate-btn" disabled={!prompt.trim() || loading} onClick={generate}>
              {loading ? "GENERATING..." : "✦ GENERATE IMAGE"}
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="main-header">
            <div className="status-row">
              <div className={`status-dot ${loading ? "loading" : ""}`} />
              {loading ? <><TypingDots />&nbsp; Crafting via Stable Diffusion XL</> : "Ready to create"}
            </div>
            {history.length > 0 && (
              <span className="history-badge">{history.length} image{history.length > 1 ? "s" : ""} created</span>
            )}
          </div>

          <div className="canvas-area">
            {loading && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}

            {!loading && !imageUrl && !error && (
              <div className="empty-state">
                <div className="empty-glyph">◈</div>
                <div className="empty-title">YOUR CANVAS AWAITS</div>
                <div className="empty-hint">Describe your vision in the sidebar and hit Generate</div>
              </div>
            )}

            {loading && (
              <div className="loading-box">
                <div className="spinner" />
                <div className="loading-title">CRAFTING YOUR IMAGE</div>
                <div className="loading-sub">This may take 10–30 seconds...</div>
              </div>
            )}

            {error && !loading && <div className="error-box">⚠ {error}</div>}

            {imageUrl && !loading && (
              <>
                <div className="image-frame">
                  <img src={imageUrl} alt="Generated" />
                  <div className="img-overlay">
                    <button className="img-btn" onClick={downloadImage}>↓ Download</button>
                    <button className="img-btn" onClick={() => { setImageUrl(null); setError(null); }}>✕ Clear</button>
                    <button className="img-btn" onClick={generate}>↻ Regenerate</button>
                  </div>
                </div>
                <div className="prompt-caption">"{prompt}"</div>
              </>
            )}
          </div>

          {history.length > 0 && (
            <div className="history-strip">
              <span className="history-label">History</span>
              {history.map((h, i) => (
                <div key={i} className="history-thumb" onClick={() => setImageUrl(h.url)} title={h.prompt}>
                  <img src={h.url} alt="" />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ══════════ MOBILE ══════════ */}
      <div className="mobile-layout">
        <div className="mobile-topbar">
          <div className="mobile-brand">RP VISION AI</div>
          <div className="mobile-status">
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: loading ? "var(--accent)" : "var(--green)",
              boxShadow: loading ? "0 0 7px var(--accent-glow)" : "0 0 7px var(--green)",
              animation: "blink 2s infinite"
            }} />
            {loading ? "Generating..." : "Ready"}
          </div>
        </div>

        <div className="mobile-tabs">
          <button className={`mobile-tab ${mobileTab === "create" ? "active" : ""}`} onClick={() => setMobileTab("create")}>
            ✦ Create
          </button>
          <button className={`mobile-tab ${mobileTab === "result" ? "active" : ""}`} onClick={() => setMobileTab("result")}>
            Result {history.length > 0 ? `(${history.length})` : ""}
          </button>
        </div>

        {/* CREATE TAB */}
        {mobileTab === "create" && (
          <>
            <div className="mobile-create">
              <div>
                <div className="m-label">Your Vision</div>
                <div className="prompt-wrapper">
                  <textarea
                    ref={textareaRef}
                    className="mobile-textarea"
                    value={prompt}
                    onChange={e => { setPrompt(e.target.value.slice(0, 500)); autoResize(); }}
                    placeholder="Describe what you want to create..."
                    rows={4}
                  />
                  <span className="char-count" style={{ bottom: 13, right: 13 }}>{prompt.length}/500</span>
                </div>
              </div>

              <div>
                <div className="m-label">Quick Inspiration</div>
                <div className="mobile-examples">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button key={i} className="mobile-chip" onClick={() => setPrompt(p)}>
                      ✦ {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="m-label">Art Style</div>
                <div className="mobile-style-grid">
                  {STYLE_PRESETS.map((s, i) => (
                    <div key={i} className={`mobile-style-card ${selectedStyle === i ? "active" : ""}`}
                      onClick={() => setSelectedStyle(selectedStyle === i ? null : i)}>
                      <span className="m-style-icon">{s.icon}</span>
                      <span className="m-style-label">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="m-label">Aspect Ratio</div>
                <div className="mobile-ratio">
                  {ASPECT_RATIOS.map((r, i) => (
                    <div key={i} className={`mobile-ratio-btn ${selectedRatio === i ? "active" : ""}`}
                      onClick={() => setSelectedRatio(i)}>
                      <span className="m-ratio-icon">{r.icon}</span>
                      <span className="m-ratio-text">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mobile-gen-bar">
              <button className="mobile-gen-btn" disabled={!prompt.trim() || loading} onClick={generate}>
                {loading ? "GENERATING..." : "✦ GENERATE IMAGE"}
              </button>
            </div>
          </>
        )}

        {/* RESULT TAB */}
        {mobileTab === "result" && (
          <div className="mobile-result">
            {loading && (
              <div className="m-progress-track">
                <div className="m-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}

            {!loading && !imageUrl && !error && (
              <div className="mobile-empty">
                <div style={{ fontSize: 48, opacity: 0.25 }}>◈</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: "var(--muted2)" }}>
                  NO IMAGE YET
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 300 }}>
                  Go to Create tab and generate
                </div>
              </div>
            )}

            {loading && (
              <div className="mobile-loading-box">
                <div className="spinner" />
                <div className="loading-title">CRAFTING YOUR IMAGE</div>
                <div className="loading-sub">10–30 seconds...</div>
              </div>
            )}

            {error && !loading && <div className="error-box">⚠ {error}</div>}

            {imageUrl && !loading && (
              <>
                <div className="mobile-image-frame">
                  <img src={imageUrl} alt="Generated" />
                </div>
                <div className="mobile-action-row">
                  <button className="mobile-action-btn" onClick={downloadImage}>↓ Save</button>
                  <button className="mobile-action-btn" onClick={() => { setImageUrl(null); setError(null); }}>✕ Clear</button>
                  <button className="mobile-action-btn" onClick={generate}>↻ Redo</button>
                </div>
                <div style={{
                  fontSize: 12, color: "var(--muted2)", fontStyle: "italic",
                  textAlign: "center", fontWeight: 300, lineHeight: 1.5, padding: "0 8px", width: "100%"
                }}>
                  "{prompt}"
                </div>
              </>
            )}

            {history.length > 0 && (
              <div style={{ width: "100%" }}>
                <div className="m-label">Recent History</div>
                <div className="mobile-history-grid">
                  {history.map((h, i) => (
                    <div key={i} className="mobile-history-thumb" onClick={() => setImageUrl(h.url)} title={h.prompt}>
                      <img src={h.url} alt="" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
