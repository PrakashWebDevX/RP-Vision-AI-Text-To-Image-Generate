import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://rp-vision-ai.vercel.app"
  ]
}));

app.use(express.json());

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("Generating image for:", prompt);

    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&enhance=true`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Pollinations API failed: " + response.status);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "image/jpeg");
    res.send(buffer);

  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
