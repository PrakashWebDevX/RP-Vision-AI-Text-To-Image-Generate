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
    throw new Error("HF_TOKEN not set. Get free key at huggingface.co/settings/tokens");

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
// 1. TEXT TO IMAGE
// ═══════════════════════════════════════════════════════
app.post("/text-to-image", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    const hfModel = model || "black-forest-labs/FLUX.1-schnell";
    const response = await hfInference(hfModel, { inputs: prompt.trim().slice(0, 500) });
    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 2. IMAGE TO IMAGE
// ═══════════════════════════════════════════════════════
app.post("/image-to-image", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "transform this image, high quality";
    if (!req.file) return res.status(400).json({ error: "Image file is required" });
    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64Image}`;
    const fullPrompt = `${prompt.trim()}, high quality, detailed`.slice(0, 500);

    const response = await hfInference("stabilityai/stable-diffusion-xl-refiner-1.0", {
      inputs: fullPrompt,
      parameters: { image: dataUri, strength: 0.7, num_inference_steps: 20 },
    });
    const buffer = await response.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 3. TEXT TO VIDEO
// ═══════════════════════════════════════════════════════
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt, model, duration } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    const videoModel = model || "wan-fast";
    const videoDuration = duration || 5;
    const seed = Math.floor(Math.random() * 999999);
    const encodedPrompt = encodeURIComponent(prompt.trim().slice(0, 500));
    const videoUrl = `https://video.pollinations.ai/prompt/${encodedPrompt}?model=${videoModel}&duration=${videoDuration}&seed=${seed}&nologo=true`;

    const videoRes = await fetch(videoUrl, { timeout: 180000 });
    if (!videoRes.ok) throw new Error(`Pollinations video error: ${videoRes.status}`);
    const buffer = await videoRes.buffer();
    res.set("Content-Type", "video/mp4");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 4. IMAGE TO VIDEO
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "animate with smooth cinematic motion";
    if (!req.file) return res.status(400).json({ error: "Image file is required" });
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
          parameters: { num_frames: 25, fps: 7 },
        }),
        timeout: 180000,
      }
    );
    if (!response.ok) throw new Error(`HuggingFace SVD error ${response.status}`);
    const buffer = await response.buffer();
    res.set("Content-Type", "video/mp4");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 5. TEXT TO AUDIO
// ═══════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (type === "speech") {
      return res.json({ success: true, type: "speech", text: prompt.trim().slice(0, 300) });
    }
    const response = await hfInference("facebook/musicgen-small", {
      inputs: prompt.trim().slice(0, 300),
      parameters: { max_new_tokens: 256 },
    });
    const buffer = await response.buffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.json({ success: true, type: "speech", text: req.body.prompt?.trim().slice(0, 300) || "" });
  }
});

// ═══════════════════════════════════════════════════════
// 6. IMAGE UPSCALER
// ═══════════════════════════════════════════════════════
app.post("/upscale", upload.single("image"), async (req, res) => {
  try {
    const STABILITY_KEY = process.env.STABILITY_KEY;
    if (!STABILITY_KEY) return res.status(500).json({ error: "STABILITY_KEY not set" });
    if (!req.file) return res.status(400).json({ error: "Image file is required" });
    const form = new FormData();
    form.append("image", req.file.buffer, { filename: req.file.originalname || "image.jpg", contentType: req.file.mimetype || "image/jpeg" });
    form.append("output_format", "jpeg");
    const upscaleRes = await fetch("https://api.stability.ai/v2beta/stable-image/upscale/fast", {
      method: "POST",
      headers: { Authorization: `Bearer ${STABILITY_KEY}`, Accept: "image/*", ...form.getHeaders() },
      body: form,
      timeout: 60000,
    });
    if (!upscaleRes.ok) throw new Error(`Stability AI error`);
    const buffer = await upscaleRes.buffer();
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("upscale error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 7. REMOVE BACKGROUND
// ═══════════════════════════════════════════════════════
app.post("/remove-background", upload.single("image"), async (req, res) => {
  try {
    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY) return res.status(500).json({ error: "REMOVE_BG_KEY not set" });
    if (!req.file) return res.status(400).json({ error: "Image file is required" });
    const form = new FormData();
    form.append("image_file", req.file.buffer, { filename: req.file.originalname || "image.jpg", contentType: req.file.mimetype || "image/jpeg" });
    form.append("size", "auto");
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_KEY, ...form.getHeaders() },
      body: form,
      timeout: 60000,
    });
    if (!response.ok) throw new Error(`Remove.bg error`);
    const buffer = await response.buffer();
    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error("remove-bg error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 8. RAZORPAY - Create Order
// ═══════════════════════════════════════════════════════
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency, planId } = req.body;
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) return res.status(500).json({ error: "Razorpay keys not configured" });
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64") },
      body: JSON.stringify({ amount, currency: currency || "INR", receipt: `rcpt_${planId}_${Date.now()}` }),
    });
    const order = await response.json();
    if (!order.id) throw new Error("Order creation failed");
    res.json(order);
  } catch (err) {
    console.error("create-order error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 9. RAZORPAY - Verify Payment
// ═══════════════════════════════════════════════════════
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, uid } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(500).json({ error: "Razorpay secret not configured" });
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = hmac.digest("hex");
    if (digest === razorpay_signature) {
      res.json({ success: true, planId, uid });
    } else {
      res.status(400).json({ success: false, error: "Invalid payment signature" });
    }
  } catch (err) {
    console.error("verify-payment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// 10. AI CHAT AGENT (ChatGPT + Claude Sonnet + Gemini) - FREE
// ═══════════════════════════════════════════════════════
// AI CHAT AGENT
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model = "claude" } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    const POLLINATIONS_URL = "https://gen.pollinations.ai/v1/chat/completions";

    const response = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
        temperature: 0.85,
      }),
    });

    if (!response.ok) throw new Error(`Pollinations error ${response.status}`);

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    res.json({ reply });
  } catch (err) {
    console.error("AI Chat error:", err.message);
    res.status(500).json({ error: "Chat service temporarily unavailable. Please try again." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ RP Vision AI backend running on port ${PORT}`);
  console.log(`HF_TOKEN: ${process.env.HF_TOKEN ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`STABILITY_KEY: ${process.env.STABILITY_KEY ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`REMOVE_BG_KEY: ${process.env.REMOVE_BG_KEY ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`RAZORPAY: ${process.env.RAZORPAY_KEY_ID ? "✅ SET" : "❌ NOT SET"}`);
});
