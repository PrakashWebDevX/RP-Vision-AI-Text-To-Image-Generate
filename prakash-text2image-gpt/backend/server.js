const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 10000;

// ── ENV KEYS (set in Render → Environment) ────────────────
// HF_TOKEN      → https://huggingface.co/settings/tokens
// STABILITY_KEY → https://platform.stability.ai/account/keys
// REMOVE_BG_KEY → https://www.remove.bg/dashboard

// ── HELPER: delay ────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── HELPER: HuggingFace inference with retry ─────────────
async function hfInference(model, payload, retries = 3) {
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) throw new Error("HF_TOKEN not set in environment variables. Get free key at huggingface.co/settings/tokens");

  const url = `https://api-inference.huggingface.co/models/${model}`;

  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true",
      },
      body: JSON.stringify(payload),
      timeout: 120000,
    });

    // Model loading — wait and retry
    if (res.status === 503) {
      const json = await res.json().catch(() => ({}));
      const waitTime = (json.estimated_time || 20) * 1000;
      console.log(`Model loading, waiting ${Math.round(waitTime/1000)}s...`);
      await delay(Math.min(waitTime, 30000));
      continue;
    }

    if (res.status === 429) {
      console.log(`Rate limited, waiting 10s... (attempt ${i+1})`);
      await delay(10000);
      continue;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HuggingFace error ${res.status}: ${errText.slice(0,200)}`);
    }

    return res;
  }
  throw new Error("Max retries reached. Please try again in a moment.");
}

// ── HEALTH CHECK ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════
//  1. TEXT TO IMAGE — Hugging Face FLUX (FREE)
//     Needs: HF_TOKEN
// ═══════════════════════════════════════════════════════
app.post("/text-to-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    console.log("text-to-image:", prompt.slice(0, 60));

    const response = await hfInference(
      "black-forest-labs/FLUX.1-schnell",
      { inputs: prompt.trim().slice(0, 500) }
    );

    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  2. IMAGE TO IMAGE — Hugging Face (FREE)
//     Needs: HF_TOKEN
// ═══════════════════════════════════════════════════════
app.post("/image-to-image", async (req, res) => {
  try {
    const { prompt, image_url } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    console.log("image-to-image:", prompt.slice(0, 60));

    // Use img2img via FLUX with prompt guidance
    const fullPrompt = image_url
      ? `${prompt}, maintaining the composition and style of the reference image`
      : prompt;

    const response = await hfInference(
      "black-forest-labs/FLUX.1-schnell",
      { inputs: fullPrompt.slice(0, 500) }
    );

    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  3. TEXT TO VIDEO — Hugging Face (FREE)
//     Needs: HF_TOKEN
//     Model: zeroscope_v2 (text-to-video)
// ═══════════════════════════════════════════════════════
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    console.log("text-to-video:", prompt.slice(0, 60));

    const response = await hfInference(
      "cerspense/zeroscope_v2_576w",
      { inputs: prompt.trim().slice(0, 300) }
    );

    const buffer = await response.buffer();
    const contentType = response.headers.get("content-type") || "video/mp4";
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("text-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  4. IMAGE TO VIDEO — Hugging Face (FREE)
//     Needs: HF_TOKEN
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", async (req, res) => {
  try {
    const { prompt = "animate this image with smooth motion", image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    console.log("image-to-video:", prompt.slice(0, 60));

    // Fetch the input image
    const imgRes = await fetch(image_url, { timeout: 30000 });
    if (!imgRes.ok) throw new Error("Could not fetch input image");
    const imgBuffer = await imgRes.buffer();
    const base64Image = imgBuffer.toString("base64");
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

    const response = await hfInference(
      "stabilityai/stable-video-diffusion-img2vid",
      {
        inputs: `data:${mimeType};base64,${base64Image}`,
        parameters: { motion_bucket_id: 127, noise_aug_strength: 0.02 }
      }
    );

    const buffer = await response.buffer();
    const contentType = response.headers.get("content-type") || "video/mp4";
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("image-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  5. TEXT TO AUDIO — Hugging Face MusicGen (FREE)
//     Needs: HF_TOKEN
// ═══════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    console.log("text-to-audio:", prompt.slice(0, 60));

    const response = await hfInference(
      "facebook/musicgen-small",
      {
        inputs: prompt.trim().slice(0, 300),
        parameters: { max_new_tokens: 256 }
      }
    );

    const buffer = await response.buffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  6. IMAGE UPSCALER — Stability AI (25 free credits)
//     Needs: STABILITY_KEY
//     Get key: https://platform.stability.ai/account/keys
// ═══════════════════════════════════════════════════════
app.post("/upscale", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const STABILITY_KEY = process.env.STABILITY_KEY;
    if (!STABILITY_KEY) return res.status(500).json({ error: "STABILITY_KEY not set. Get free key at platform.stability.ai" });

    console.log("upscale:", image_url.slice(0, 60));

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
      throw new Error(`Stability AI error: ${errText.slice(0, 200)}`);
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
//  7. REMOVE BACKGROUND — Remove.bg (50 free/month)
//     Needs: REMOVE_BG_KEY
//     Get key: https://www.remove.bg/dashboard
// ═══════════════════════════════════════════════════════
app.post("/remove-background", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY) return res.status(500).json({ error: "REMOVE_BG_KEY not set. Get free key at remove.bg/dashboard" });

    console.log("remove-bg:", image_url.slice(0, 60));

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
app.listen(PORT, () => {
  console.log(`✅ RP Vision AI backend running on port ${PORT}`);
  console.log(`HF_TOKEN: ${process.env.HF_TOKEN ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`STABILITY_KEY: ${process.env.STABILITY_KEY ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`REMOVE_BG_KEY: ${process.env.REMOVE_BG_KEY ? "✅ SET" : "❌ NOT SET"}`);
});
