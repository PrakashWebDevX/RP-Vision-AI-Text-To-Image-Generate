const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// multer — memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const PORT = process.env.PORT || 10000;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── HuggingFace inference helper ─────────────────────────
async function hfInference(model, payload, retries = 3) {
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN)
    throw new Error(
      "HF_TOKEN not set. Get free key at huggingface.co/settings/tokens"
    );
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
      throw new Error(
        `HuggingFace error ${res.status}: ${errText.slice(0, 200)}`
      );
    }
    return res;
  }
  throw new Error("Max retries reached. Please try again.");
}

// ── HEALTH ────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    HF_TOKEN: !!process.env.HF_TOKEN,
    STABILITY_KEY: !!process.env.STABILITY_KEY,
    REMOVE_BG_KEY: !!process.env.REMOVE_BG_KEY,
    RAZORPAY: !!process.env.RAZORPAY_KEY_ID,
  });
});

// ═══════════════════════════════════════════════════════
//  1. TEXT TO IMAGE — HuggingFace FLUX (unchanged, working)
// ═══════════════════════════════════════════════════════
app.post("/text-to-image", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    console.log("text-to-image:", prompt.slice(0, 60));

    // Support multiple HF models
    const hfModel = model || "black-forest-labs/FLUX.1-schnell";

    const response = await hfInference(hfModel, {
      inputs: prompt.trim().slice(0, 500),
    });
    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  2. IMAGE TO IMAGE — FIXED: properly passes image to HF
// ═══════════════════════════════════════════════════════
app.post("/image-to-image", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "transform this image, high quality";
    console.log(
      "image-to-image:",
      prompt.slice(0, 60),
      req.file ? "[file uploaded]" : "[no file]"
    );

    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    // Convert uploaded image to base64
    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const fullPrompt = `${prompt.trim()}, high quality, detailed`.slice(0, 500);

    // Use img2img model on HuggingFace
    const response = await hfInference(
      "stabilityai/stable-diffusion-xl-refiner-1.0",
      {
        inputs: fullPrompt,
        parameters: {
          image: dataUri,
          strength: 0.7,
          num_inference_steps: 20,
        },
      }
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
//  3. TEXT TO VIDEO — FIXED: Uses Pollinations AI (FREE!)
//     Returns actual MP4 video, not a JPEG image
// ═══════════════════════════════════════════════════════
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt, model, duration } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    console.log("text-to-video:", prompt.slice(0, 60));

    // Pollinations video models (all 100% free, no key needed!)
    const videoModel = model || "wan-fast"; // wan-fast | seedance | veo | nova-reel | grok-video-pro
    const videoDuration = duration || 5;   // 5 or 10 seconds
    const seed = Math.floor(Math.random() * 999999);

    const encodedPrompt = encodeURIComponent(
      prompt.trim().slice(0, 500)
    );

    // Pollinations video API — FREE & UNLIMITED
    const videoUrl = `https://video.pollinations.ai/prompt/${encodedPrompt}?model=${videoModel}&duration=${videoDuration}&seed=${seed}&nologo=true`;

    console.log("Fetching from Pollinations video:", videoUrl.slice(0, 100));

    const videoRes = await fetch(videoUrl, {
      timeout: 180000, // 3 min timeout for video generation
    });

    if (!videoRes.ok) {
      throw new Error(`Pollinations video error: ${videoRes.status}`);
    }

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const buffer = await videoRes.buffer();

    if (buffer.length < 1000) {
      throw new Error("Video generation returned empty response. Try again.");
    }

    console.log(`✅ Video generated: ${buffer.length} bytes`);
    res.set("Content-Type", contentType.includes("video") ? contentType : "video/mp4");
    res.set("Content-Length", buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error("text-to-video error:", err.message);

    // Fallback to wan-fast model
    try {
      console.log("Trying fallback wan-fast model...");
      const fallbackUrl = `https://video.pollinations.ai/prompt/${encodeURIComponent(
        req.body.prompt.slice(0, 300)
      )}?model=wan-fast&duration=5&seed=${Date.now()}`;

      const fallbackRes = await fetch(fallbackUrl, { timeout: 120000 });
      if (fallbackRes.ok) {
        const buffer = await fallbackRes.buffer();
        res.set("Content-Type", "video/mp4");
        res.send(buffer);
        return;
      }
    } catch (fallbackErr) {
      console.error("Fallback also failed:", fallbackErr.message);
    }

    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  4. IMAGE TO VIDEO — FIXED: Uses Stable Video Diffusion
//     via HuggingFace (actual video from image!)
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "animate with smooth cinematic motion";
    console.log(
      "image-to-video:",
      prompt.slice(0, 60),
      req.file ? "[file uploaded]" : "[no file]"
    );

    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    // Use Stable Video Diffusion on HuggingFace
    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set");

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-video-diffusion-img2vid-xt",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true",
        },
        body: JSON.stringify({
          inputs: `data:${mimeType};base64,${base64Image}`,
          parameters: {
            num_frames: 25,
            fps: 7,
          },
        }),
        timeout: 180000,
      }
    );

    if (response.status === 503) {
      // Model loading — wait and return error asking to retry
      return res.status(503).json({
        error: "Model is loading, please retry in 30 seconds.",
        retry: true,
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`HuggingFace SVD error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get("content-type") || "video/mp4";

    console.log(`✅ Image-to-video generated: ${buffer.length} bytes`);
    res.set("Content-Type", contentType);
    res.send(buffer);

  } catch (err) {
    console.error("image-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  5. TEXT TO AUDIO — FIXED: Uses HuggingFace MusicGen
//     Returns actual MP3 audio for music/sound
// ═══════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    console.log("text-to-audio:", prompt.slice(0, 60));

    if (type === "speech") {
      // For speech: return text for browser Web Speech API
      return res.json({
        success: true,
        type: "speech",
        text: prompt.trim().slice(0, 300),
        message: "Use browser Web Speech API",
      });
    }

    // For music: use HuggingFace MusicGen (FREE)
    const response = await hfInference(
      "facebook/musicgen-small",
      {
        inputs: prompt.trim().slice(0, 300),
        parameters: {
          max_new_tokens: 256,
        },
      }
    );

    const buffer = await response.buffer();
    console.log(`✅ Audio generated: ${buffer.length} bytes`);
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error("text-to-audio error:", err.message);

    // Fallback: return text for browser TTS
    res.json({
      success: true,
      type: "speech",
      text: req.body.prompt?.trim().slice(0, 300) || "",
      message: "Audio model unavailable, use browser TTS",
      fallback: true,
    });
  }
});

// ═══════════════════════════════════════════════════════
//  6. IMAGE UPSCALER — unchanged, working correctly
// ═══════════════════════════════════════════════════════
app.post("/upscale", upload.single("image"), async (req, res) => {
  try {
    const STABILITY_KEY = process.env.STABILITY_KEY;
    if (!STABILITY_KEY)
      return res.status(500).json({ error: "STABILITY_KEY not set" });
    if (!req.file)
      return res.status(400).json({ error: "Image file is required" });

    console.log(
      "upscale: [file uploaded]",
      req.file.originalname,
      req.file.size,
      "bytes"
    );

    const form = new FormData();
    form.append("image", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });
    form.append("output_format", "jpeg");

    const upscaleRes = await fetch(
      "https://api.stability.ai/v2beta/stable-image/upscale/fast",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STABILITY_KEY}`,
          Accept: "image/*",
          ...form.getHeaders(),
        },
        body: form,
        timeout: 60000,
      }
    );

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
//  7. REMOVE BACKGROUND — unchanged, working correctly
// ═══════════════════════════════════════════════════════
app.post("/remove-background", upload.single("image"), async (req, res) => {
  try {
    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY)
      return res.status(500).json({ error: "REMOVE_BG_KEY not set" });
    if (!req.file)
      return res.status(400).json({ error: "Image file is required" });

    console.log(
      "remove-bg: [file uploaded]",
      req.file.originalname,
      req.file.size,
      "bytes"
    );

    const form = new FormData();
    form.append("image_file", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });
    form.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_KEY, ...form.getHeaders() },
      body: form,
      timeout: 60000,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.errors?.[0]?.title || `Remove.bg error ${response.status}`
      );
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
//  8. RAZORPAY — Create Order (unchanged, working)
// ═══════════════════════════════════════════════════════
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency, planId } = req.body;
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret)
      return res.status(500).json({ error: "Razorpay keys not configured" });

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${key}:${secret}`).toString("base64"),
      },
      body: JSON.stringify({
        amount,
        currency: currency || "INR",
        receipt: `rcpt_${planId}_${Date.now()}`,
      }),
    });
    const order = await response.json();
    if (!order.id)
      throw new Error(order.error?.description || "Order creation failed");
    console.log("✅ Razorpay order created:", order.id);
    res.json(order);
  } catch (err) {
    console.error("create-order error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  9. RAZORPAY — Verify Payment (unchanged, working)
// ═══════════════════════════════════════════════════════
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      uid,
    } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret)
      return res.status(500).json({ error: "Razorpay secret not configured" });

    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = hmac.digest("hex");

    if (digest === razorpay_signature) {
      console.log("✅ Payment verified! Plan:", planId, "User:", uid);
      res.json({ success: true, planId, uid });
    } else {
      console.error("❌ Payment signature mismatch!");
      res
        .status(400)
        .json({ success: false, error: "Invalid payment signature" });
    }
  } catch (err) {
    console.error("verify-payment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`✅ RP Vision AI backend running on port ${PORT}`);
  console.log(`HF_TOKEN:      ${process.env.HF_TOKEN ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`STABILITY_KEY: ${process.env.STABILITY_KEY ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`REMOVE_BG_KEY: ${process.env.REMOVE_BG_KEY ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`RAZORPAY:      ${process.env.RAZORPAY_KEY_ID ? "✅ SET" : "❌ NOT SET"}`);
});





