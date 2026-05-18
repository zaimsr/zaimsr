import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mqtt from "mqtt";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ================= MQTT SETUP =================
  const DEVICE_ID = "8611103848";
  const MQTT_BROKER = "mqtt://broker.emqx.io:1883";
  const TOPIC_PREFIX = `smartnode/${DEVICE_ID}`;
  const TOPIC_SENSORS = `${TOPIC_PREFIX}/sensors`;
  const TOPIC_RELAYS_STATE = `${TOPIC_PREFIX}/relays/state`;
  const TOPIC_RELAYS_CMD = `${TOPIC_PREFIX}/relays/command`;
  
  const mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: `smartnode_server_${Math.random().toString(16).substring(2, 8)}`,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
  });

  mqttClient.on("connect", () => {
    console.log("[Server] Connected to MQTT Broker successfully");
    mqttClient.subscribe([TOPIC_SENSORS, TOPIC_RELAYS_STATE]);
    // Send initial status
    mqttClient.publish(`${TOPIC_PREFIX}/status`, JSON.stringify({ status: "online", source: "server" }));
  });

  mqttClient.on("error", (err) => {
    console.error("[Server] MQTT Client Error:", err.message);
  });

  // Local state mirror for AI context
  const state = {
    relays: { r1: false, r2: false, r3: false, r4: false },
    sensors: { temp: 0, hum: 0 }
  };

  mqttClient.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (topic === TOPIC_SENSORS) {
        state.sensors = { ...state.sensors, ...payload };
      } else if (topic === TOPIC_RELAYS_STATE) {
        state.relays = { ...state.relays, ...payload };
      }
    } catch (e) {}
  });

  // ================= GEMINI AI =================
  const GENAI_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyDEbeHNANZWogdnOyfrta9RfMyEbdQufmk";
  const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const askAI = async (prompt: string) => {
    try {
      const systemPrompt = `You are a Smart Home Assistant for Device ID ${DEVICE_ID}. 
      Current Hardware State (Last Known): 
      - Relays: ${JSON.stringify(state.relays)}
      - Sensors: ${JSON.stringify(state.sensors)}
      
      Respond concisely in Indonesian. The user communicates via Telegram.
      If they ask about the status, describe it.`;
      
      const result = await model.generateContent([systemPrompt, prompt]);
      return result.response.text();
    } catch (err: any) {
      console.error("Gemini AI error:", err.message);
      return "Maaf, asisten AI sedang mengalami gangguan.";
    }
  };

  // ================= TELEGRAM BOT =================
  const rawToken = process.env.TELEGRAM_BOT_TOKEN || "8749143834:AAHvNq0RhjAiiZZBPJmsaoakIKsA4KwWYyc";
  const BOT_TOKEN = rawToken.trim();
  const CHAT_ID = "8611103848";

  console.log(`[Server] Testing Token with direct fetch: https://api.telegram.org/bot${BOT_TOKEN.substring(0, 10)}.../getMe`);
  
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        console.log("[Server] Direct fetch SUCCESS:", data.result.username);
      } else {
        console.error("[Server] Direct fetch FAILED:", data.description);
        console.error("[Server] Ensure token is correct and bot is not deactivated.");
      }
    })
    .catch(err => console.error("[Server] Direct fetch ERROR:", err.message));

  const bot = new TelegramBot(BOT_TOKEN, { polling: false });

  // Clear webhook and then start polling
  bot.deleteWebHook()
    .then(() => {
      console.log("[Server] Webhook cleared.");
      return bot.startPolling();
    })
    .then(() => {
      console.log("[Server] Polling started.");
    })
    .catch((err) => {
      console.error("[Server] Telegram Initialization Error:", err.message);
    });

  bot.getMe().then((me) => {
    console.log(`[Server] Telegram Bot connected successfully correctly: @${me.username}`);
    bot.sendMessage(CHAT_ID, "🚀 Server Smartnode telah aktif! Bot siap menerima perintah.");
  }).catch((err) => {
    console.error("[Server] Telegram getMe failed (Invalid Token?):", err.message);
  });

  // Webhook endpoint (kept for compatibility but not used if polling is on)
  app.post("/api/bot", (req, res) => {
    if (bot.options.polling) {
      return res.status(200).send("Polling is active, ignoring webhook");
    }
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  const handleBotMessage = async (msg: any) => {
    if (!msg.text) return;
    const text = msg.text.toLowerCase();
    const chatId = msg.chat.id;
    console.log(`[Telegram] New Message from ${chatId}: ${text}`);

    // Allow user to set their own CHAT_ID if they messaged the bot
    // (Optional: use the hardcoded one or the sender's id)

    // Relay Commands
    const cmdMatch = text.match(/^\/(r|lampu)(\d)_(on|off)$/);
    if (cmdMatch) {
      const id = parseInt(cmdMatch[2]);
      const status = cmdMatch[3] === "on";
      mqttClient.publish(TOPIC_RELAYS_CMD, JSON.stringify({ id, status }));
      bot.sendMessage(chatId, `Mengirim perintah: Relay ${id} ${status ? "ON" : "OFF"}`);
      return;
    }

    if (text === "/all_on") {
      [1, 2, 3, 4].forEach(id => mqttClient.publish(TOPIC_RELAYS_CMD, JSON.stringify({ id, status: true })));
      bot.sendMessage(chatId, "Semua Relay ON");
      return;
    }

    if (text === "/all_off") {
      [1, 2, 3, 4].forEach(id => mqttClient.publish(TOPIC_RELAYS_CMD, JSON.stringify({ id, status: false })));
      bot.sendMessage(chatId, "Semua Relay OFF");
      return;
    }

    if (text === "/status" || text === "/state") {
      const msg = `=== STATUS HARWARE (${DEVICE_ID}) ===\n` +
                  `Lampu 1: ${state.relays.r1 ? "ON" : "OFF"}\n` +
                  `Lampu 2: ${state.relays.r2 ? "ON" : "OFF"}\n` +
                  `Lampu 3: ${state.relays.r3 ? "ON" : "OFF"}\n` +
                  `Lampu 4: ${state.relays.r4 ? "ON" : "OFF"}\n\n` +
                  `Suhu: ${state.sensors.temp.toFixed(1)}°C\n` +
                  `Lembab: ${state.sensors.hum.toFixed(1)}%`;
      bot.sendMessage(chatId, msg);
      return;
    }

    // Default to AI
    const aiResponse = await askAI(msg.text);
    bot.sendMessage(chatId, aiResponse);
  };

  bot.on("message", handleBotMessage);

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Smart Home Bot Ready!\nCommands:\n/r1_on, /r1_off ... /r4_off\n/all_on, /all_off\n/status");
  });

  // ================= API ROUTES =================
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // ================= VITE INTEGRATION =================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
