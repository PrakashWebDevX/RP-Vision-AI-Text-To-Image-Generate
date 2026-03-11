const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3001;

// ── HELPER: fetch with retry ──────────────────────────────
async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { timeout: 90000, ...options });
      if (res.ok) return res;
      if (res.status === 500 && i < retries - 1) {
        console.log(`Retry ${i + 1}/${retries} after 500 error...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Retry ${i + 1}/${retries} after error: ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// ── HEALTH CHECK ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════
//  1. TEXT TO IMAGE  — Pollinations (FREE)
// ═══════════════════════════════════════════════════════
app.post("/text-to-image", async (req, res) => {
  try {
    const { prompt, width = 1024, height = 1024 } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    // Clean + shorten prompt to avoid 500s
    const cleanPrompt = prompt.trim().slice(0, 300);
    const seed = Math.floor(Math.random() * 999999);

    // Build URL carefully
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      model: "flux",
      nologo: "true",
      enhance: "true",
      seed: String(seed),
    });

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?${params}`;
    console.log("Fetching:", url.slice(0, 100) + "...");

    const response = await fetchWithRetry(url);
    const buffer = await response.buffer();

    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-image error:", err.message);
    res.status(500).json({ error: "Image generation failed. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════
//  2. IMAGE TO IMAGE  — Pollinations (FREE)
// ═══════════════════════════════════════════════════════
app.post("/image-to-image", async (req, res) => {
  try {
    const { prompt, image_url } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const cleanPrompt = `${prompt.trim().slice(0, 200)}, style transfer from reference image`.slice(0, 300);
    const seed = Math.floor(Math.random() * 999999);

    const params = new URLSearchParams({
      width: "1024", height: "1024", model: "flux",
      nologo: "true", enhance: "true", seed: String(seed),
    });

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?${params}`;
    const response = await fetchWithRetry(url);
    const buffer = await response.buffer();

    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-image error:", err.message);
    res.status(500).json({ error: "Image transformation failed. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════
//  3. TEXT TO VIDEO  — Pollinations flux-animation (FREE)
// ═══════════════════════════════════════════════════════
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const cleanPrompt = prompt.trim().slice(0, 200);
    const seed = Math.floor(Math.random() * 999999);

    const params = new URLSearchParams({
      model: "flux-animation", width: "512", height: "512",
      nologo: "true", seed: String(seed),
    });

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?${params}`;
    const response = await fetchWithRetry(url, {}, 3, 3000);
    const contentType = response.headers.get("content-type") || "image/gif";
    const buffer = await response.buffer();

    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("text-to-video error:", err.message);
    res.status(500).json({ error: "Video generation failed. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════
//  4. IMAGE TO VIDEO  — Pollinations (FREE)
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", async (req, res) => {
  try {
    const { prompt = "animate this smoothly", image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const cleanPrompt = prompt.trim().slice(0, 200);
    const seed = Math.floor(Math.random() * 999999);

    const params = new URLSearchParams({
      model: "flux-animation", width: "512", height: "512",
      nologo: "true", seed: String(seed),
    });

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?${params}`;
    const response = await fetchWithRetry(url, {}, 3, 3000);
    const contentType = response.headers.get("content-type") || "image/gif";
    const buffer = await response.buffer();

    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("image-to-video error:", err.message);
    res.status(500).json({ error: "Video generation failed. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════
//  5. TEXT TO AUDIO  — Pollinations (FREE)
// ═══════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt, voice = "alloy" } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const cleanPrompt = prompt.trim().slice(0, 200);
    const url = `https://audio.pollinations.ai/${encodeURIComponent(cleanPrompt)}?model=openai-audio&voice=${voice}`;

    const response = await fetchWithRetry(url);
    const contentType = response.headers.get("content-type") || "audio/mpeg";
    const buffer = await response.buffer();

    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.status(500).json({ error: "Audio generation failed. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════
//  6. IMAGE UPSCALER  — Stability AI
//     Get free key: https://platform.stability.ai/account/keys
// ═══════════════════════════════════════════════════════
app.post("/upscale", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const STABILITY_KEY = process.env.STABILITY_KEY;

    if (!STABILITY_KEY) {
      // Fallback: return original image
      const imgRes = await fetch(image_url, { timeout: 30000 });
      if (!imgRes.ok) throw new Error("Could not fetch source image");
      const buffer = await imgRes.buffer();
      res.set("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
      return res.send(buffer);
    }

    const imgRes = await fetch(image_url, { timeout: 30000 });
    if (!imgRes.ok) throw new Error("Could not fetch source image");
    const imgBuffer = await imgRes.buffer();
    const imgContentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = imgContentType.includes("png") ? "png" : "jpg";

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

// ═══════════════════════════════════════════════════════
//  7. REMOVE BACKGROUND  — Remove.bg
//     Get free key: https://www.remove.bg/dashboard
// ═══════════════════════════════════════════════════════
app.post("/remove-background", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY) return res.status(500).json({ error: "REMOVE_BG_KEY not set in environment variables" });

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
      throw new Error(errData.errors?.[0]?.title || `Remove.bg error ${response.status}`);
    }

    const buffer = await response.buffer();
    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error("remove-bg error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
app.listen(PORT, () => console.log(`✅ RP Vision AI backend running on port ${PORT}`));
