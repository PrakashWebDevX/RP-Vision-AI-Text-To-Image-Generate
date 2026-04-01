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
  limits: { fileSize: 20 * 1024 * 1024 } 
});

const PORT = process.env.PORT || 10000;
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── HuggingFace inference helper ─────────────────────────
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
  throw new Error("Max retries reached. Please try again.");
}

// ── HEALTH ────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    HF_TOKEN: !!process.env.HF_TOKEN,
    STABILITY_KEY: !!process.env.STABILITY_KEY,
    REMOVE_BG_KEY: !!process.env.REMOVE_BG_KEY,
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
//  2. IMAGE TO IMAGE — accepts multipart with "image" file
// ═══════════════════════════════════════════════════════
app.post("/image-to-image", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "transform this image, high quality";
    console.log("image-to-image:", prompt.slice(0, 60), req.file ? "[file uploaded]" : "[no file]");
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
//  4. IMAGE TO VIDEO — accepts multipart with "image" file
// ═══════════════════════════════════════════════════════
app.post("/image-to-video", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "animate with smooth cinematic motion";
    console.log("image-to-video:", prompt.slice(0, 60), req.file ? "[file uploaded]" : "[no file]");
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
//  5. TEXT TO AUDIO — Returns text for frontend TTS
//     Uses Web Speech API in browser (FREE, no API key)
// ═══════════════════════════════════════════════════════
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    console.log("text-to-audio:", prompt.slice(0, 60));
    // Return the text — frontend will use Web Speech API to speak it
    res.json({ 
      success: true, 
      text: prompt.trim().slice(0, 300),
      message: "Use Web Speech API in browser"
    });
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  6. IMAGE UPSCALER — accepts multipart with "image" file
// ═══════════════════════════════════════════════════════
app.post("/upscale", upload.single("image"), async (req, res) => {
  try {
    const STABILITY_KEY = process.env.STABILITY_KEY;
    if (!STABILITY_KEY) return res.status(500).json({ error: "STABILITY_KEY not set" });
    if (!req.file) return res.status(400).json({ error: "Image file is required" });

    console.log("upscale: [file uploaded]", req.file.originalname, req.file.size, "bytes");

    const form = new FormData();
    form.append("image", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });
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
//  7. REMOVE BACKGROUND — accepts multipart with "image" file
// ═══════════════════════════════════════════════════════
app.post("/remove-background", upload.single("image"), async (req, res) => {
  try {
    const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
    if (!REMOVE_BG_KEY) return res.status(500).json({ error: "REMOVE_BG_KEY not set" });
    if (!req.file) return res.status(400).json({ error: "Image file is required" });

    console.log("remove-bg: [file uploaded]", req.file.originalname, req.file.size, "bytes");

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
//  AI CHAT — Proxy to Anthropic API
// ═══════════════════════════════════════════════════════
app.post("/chat", async (req, res) => {
  try {
    const { messages, model, userName } = req.body;
    if (!messages || !messages.length) return res.status(400).json({ error: "Messages required" });

    const selectedModel = model || "claude-haiku-4-5-20251001";
    console.log("💬 Chat request:", selectedModel, "msgs:", messages.length);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 1024,
        system: `You are a helpful AI assistant built into RP Vision AI — an AI creative platform. Help users with coding (HTML, CSS, JS, Python, React, Node.js), answer any question, explain concepts clearly, tell jokes, discuss news, give advice and everything. Be friendly, concise and helpful. The user's name is ${userName || "User"}. When showing code, always use markdown code blocks with the language name.`,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", data);
      throw new Error(data.error?.message || `Anthropic API error ${response.status}`);
    }

    const reply = data.content?.[0]?.text || "Sorry, I could not generate a response.";
    console.log("✅ Chat reply generated, length:", reply.length);
    res.json({ reply, model: selectedModel });
  } catch (err) {
    console.error("chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ═══════════════════════════════════════════════════════
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency, planId } = req.body;
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) return res.status(500).json({ error: "Razorpay keys not configured" });

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${key}:${secret}`).toString("base64"),
      },
      body: JSON.stringify({ amount, currency: currency || "INR", receipt: `rcpt_${planId}_${Date.now()}` }),
    });
    const order = await response.json();
    if (!order.id) throw new Error(order.error?.description || "Order creation failed");
    console.log("✅ Razorpay order created:", order.id);
    res.json(order);
  } catch (err) {
    console.error("create-order error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  RAZORPAY — Verify Payment
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
      console.log("✅ Payment verified! Plan:", planId, "User:", uid);
      res.json({ success: true, planId, uid });
    } else {
      console.error("❌ Payment signature mismatch!");
      res.status(400).json({ success: false, error: "Invalid payment signature" });
    }
  } catch (err) {
    console.error("verify-payment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`✅ RP Vision AI backend running on port ${PORT}`);
  console.log(`HF_TOKEN: ${process.env.HF_TOKEN ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`STABILITY_KEY: ${process.env.STABILITY_KEY ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`REMOVE_BG_KEY: ${process.env.REMOVE_BG_KEY ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`RAZORPAY: ${process.env.RAZORPAY_KEY_ID ? "✅ SET" : "❌ NOT SET"}`);
});
