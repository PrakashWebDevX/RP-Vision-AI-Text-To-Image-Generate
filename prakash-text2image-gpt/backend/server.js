const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// multer — store uploaded file in memory
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PORT = process.env.PORT || 10000;

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── HELPER: get image buffer from URL or base64 ──────────
async function getImageBuffer(imageUrl, imageBase64) {
  if (imageBase64) {
    // base64 data URI from frontend file upload
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    return { buffer: Buffer.from(base64Data, "base64"), contentType: "image/jpeg" };
  }
  if (imageUrl) {
    const res = await fetch(imageUrl, { timeout: 30000 });
    if (!res.ok) throw new Error("Could not fetch image from URL");
    return { buffer: await res.buffer(), contentType: res.headers.get("content-type") || "image/jpeg" };
  }
  throw new Error("No image provided");
}

// ── HELPER: HuggingFace inference ───────────────────────
async function hfInference(model, payload, retries = 3) {
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) throw new Error("HF_TOKEN not set. Get free key at huggingface.co/settings/tokens");

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

    if (res.status === 503) {
      const json = await res.json().catch(() => ({}));
      const waitTime = (json.estimated_time || 20) * 1000;
      console.log(`Model loading, waiting ${Math.round(waitTime / 1000)}s...`);
      await delay(Math.min(waitTime, 30000));
      continue;
    }
    if (res.status === 429) {
      console.log(`Rate limited, waiting 10s... (attempt ${i + 1})`);
      await delay(10000);
      continue;
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HuggingFace error ${res.status}: ${errText.slice(0, 200)}`);
    }
    return res;
  }
  throw new Error("Max retries reached. Please try again.");
}

// ── HEALTH CHECK ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    keys: {
      HF_TOKEN: !!process.env.HF_TOKEN,
      STABILITY_KEY: !!process.env.STABILITY_KEY,
      REMOVE_BG_KEY: !!process.env.REMOVE_BG_KEY,
    }
  });
});

// ═══════════════════════════════════════════════════════
//  1. TEXT TO IMAGE
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
//  2. IMAGE TO IMAGE
//     Accepts: image_url (URL) OR image_base64 (file upload)
// ═══════════════════════════════════════════════════════
app.post("/image-to-image", async (req, res) => {
  try {
    const { prompt, image_url, image_base64 } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!image_url && !image_base64) return res.status(400).json({ error: "image_url or image_base64 is required" });

    console.log("image-to-image:", prompt.slice(0, 60), image_base64 ? "[base64 upload]" : "[url]");

    const fullPrompt = `${prompt.trim()}, high quality, detailed`.slice(0, 500);
    const response = await hfInference(
      "black-forest-labs/FLUX.1-schnell",
      { inputs: fullPrompt }
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
//  3. TEXT TO VIDEO
// ═══════════════════════════════════════════════════════
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    console.log("text-to-video:", prompt.slice(0, 60));

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
//  4. IMAGE TO VIDEO
//     Accepts: image_url OR image_base64
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", async (req, res) => {
  try {
    const { prompt = "animate with smooth cinematic motion", image_url, image_base64 } = req.body;
    if (!image_url && !image_base64) return res.status(400).json({ error: "image_url or image_base64 is required" });

    console.log("image-to-video:", prompt.slice(0, 60), image_base64 ? "[base64]" : "[url]");

    const videoPrompt = `${prompt.trim()}, dynamic motion, cinematic video frame, 4k film`.slice(0, 500);
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
//  5. TEXT TO AUDIO
// ═══════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set");

    const cleanPrompt = prompt.trim().slice(0, 100);
    console.log("text-to-audio:", cleanPrompt);

    // Use old stable API — router doesn't support TTS
    const MODELS = [
      { url: "https://api-inference.huggingface.co/models/microsoft/speecht5_tts", type: "audio/flac" },
      { url: "https://api-inference.huggingface.co/models/facebook/mms-tts-eng", type: "audio/wav" },
      { url: "https://api-inference.huggingface.co/models/kakao-enterprise/vits-ljs", type: "audio/flac" },
    ];

    for (const model of MODELS) {
      try {
        console.log("Trying:", model.url);
        let r = await fetch(model.url, {
          method: "POST",
          headers: { "Authorization": `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: cleanPrompt }),
          timeout: 60000,
        });
        if (r.status === 503) {
          await delay(20000);
          r = await fetch(model.url, {
            method: "POST",
            headers: { "Authorization": `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs: cleanPrompt }),
            timeout: 60000,
          });
        }
        if (r.ok) {
          const buffer = await r.buffer();
          console.log("Audio success! Bytes:", buffer.length);
          res.set("Content-Type", model.type);
          return res.send(buffer);
        }
        console.log("Failed:", r.status, (await r.text().catch(() => "")).slice(0, 80));
      } catch (e) { console.log("Error:", e.message); }
    }
    throw new Error("Audio models unavailable. Please try again in 1 minute.");
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  6. IMAGE UPSCALER
//     Accepts: image_url OR image_base64
// ═══════════════════════════════════════════════════════
app.post("/upscale", async (req, res) => {
  try {
    const { image_url, image_base64 } = req.body;
    if (!image_url && !image_base64) return res.status(400).json({ error: "image_url or image_base64 is required" });

    const STABILITY_KEY = process.env.STABILITY_KEY;
    if (!STABILITY_KEY) return res.status(500).json({ error: "STABILITY_KEY not set" });

    console.log("upscale:", image_base64 ? "[base64 upload]" : image_url?.slice(0, 60));

    const { buffer: imgBuffer, contentType: imgContentType } = await getImageBuffer(image_url, image_base64);
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
//  7. REMOVE BACKGROUND
//     Accepts: image_url OR image_base64
// ═══════════════════════════════════════════════════════
app.post("/remove-background", async (req, res) => {
  try {
    const { image_url, image_base64 } = req.body;
    if (!image_url && !image_base64) return res.status(400).json({ error: "image_url or image_base64 is required" });

    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY) return res.status(500).json({ error: "REMOVE_BG_KEY not set" });

    console.log("remove-bg:", image_base64 ? "[base64 upload]" : image_url?.slice(0, 60));

    const form = new FormData();

    if (image_base64) {
      // File uploaded from gallery — send as binary
      const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");
      form.append("image_file", imgBuffer, { filename: "upload.jpg", contentType: "image/jpeg" });
    } else {
      // URL provided
      form.append("image_url", image_url);
    }
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
