# RP Vision AI — Text to Image Generator

<div align="center">

![RP Vision AI](https://img.shields.io/badge/RP%20VISION%20AI-Image%20Generator-e8c14a?style=for-the-badge&labelColor=050508)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=050508)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=050508)
![License](https://img.shields.io/badge/License-MIT-e8c14a?style=for-the-badge&labelColor=050508)

**A premium AI-powered text-to-image generator with a stunning dark UI**

<img width="1427" height="1077" alt="image" src="https://github.com/user-attachments/assets/eda7efa7-64d4-4158-8013-28269fa52daa" />
<img width="1445" height="1075" alt="image" src="https://github.com/user-attachments/assets/c8c3024a-6e26-483e-a476-b9d0163b947d" />
<img width="1915" height="1078" alt="image" src="https://github.com/user-attachments/assets/2138e764-41f8-4a00-aef9-dc4834c6e864" />



🌐 **Live Demo → [rp-vision-ai.vercel.app](https://rp-vision-ai.vercel.app)**

</div>

---

## ✨ Features

- 🎨 **AI Image Generation** — Powered by Pollinations AI (Free, no API key needed)
- 🖼️ **6 Art Style Presets** — Photorealistic, Cinematic, Anime, Oil Paint, Cyberpunk, Fantasy
- 📱 **Fully Responsive** — Beautiful on both desktop and mobile
- 🕓 **Image History** — View and revisit previously generated images
- ⬇️ **Download Images** — Save any generated image instantly
- ⚡ **Real-time Progress Bar** — Visual feedback during generation
- 🌙 **Premium Dark UI** — Gold accent theme with Bebas Neue + Outfit fonts

---

## 🖥️ Screenshots

| Desktop | Mobile |
|---------|--------|
| Sidebar layout with canvas | Tab-based Create / Result layout |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, CSS-in-JS |
| **Backend** | Node.js, Express |
| **AI API** | Pollinations AI (Free) |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |
| **Version Control** | GitHub |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### 1. Clone the repo
```bash
git clone https://github.com/PrakashWebDevX/RP-Vision-AI-Text-To-Image-Generate.git
cd RP-Vision-AI-Text-To-Image-Generate
```

### 2. Start the Backend
```bash
cd prakash-text2image-gpt/backend
npm install
node server.js
```
Backend runs at → `http://localhost:5000`

### 3. Start the Frontend
```bash
cd prakash-text2image-gpt/frontend
npm install
npm start
```
Frontend runs at → `http://localhost:3000`

---

## 📁 Project Structure

```
RP-Vision-AI-Text-To-Image-Generate/
└── prakash-text2image-gpt/
    ├── backend/
    │   ├── server.js        # Express API server
    │   └── package.json
    └── frontend/
        ├── public/
        │   └── index.html
        └── src/
            └── App.js       # Full React app
```

---

## 🌐 Deployment

### Frontend → Vercel
| Setting | Value |
|---------|-------|
| Root Directory | `prakash-text2image-gpt/frontend` |
| Framework | Create React App |
| Build Command | `npm run build` |
| Output | `build` |
| Env Variable | `CI=false` |

### Backend → Render
| Setting | Value |
|---------|-------|
| Root Directory | `prakash-text2image-gpt/backend` |
| Build Command | `npm install` |
| Start Command | `node server.js` |

---

## 💡 How It Works

1. User types a prompt in the UI
2. Selects an optional **Art Style** and **Aspect Ratio**
3. Clicks **Generate Image**
4. Frontend sends the prompt to the Express backend
5. Backend calls **Pollinations AI** and returns the generated image
6. Image is displayed with options to Download, Clear, or Regenerate

---

## 🎨 Art Styles

| Style | Description |
|-------|-------------|
| Photorealistic | 8K ultra detailed RAW photo |
| Cinematic | Movie still with dramatic lighting |
| Anime | Studio Ghibli inspired illustration |
| Oil Paint | Classical art on textured canvas |
| Cyberpunk | Neon futuristic blade runner aesthetic |
| Fantasy | Magical ethereal concept art |

---

## 📄 License

MIT License © 2025 [PrakashWebDevX](https://github.com/PrakashWebDevX)

---

<div align="center">

Made with ❤️ by **PrakashWebDevX**

⭐ Star this repo if you found it helpful!

</div>
