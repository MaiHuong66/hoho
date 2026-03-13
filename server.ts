import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple in-memory storage for the Global File ID (will reset on restart, but better than nothing without Firebase)
  // In a real Vercel app, this would be an env var or a DB.
  let globalFileId = process.env.GOOGLE_DRIVE_FILE_ID || "";

  app.get("/api/config", (req, res) => {
    res.json({ globalFileId });
  });

  app.post("/api/config", (req, res) => {
    const { fileId } = req.body;
    if (fileId) {
      globalFileId = fileId;
      res.json({ success: true, globalFileId });
    } else {
      res.status(400).json({ error: "Missing fileId" });
    }
  });

  // Proxy to fetch Google Drive content (assuming it's a public TXT/PDF/DOCX or we use an API key)
  app.get("/api/drive/:fileId", async (req, res) => {
    const { fileId } = req.params;
    try {
      // For simplicity, we assume the file is a public Google Doc exported as text
      // Or a direct download link if it's a binary file.
      // This is a common pattern for "Persistent Memory" via Drive.
      const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch from Google Drive");
      const text = await response.text();
      res.json({ content: text });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
