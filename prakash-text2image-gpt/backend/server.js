import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://rp-vision-ai.vercel.app"
  ]
}));
app.use(express.json({ limit: "20mb" }));

// ── TEXT TO IMAGE ──────────────────────────────────────────
app.post("/text-to-image", async (req, res) => {
  try {
    const { prompt, width = 1024, height = 1024, model = "flux" } = req.body;
    const encoded = encodeURIComponent(prompt);
    const key = process.env.POLLINATIONS_KEY ? `&key=${process.env.POLLINATIONS_KEY}` : "";
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}&nologo=true&enhance=true${key}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Text to image failed: " + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── IMAGE TO IMAGE ─────────────────────────────────────────
app.post("/image-to-image", async (req, res) => {
  try {
    const { prompt, image_url, strength = 0.7 } = req.body;
    const encoded = encodeURIComponent(prompt);
    const encodedImg = encodeURIComponent(image_url);
    const key = process.env.POLLINATIONS_KEY ? `&key=${process.env.POLLINATIONS_KEY}` : "";
    const url = `https://image.pollinations.ai/prompt/${encoded}?image=${encodedImg}&strength=${strength}&nologo=true${key}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image to image failed: " + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── REMOVE BACKGROUND ──────────────────────────────────────
app.post("/remove-background", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!process.env.REMOVE_BG_KEY) {
      return res.status(500).json({ error: "Remove.bg API key not configured" });
    }
    const formData = new FormData();
    formData.append("image_url", image_url);
    formData.append("size", "auto");
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": process.env.REMOVE_BG_KEY },
      body: formData,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error("Remove.bg failed: " + errText);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error("remove-background error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── IMAGE UPSCALER ─────────────────────────────────────────
app.post("/upscale", async (req, res) => {
  try {
    const { image_url, scale = 2 } = req.body;
    // Using Picwing free upscaler
    const response = await fetch("https://inferenceengine.vyro.ai/upscale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url, scale }),
    });
    if (!response.ok) throw new Error("Upscale failed: " + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("upscale error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TEXT TO AUDIO ──────────────────────────────────────────
app.post("/text-to-audio", async (req, res) => {
  try {
    const { prompt } = req.body;
    const encoded = encodeURIComponent(prompt);
    const url = `https://audio.pollinations.ai/generate?prompt=${encoded}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Text to audio failed: " + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-audio error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TEXT TO VIDEO ──────────────────────────────────────────
app.post("/text-to-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    // Pollinations video generation
    const encoded = encodeURIComponent(prompt);
    const key = process.env.POLLINATIONS_KEY ? `&key=${process.env.POLLINATIONS_KEY}` : "";
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux-animation&nologo=true${key}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Text to video failed: " + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "image/gif");
    res.send(buffer);
  } catch (err) {
    console.error("text-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── IMAGE TO VIDEO ─────────────────────────────────────────
app.post("/image-to-video", async (req, res) => {
  try {
    const { image_url, prompt = "animate this image smoothly" } = req.body;
    const encoded = encodeURIComponent(prompt);
    const encodedImg = encodeURIComponent(image_url);
    const key = process.env.POLLINATIONS_KEY ? `&key=${process.env.POLLINATIONS_KEY}` : "";
    const url = `https://image.pollinations.ai/prompt/${encoded}?image=${encodedImg}&model=flux-animation&nologo=true${key}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image to video failed: " + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "image/gif");
    res.send(buffer);
  } catch (err) {
    console.error("image-to-video error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", version: "2.0" }));

// Keep backward compatibility
app.post("/generate", async (req, res) => {
  req.url = "/text-to-image";
  app._router.handle(req, res);
});

app.listen(5000, () => console.log("RP Vision AI v2 Backend running on port 5000"));
