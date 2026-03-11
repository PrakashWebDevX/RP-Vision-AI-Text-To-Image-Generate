const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 10000;

// ── HELPER: delay ────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── HELPER: HuggingFace inference with retry ─────────────
async function hfInference(model, payload, retries = 3) {
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) throw new Error("HF_TOKEN not set in environment variables.");

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
  throw new Error("Max retries reached. Please try again in a moment.");
}

// ── HEALTH CHECK ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
//  2. IMAGE TO IMAGE — accepts uploaded file
// ═══════════════════════════════════════════════════════
app.post("/image-to-image", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!req.file) return res.status(400).json({ error: "Image file is required" });

    console.log("image-to-image:", prompt.slice(0, 60));

    const fullPrompt = `${prompt}, maintaining the composition and style of the reference image`.slice(0, 500);

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
//  4. IMAGE TO VIDEO — accepts uploaded file
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", upload.single("image"), async (req, res) => {
  try {
    const prompt = (req.body.prompt || "animate with smooth cinematic motion").trim();
    if (!req.file) return res.status(400).json({ error: "Image file is required" });

    console.log("image-to-video:", prompt.slice(0, 60));

    const videoPrompt = `${prompt}, dynamic motion, cinematic video frame, action scene, 4k film`.slice(0, 500);

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
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set.");

    const cleanPrompt = prompt.trim().slice(0, 100);
    console.log("text-to-audio:", cleanPrompt);

    const MODELS = [
      {
        url: "https://router.huggingface.co/hf-inference/models/microsoft/speecht5_tts",
        body: { inputs: cleanPrompt },
        type: "audio/flac",
      },
      {
        url: "https://router.huggingface.co/hf-inference/models/facebook/mms-tts-eng",
        body: { inputs: cleanPrompt },
        type: "audio/wav",
      },
      {
        url: "https://router.huggingface.co/hf-inference/models/kakao-enterprise/vits-ljs",
        body: { inputs: cleanPrompt },
        type: "audio/flac",
      },
    ];

    for (const model of MODELS) {
      try {
        console.log("Trying:", model.url);
        const r = await fetch(model.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(model.body),
          timeout: 60000,
        });

        console.log("Status:", r.status);

        if (r.status === 503) {
          console.log("Model loading, waiting 20s...");
          await delay(20000);
          const r2 = await fetch(model.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(model.body),
            timeout: 60000,
          });
          if (r2.ok) {
            const buffer = await r2.buffer();
            console.log("Audio success after retry! Bytes:", buffer.length);
            res.set("Content-Type", model.type);
            return res.send(buffer);
          }
        }

        if (r.ok) {
          const buffer = await r.buffer();
          console.log("Audio success! Bytes:", buffer.length);
          res.set("Content-Type", model.type);
          return res.send(buffer);
        }

        const errBody = await r.text().catch(() => "");
        console.log("Failed:", r.status, errBody.slice(0, 100));
      } catch (e) {
        console.log("Model error:", e.message);
      }
    }

    throw new Error("Audio generation failed. All models unavailable. Please try again later.");
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  6. IMAGE UPSCALER — accepts uploaded file
// ═══════════════════════════════════════════════════════
app.post("/upscale", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Image file is required" });

    const STABILITY_KEY = process.env.STABILITY_KEY;
    if (!STABILITY_KEY) return res.status(500).json({ error: "STABILITY_KEY not set. Get free key at platform.stability.ai" });

    console.log("upscale: received file", req.file.originalname);

    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";

    const form = new FormData();
    form.append("image", req.file.buffer, {
      filename: `image.${ext}`,
      contentType: req.file.mimetype,
    });
    form.append("output_format", "jpeg");

    const upscaleRes = await fetch("https://api.stability.ai/v2beta/stable-image/upscale/fast", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STABILITY_KEY}`,
        Accept: "image/*",
        ...form.getHeaders(),
      },
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
//  7. REMOVE BACKGROUND — accepts uploaded file
// ═══════════════════════════════════════════════════════
app.post("/remove-background", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Image file is required" });

    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY) return res.status(500).json({ error: "REMOVE_BG_KEY not set. Get free key at remove.bg/dashboard" });

    console.log("remove-bg: received file", req.file.originalname);

    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";

    const form = new FormData();
    form.append("image_file", req.file.buffer, {
      filename: `image.${ext}`,
      contentType: req.file.mimetype,
    });
    form.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": REMOVE_BG_KEY,
        ...form.getHeaders(),
      },
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
