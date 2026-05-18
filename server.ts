import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory state
  const state = {
    relays: [
      { id: 1, name: "Lampu 1", status: false },
      { id: 2, name: "Lampu 2", status: false },
      { id: 3, name: "Lampu 3", status: false },
      { id: 4, name: "Lampu 4", status: false },
    ],
    sensors: {
      temperature: 25.5,
      humidity: 60.0,
      lastUpdate: new Date().toISOString(),
    },
    variations: {
      variation1: false,
      variation2: false,
    }
  };

  // Mock sensor updates
  setInterval(() => {
    state.sensors.temperature += (Math.random() - 0.5) * 0.5;
    state.sensors.humidity += (Math.random() - 0.5) * 1.0;
    // Keep them bounded
    state.sensors.temperature = Math.max(15, Math.min(40, state.sensors.temperature));
    state.sensors.humidity = Math.max(20, Math.min(95, state.sensors.humidity));
    state.sensors.lastUpdate = new Date().toISOString();
  }, 5000);

  // Health Check
  app.get("/api/health", (req, res) => {
    console.log("Health check requested");
    res.json({ status: "ok" });
  });

  // API Routes
  app.get("/api/status", (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/status - Current Status: T=${state.sensors.temperature.toFixed(1)}`);
    res.json(state);
  });

  app.post("/api/relay", (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/relay - Body:`, req.body);
    const { id, status } = req.body;
    const relay = state.relays.find((r) => r.id === id);
    if (relay) {
      relay.status = status;
      console.log(`Relay ${id} changed to ${status ? "ON" : "OFF"}`);
      res.json({ success: true, relay });
    } else {
      res.status(404).json({ error: "Relay not found" });
    }
  });

  app.post("/api/variation", (req, res) => {
    const { type, status } = req.body;
    if (type === 1) {
      state.variations.variation1 = status;
      if (status) {
        // Simple logic for variation 1: turn on all odd relays
        state.relays.forEach(r => r.status = (r.id % 2 !== 0));
      }
    } else if (type === 2) {
      state.variations.variation2 = status;
      if (status) {
        // Simple logic for variation 2: turn on all even relays
        state.relays.forEach(r => r.status = (r.id % 2 === 0));
      }
    }
    res.json({ success: true, variations: state.variations });
  });

  // Endpoints for "Voice" commands simulation
  app.post("/api/command", (req, res) => {
    const { text } = req.body;
    const cmd = text?.toLowerCase();
    
    if (cmd.includes("nyalakan lampu")) {
      state.relays.forEach(r => r.status = true);
      return res.json({ message: "Semua lampu dinyalakan", state });
    }
    if (cmd.includes("matikan lampu")) {
      state.relays.forEach(r => r.status = false);
      return res.json({ message: "Semua lampu dimatikan", state });
    }
    if (cmd.includes("berapa temperatur")) {
      return res.json({ message: `Temperatur saat ini adalah ${state.sensors.temperature.toFixed(1)}°C` });
    }
    if (cmd.includes("berapa kelembapan")) {
      return res.json({ message: `Kelembapan saat ini adalah ${state.sensors.humidity.toFixed(1)}%` });
    }

    res.json({ message: "Perintah tidak dimengerti" });
  });

  // Vite integration
  const isProd = process.env.NODE_ENV === "production";
  console.log(`[Server] Environment: ${process.env.NODE_ENV}, isProd: ${isProd}`);

  if (!isProd) {
    console.log("[Server] Mounting Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Serving static files from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
