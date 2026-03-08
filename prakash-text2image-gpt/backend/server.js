import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { InferenceClient } from "@huggingface/inference";

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://rp-vision-ai.vercel.app"
  ]
}));

app.use(express.json());

const client = new InferenceClient(process.env.HF_API_KEY);

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("Generating image for:", prompt);

    const imageBlob = await client.textToImage({
      model: "stabilityai/stable-diffusion-2-1",
      inputs: prompt,
      provider: "hf-inference",
      parameters: {
        num_inference_steps: 30,
        width: 768,
        height: 768,
      },
    });

    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
