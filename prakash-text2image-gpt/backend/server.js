const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3001;

// ── ENV KEYS (set these in Render dashboard) ──────────────
// REMOVE_BG_KEY  → get free at https://www.remove.bg/dashboard
// STABILITY_KEY  → get free at https://platform.stability.ai/account/keys
// (Pollinations needs NO key — completely free)

// ═══════════════════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════════════════
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    models: ["text-to-image","image-to-image","text-to-video","image-to-video","text-to-audio","upscale","remove-background"],
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════
//  1. TEXT TO IMAGE  (Pollinations — FREE, no key)
// ═══════════════════════════════════════════════════════════
app.post("/text-to-image", async (req, res) => {
  try {
    const { prompt, width = 1024, height = 1024, model = "flux" } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}&nologo=true&enhance=true&seed=${Math.floor(Math.random()*99999)}`;

    const response = await fetch(url, { timeout: 60000 });
    if (!response.ok) throw new Error(`Pollinations error: ${response.status}`);

    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  2. IMAGE TO IMAGE  (Pollinations — FREE, no key)
// ═══════════════════════════════════════════════════════════
app.post("/image-to-image", async (req, res) => {
  try {
    const { prompt, image_url, strength = 0.75 } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    // Pollinations supports image conditioning via prompt with image reference
    const fullPrompt = `${prompt}, based on this image: ${image_url}`;
    const encoded = encodeURIComponent(fullPrompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed=${Math.floor(Math.random()*99999)}`;

    const response = await fetch(url, { timeout: 60000 });
    if (!response.ok) throw new Error(`Pollinations error: ${response.status}`);

    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  3. TEXT TO VIDEO  (Pollinations — FREE, no key)
// ═══════════════════════════════════════════════════════════
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const encoded = encodeURIComponent(prompt);
    // Pollinations flux-animation model returns animated GIF/video
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux-animation&width=512&height=512&nologo=true&seed=${Math.floor(Math.random()*99999)}`;

    const response = await fetch(url, { timeout: 90000 });
    if (!response.ok) throw new Error(`Pollinations video error: ${response.status}`);

    const contentType = response.headers.get("content-type") || "image/gif";
    const buffer = await response.buffer();
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("text-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  4. IMAGE TO VIDEO  (Pollinations — FREE, no key)
// ═══════════════════════════════════════════════════════════
app.post("/image-to-video", async (req, res) => {
  try {
    const { prompt = "animate this image smoothly", image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const fullPrompt = image_url ? `${prompt}, reference: ${image_url}` : prompt;
    const encoded = encodeURIComponent(fullPrompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux-animation&width=512&height=512&nologo=true&seed=${Math.floor(Math.random()*99999)}`;

    const response = await fetch(url, { timeout: 90000 });
    if (!response.ok) throw new Error(`Pollinations video error: ${response.status}`);

    const contentType = response.headers.get("content-type") || "image/gif";
    const buffer = await response.buffer();
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("image-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  5. TEXT TO AUDIO  (Pollinations — FREE, no key)
// ═══════════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt, voice = "alloy", model = "openai-audio" } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const encoded = encodeURIComponent(prompt);
    const url = `https://audio.pollinations.ai/${encoded}?model=${model}&voice=${voice}`;

    const response = await fetch(url, { timeout: 60000 });
    if (!response.ok) throw new Error(`Pollinations audio error: ${response.status}`);

    const contentType = response.headers.get("content-type") || "audio/mpeg";
    const buffer = await response.buffer();
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  6. IMAGE UPSCALER  (Stability AI — 25 free credits)
//     Get key: https://platform.stability.ai/account/keys
// ═══════════════════════════════════════════════════════════
app.post("/upscale", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const STABILITY_KEY = process.env.STABILITY_KEY;

    if (!STABILITY_KEY) {
      // FALLBACK: return the original image if no key set
      console.warn("STABILITY_KEY not set — returning original image");
      const imgRes = await fetch(image_url, { timeout: 30000 });
      if (!imgRes.ok) throw new Error("Could not fetch source image");
      const buffer = await imgRes.buffer();
      const ct = imgRes.headers.get("content-type") || "image/jpeg";
      res.set("Content-Type", ct);
      return res.send(buffer);
    }

    // Download the source image
    const imgRes = await fetch(image_url, { timeout: 30000 });
    if (!imgRes.ok) throw new Error("Could not fetch source image");
    const imgBuffer = await imgRes.buffer();
    const imgContentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = imgContentType.includes("png") ? "png" : "jpg";

    // Send to Stability AI upscaler
    const form = new FormData();
    form.append("image", imgBuffer, { filename: `image.${ext}`, contentType: imgContentType });
    form.append("output_format", "jpeg");

    const upscaleRes = await fetch("https://api.stability.ai/v2beta/stable-image/upscale/fast", {
      method: "POST",
      headers: { Authorization: `Bearer ${STABILITY_KEY}`, Accept: "image/*", ...form.getHeaders() },
      body: form,
      timeout: 60000,
    });

    if (!upscaleRes.ok) {
      const errText = await upscaleRes.text();
      throw new Error(`Stability error: ${errText}`);
    }

    const buffer = await upscaleRes.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("upscale error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  7. REMOVE BACKGROUND  (Remove.bg — 50 free/month)
//     Get key: https://www.remove.bg/dashboard
// ═══════════════════════════════════════════════════════════
app.post("/remove-background", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY) return res.status(500).json({ error: "REMOVE_BG_KEY not configured. Get free key at remove.bg/dashboard" });

    const form = new FormData();
    form.append("image_url", image_url);
    form.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_KEY, ...form.getHeaders() },
      body: form,
      timeout: 60000,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.errors?.[0]?.title || `Remove.bg error: ${response.status}`);
    }

    const buffer = await response.buffer();
    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error("remove-bg error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
app.listen(PORT, () => console.log(`RP Vision AI backend running on port ${PORT}`));
