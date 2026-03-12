import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 终极暴力 CORS 配置
  app.use((req, res, next) => {
    // 强制允许所有来源，不使用 Credentials 以获得最大兼容性
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json());

  // Debug API
  app.get("/api/version", (req, res) => {
    res.json({ version: "2.7", node_env: process.env.NODE_ENV });
  });

  // Remote Input State (In-memory for simplicity)
  let remoteInputData = {
    playlistUrl: "",
    epgUrl: "",
    timestamp: 0
  };

  // Proxy Endpoint
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing URL parameter");
    }

    try {
      console.log(`[Proxy] Fetching: ${targetUrl}`);
      const response = await axios.get(targetUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        },
        timeout: 15000
      });

      res.set("Content-Type", response.headers["content-type"] || "text/plain");
      res.send(response.data);
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      // 即使报错也要确保有 CORS 头
      res.status(500).send("Proxy error: " + error.message);
    }
  });

  // Remote Input API
  app.post("/api/remote-input", (req, res) => {
    const { playlistUrl, epgUrl } = req.body;
    remoteInputData = {
      playlistUrl,
      epgUrl,
      timestamp: Date.now()
    };
    res.json({ success: true });
  });

  app.get("/api/remote-input/poll", (req, res) => {
    res.json(remoteInputData);
  });

  // Mobile Remote Input Page
  app.get("/remote", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HayateTV Remote Input</title>
        <style>
          body { font-family: sans-serif; padding: 20px; background: #121212; color: white; }
          .container { max-width: 400px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 20px; color: #00e676; }
          .field { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-size: 14px; color: #aaa; }
          input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #333; background: #1e1e1e; color: white; box-sizing: border-box; }
          button { width: 100%; padding: 15px; border-radius: 8px; border: none; background: #00e676; color: black; font-weight: bold; font-size: 16px; cursor: pointer; margin-top: 10px; }
          button:active { opacity: 0.8; }
          .status { margin-top: 20px; text-align: center; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>HayateTV Remote</h1>
          <div class="field">
            <label>Playlist URL (M3U/TXT)</label>
            <input type="text" id="playlist" placeholder="https://...">
          </div>
          <div class="field">
            <label>EPG URL (XMLTV)</label>
            <input type="text" id="epg" placeholder="https://...">
          </div>
          <button onclick="submit()">Upload to TV</button>
          <div id="status" class="status"></div>
        </div>
        <script>
          async function submit() {
            const playlistUrl = document.getElementById('playlist').value;
            const epgUrl = document.getElementById('epg').value;
            const status = document.getElementById('status');
            status.innerText = 'Sending...';
            try {
              const res = await fetch('/api/remote-input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlistUrl, epgUrl })
              });
              if (res.ok) {
                status.innerText = 'Successfully uploaded to TV!';
                status.style.color = '#00e676';
              } else {
                status.innerText = 'Failed to upload.';
                status.style.color = '#ff5252';
              }
            } catch (e) {
              status.innerText = 'Error: ' + e.message;
              status.style.color = '#ff5252';
            }
          }
        </script>
      </body>
      </html>
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
