import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";

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

  // ================= TELEGRAM BOT =================
  const BOT_TOKEN = "8749143834:AAHvNq0RhjAiiZZBPJmsaoakIKsA4KwWYyc";
  const CHAT_ID = "8611103848";
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  const notifyTelegram = (message: string) => {
    bot.sendMessage(CHAT_ID, message).catch(err => console.error("Telegram notify error:", err.message));
  };

  bot.onText(/\/start/, (msg) => {
    const fromName = msg.from?.first_name || "User";
    const welcome = `Welcome, ${fromName}\n\n` +
      `=== CONTROL RELAY ===\n` +
      `/r1_on  -> Relay 1 ON\n` +
      `/r1_off -> Relay 1 OFF\n\n` +
      `/r2_on  -> Relay 2 ON\n` +
      `/r2_off -> Relay 2 OFF\n\n` +
      `/r3_on  -> Relay 3 ON\n` +
      `/r3_off -> Relay 3 OFF\n\n` +
      `/r4_on  -> Relay 4 ON\n` +
      `/r4_off -> Relay 4 OFF\n\n` +
      `/all_on  -> Semua Relay ON\n` +
      `/all_off -> Semua Relay OFF\n\n` +
      `/state -> Status Relay\n` +
      `/dht -> Baca Sensor DHT11\n\n` +
      `=== VARIASI ===\n` +
      `/v1_on | /v1_off\n` +
      `/v2_on | /v2_off`;
    bot.sendMessage(msg.chat.id, welcome);
  });

  bot.on("message", (msg) => {
    if (!msg.text) return;
    const text = msg.text.toLowerCase();
    const chatId = msg.chat.id.toString();

    // Basic Validation (Optional, can be removed if public)
    // if (chatId !== CHAT_ID) return;

    // Relay/Lampu Commands
    const cmdMatch = text.match(/^\/(r|lampu)(\d)_(on|off)$/);
    if (cmdMatch) {
      const id = parseInt(cmdMatch[2]);
      const status = cmdMatch[3] === "on";
      const relay = state.relays.find(r => r.id === id);
      if (relay) {
        relay.status = status;
        bot.sendMessage(chatId, `${relay.name} is now ${status ? "ON" : "OFF"}`);
      } else {
        bot.sendMessage(chatId, `Relay ${id} tidak ditemukan.`);
      }
      return;
    }

    // All On/Off
    if (text === "/all_on") {
      state.relays.forEach(r => r.status = true);
      bot.sendMessage(chatId, "Semua Relay ON");
      return;
    }
    if (text === "/all_off") {
      state.relays.forEach(r => r.status = false);
      bot.sendMessage(chatId, "Semua Relay OFF");
      return;
    }

    // Variations
    if (text === "/v1_on") {
      state.variations.variation1 = true;
      state.relays.forEach(r => r.status = (r.id % 2 !== 0));
      bot.sendMessage(chatId, "Variasi 1 ON (Lampu Ganjil)");
      return;
    }
    if (text === "/v1_off") {
      state.variations.variation1 = false;
      bot.sendMessage(chatId, "Variasi 1 OFF");
      return;
    }
    if (text === "/v2_on") {
      state.variations.variation2 = true;
      state.relays.forEach(r => r.status = (r.id % 2 === 0));
      bot.sendMessage(chatId, "Variasi 2 ON (Lampu Genap)");
      return;
    }
    if (text === "/v2_off") {
      state.variations.variation2 = false;
      bot.sendMessage(chatId, "Variasi 2 OFF");
      return;
    }

    // Status & DHT
    if (text === "/state" || text === "/status") {
      let statusMsg = "=== STATUS RELAY ===\n";
      state.relays.forEach(r => {
        statusMsg += `${r.name}: ${r.status ? "ON ✅" : "OFF ❌"}\n`;
      });
      bot.sendMessage(chatId, statusMsg);
      return;
    }

    if (text === "/dht" || text === "/sensor" || text.includes("berapa temperatur") || text.includes("berapa kelembapan")) {
      const dhtMsg = `=== DATA DHT11 ===\n` +
        `Suhu : ${state.sensors.temperature.toFixed(1)} °C\n` +
        `Kelembaban : ${state.sensors.humidity.toFixed(1)} %`;
      bot.sendMessage(chatId, dhtMsg);
      return;
    }

    // Voice-like commands
    if (text.includes("nyalakan lampu")) {
      state.relays.forEach(r => r.status = true);
      bot.sendMessage(chatId, "Semua lampu telah dinyalakan");
      return;
    }
    if (text.includes("matikan lampu")) {
      state.relays.forEach(r => r.status = false);
      bot.sendMessage(chatId, "Semua lampu telah dimatikan");
      return;
    }
  });

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
      notifyTelegram(`[Web UI] ${relay.name} set to ${status ? "ON" : "OFF"}`);
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
        state.relays.forEach(r => r.status = (r.id % 2 !== 0));
        notifyTelegram("[Web UI] Variasi 1 Aktif");
      } else {
        notifyTelegram("[Web UI] Variasi 1 Non-aktif");
      }
    } else if (type === 2) {
      state.variations.variation2 = status;
      if (status) {
        state.relays.forEach(r => r.status = (r.id % 2 === 0));
        notifyTelegram("[Web UI] Variasi 2 Aktif");
      } else {
        notifyTelegram("[Web UI] Variasi 2 Non-aktif");
      }
    }
    res.json({ success: true, variations: state.variations });
  });

  // Endpoints for "Voice" commands simulation from Web UI
  app.post("/api/command", (req, res) => {
    const { text } = req.body;
    const cmd = text?.toLowerCase();
    
    if (cmd.includes("nyalakan lampu")) {
      state.relays.forEach(r => r.status = true);
      notifyTelegram("[Web UI] Komando: Nyalakan Semua Lampu");
      return res.json({ message: "Semua lampu dinyalakan", state });
    }
    if (cmd.includes("matikan lampu")) {
      state.relays.forEach(r => r.status = false);
      notifyTelegram("[Web UI] Komando: Matikan Semua Lampu");
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
    notifyTelegram("🤖 SmartHome IoT Server is Online!");
  });
}

startServer();
