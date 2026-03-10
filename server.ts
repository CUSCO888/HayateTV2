import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import os from "os";

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(cors());
  app.use(express.json());

  // Simple in-memory store for remote input
  let remoteData = {
    playlistUrl: "",
    epgUrl: "",
    timestamp: 0,
  };

  // Get LAN IP
  app.get("/api/ip", (req, res) => {
    const interfaces = os.networkInterfaces();
    let lanIp = "127.0.0.1";
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === "IPv4" && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
    }
    res.json({ ip: lanIp, port: PORT });
  });

  // Receive data from mobile
  app.post("/api/remote", (req, res) => {
    const { playlistUrl, epgUrl } = req.body;
    remoteData = {
      playlistUrl: playlistUrl || "",
      epgUrl: epgUrl || "",
      timestamp: Date.now(),
    };
    res.json({ success: true });
  });

  // Poll data from TV
  app.get("/api/remote/poll", (req, res) => {
    res.json(remoteData);
  });

  // Serve the remote input HTML page
  app.get("/remote", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HayateTV Remote Input</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #111; color: #fff; padding: 20px; max-width: 500px; margin: 0 auto; }
          h2 { color: #3b82f6; text-align: center; margin-bottom: 30px; }
          .form-group { margin-bottom: 20px; }
          label { display: block; margin-bottom: 8px; color: #9ca3af; }
          input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #374151; background: #1f2937; color: #fff; box-sizing: border-box; font-size: 16px; }
          input:focus { outline: none; border-color: #3b82f6; }
          button { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px; }
          button:active { background: #1d4ed8; }
          #status { margin-top: 20px; text-align: center; color: #10b981; display: none; }
        </style>
      </head>
      <body>
        <h2>HayateTV Remote Input</h2>
        <form id="remoteForm">
          <div class="form-group">
            <label>Playlist URL (M3U/TXT)</label>
            <input type="text" id="playlistUrl" placeholder="http://...">
          </div>
          <div class="form-group">
            <label>EPG URL (XMLTV)</label>
            <input type="text" id="epgUrl" placeholder="http://...">
          </div>
          <button type="submit">Upload to TV</button>
          <div id="status">Successfully sent to TV!</div>
        </form>
        <script>
          document.getElementById('remoteForm').onsubmit = async (e) => {
            e.preventDefault();
            const p = document.getElementById('playlistUrl').value;
            const epg = document.getElementById('epgUrl').value;
            
            const btn = document.querySelector('button');
            btn.textContent = 'Uploading...';
            btn.disabled = true;

            try {
              await fetch('/api/remote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlistUrl: p, epgUrl: epg })
              });
              document.getElementById('status').style.display = 'block';
              setTimeout(() => { document.getElementById('status').style.display = 'none'; }, 3000);
            } catch (err) {
              alert('Error uploading to TV');
            } finally {
              btn.textContent = 'Upload to TV';
              btn.disabled = false;
            }
          };
        </script>
      </body>
      </html>
    `);
  });

  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).json({ error: "URL is required" });
      return;
    }
    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      if (!response.ok) {
        res.status(response.status).send(response.statusText);
        return;
      }
      const text = await response.text();
      res.setHeader("Content-Type", response.headers.get("content-type") || "text/plain");
      res.send(text);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
