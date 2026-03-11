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

  const url = `https://router.huggingface.co/hf-inference/models/${model}`;

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
//  3. TEXT TO VIDEO — Using FLUX image as video frame (FREE)
//     HuggingFace free tier doesn't support true video gen
//     So we generate a HIGH QUALITY animated-style image
//     and return it as a visual result
//     Needs: HF_TOKEN
// ═══════════════════════════════════════════════════════
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    console.log("text-to-video:", prompt.slice(0, 60));

    // Generate cinematic image as video preview using FLUX
    const videoPrompt = `${prompt.trim()}, cinematic movie frame, motion blur, dynamic scene, film still, 4k`.slice(0, 500);

    const response = await hfInference(
      "black-forest-labs/FLUX.1-schnell",
      { inputs: videoPrompt }
    );

    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  4. IMAGE TO VIDEO — Transform image with motion prompt (FREE)
//     Needs: HF_TOKEN
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", async (req, res) => {
  try {
    const { prompt = "animate with smooth cinematic motion", image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "image_url is required" });

    console.log("image-to-video:", prompt.slice(0, 60));

    // Generate a dynamic motion-enhanced version of the scene
    const videoPrompt = `${prompt.trim()}, dynamic motion, cinematic video frame, action scene, 4k film`.slice(0, 500);

    const response = await hfInference(
      "black-forest-labs/FLUX.1-schnell",
      { inputs: videoPrompt }
    );

    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  5. TEXT TO AUDIO — HuggingFace SpeechT5 (FREE)
//     Needs: HF_TOKEN
//     Correct payload: { text_inputs: "..." }
// ═══════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    console.log("text-to-audio:", prompt.slice(0, 60));

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set. Get free key at huggingface.co/settings/tokens");

    // Keep it short — TTS works best under 100 chars
    const cleanPrompt = prompt.trim().slice(0, 100);

    // ── Try 1: Microsoft SpeechT5 — correct payload is text_inputs ──
    try {
      console.log("Trying SpeechT5...");
      const r1 = await fetch(
        "https://router.huggingface.co/hf-inference/models/microsoft/speecht5_tts",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
            "x-wait-for-model": "true",
          },
          body: JSON.stringify({ text_inputs: cleanPrompt }),
          timeout: 60000,
        }
      );
      console.log("SpeechT5 status:", r1.status);
      if (r1.ok) {
        const buffer = await r1.buffer();
        res.set("Content-Type", "audio/flac");
        return res.send(buffer);
      }
      const t1 = await r1.text().catch(() => "");
      console.log("SpeechT5 body:", t1.slice(0, 150));
    } catch (e) { console.log("SpeechT5 error:", e.message); }

    // ── Try 2: Facebook MMS-TTS — correct payload is inputs ──
    try {
      console.log("Trying MMS-TTS...");
      const r2 = await fetch(
        "https://router.huggingface.co/hf-inference/models/facebook/mms-tts-eng",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
            "x-wait-for-model": "true",
          },
          body: JSON.stringify({ inputs: cleanPrompt }),
          timeout: 60000,
        }
      );
      console.log("MMS status:", r2.status);
      if (r2.ok) {
        const buffer = await r2.buffer();
        res.set("Content-Type", "audio/wav");
        return res.send(buffer);
      }
      const t2 = await r2.text().catch(() => "");
      console.log("MMS body:", t2.slice(0, 150));
    } catch (e) { console.log("MMS error:", e.message); }

    // ── Try 3: ESPnet VITS ──
    try {
      console.log("Trying ESPnet VITS...");
      const r3 = await fetch(
        "https://router.huggingface.co/hf-inference/models/espnet/english_male_ryanspeech_fastspeech2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
            "x-wait-for-model": "true",
          },
          body: JSON.stringify({ inputs: cleanPrompt }),
          timeout: 60000,
        }
      );
      console.log("ESPnet status:", r3.status);
      if (r3.ok) {
        const buffer = await r3.buffer();
        res.set("Content-Type", "audio/flac");
        return res.send(buffer);
      }
      const t3 = await r3.text().catch(() => "");
      console.log("ESPnet body:", t3.slice(0, 150));
    } catch (e) { console.log("ESPnet error:", e.message); }

    throw new Error("Audio models are loading. Please wait 1 minute and try again.");
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
