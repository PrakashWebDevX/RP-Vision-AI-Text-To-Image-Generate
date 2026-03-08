import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/generate", async (req, res) => {
    try {
        const { prompt } = req.body;

        const response = await fetch(
            "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.HF_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: prompt
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.log("HF Error:", errText);
            return res.status(500).send(errText);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        res.setHeader("Content-Type", "image/png");
        res.send(buffer);

    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).send("Backend error");
    }
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
