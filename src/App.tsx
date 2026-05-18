import React, { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import { 
  Lightbulb, 
  Thermometer, 
  Droplets, 
  Power, 
  MessageSquare, 
  Keyboard, 
  History, 
  LayoutDashboard, 
  Settings,
  Bell,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Menu,
  Moon,
  Sun,
  Radio,
  Zap,
  Mic,
  Wifi,
  WifiOff
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import { Separator } from "@/components/ui/separator";

// MQTT Configuration
const DEVICE_ID = "8611103848"; // Using your Telegram ID as a unique prefix
const MQTT_BROKER = "wss://broker.emqx.io:8084/mqtt";
const TOPIC_PREFIX = `smartnode/${DEVICE_ID}`;
const TOPIC_SENSORS = `${TOPIC_PREFIX}/sensors`;
const TOPIC_RELAYS_STATE = `${TOPIC_PREFIX}/relays/state`;
const TOPIC_RELAYS_CMD = `${TOPIC_PREFIX}/relays/command`;

interface Relay {
  id: number;
  name: string;
  status: boolean;
}

interface Sensors {
  temperature: number;
  humidity: number;
  lastUpdate: string;
}

interface Variations {
  variation1: boolean;
  variation2: boolean;
}

interface State {
  relays: Relay[];
  sensors: Sensors;
  variations: Variations;
  deviceOnline: boolean;
}

export default function App() {
  const [state, setState] = useState<State>({
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
    },
    deviceOnline: false
  });
  
  const [history, setHistory] = useState<any[]>([]);
  const [mqttStatus, setMqttStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");
  const [command, setCommand] = useState("");
  const [isListening, setIsListening] = useState(false);
  const mqttClient = useRef<mqtt.MqttClient | null>(null);
  const lastHeartbeat = useRef<number>(0);

  // MQTT logic
  useEffect(() => {
    console.log("[MQTT] Connecting to", MQTT_BROKER);
    const client = mqtt.connect(MQTT_BROKER, {
      clientId: `smartnode_web_${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 30000, // Increased to 30s
      reconnectPeriod: 2000,
      protocolVersion: 4,
    });

    mqttClient.current = client;

    client.on("connect", () => {
      console.log("[MQTT] Connected");
      setMqttStatus("connected");
      client.subscribe([TOPIC_SENSORS, TOPIC_RELAYS_STATE, `${TOPIC_PREFIX}/status`], (err) => {
        if (!err) {
          console.log("[MQTT] Subscribed to unique topics:", TOPIC_PREFIX);
          toast.success("Dashboard Online (MQTT Connected)");
        }
      });
    });

    client.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        
        if (topic === TOPIC_SENSORS) {
          lastHeartbeat.current = Date.now();
          setState(prev => ({
            ...prev,
            deviceOnline: true,
            sensors: {
              temperature: payload.temp || prev.sensors.temperature,
              humidity: payload.hum || prev.sensors.humidity,
              lastUpdate: new Date().toISOString()
            }
          }));
        } else if (topic === TOPIC_RELAYS_STATE) {
          lastHeartbeat.current = Date.now();
          setState(prev => ({
            ...prev,
            deviceOnline: true,
            relays: prev.relays.map(r => {
              const statusKey = `r${r.id}`;
              if (payload[statusKey] !== undefined) {
                return { ...r, status: payload[statusKey] };
              }
              return r;
            })
          }));
        } else if (topic === `${TOPIC_PREFIX}/status`) {
          lastHeartbeat.current = Date.now();
          setState(prev => ({ ...prev, deviceOnline: payload.status === "online" }));
        }
      } catch (err) {
        console.error("[MQTT] Error parsing message:", err);
      }
    });

    client.on("close", () => {
      setMqttStatus("disconnected");
    });

    client.on("error", (err) => {
      console.error("[MQTT] Connection Error:", err.message);
      setMqttStatus("disconnected");
      if (err.message.includes("timeout")) {
        toast.error("MQTT Timeout. Mencoba menyambung kembali...");
      }
    });

    client.on("offline", () => {
      console.log("[MQTT] Client Offline");
      setMqttStatus("disconnected");
    });

    // Check device status periodically
    const statusInterval = setInterval(() => {
      if (Date.now() - lastHeartbeat.current > 15000) {
        setState(prev => prev.deviceOnline ? { ...prev, deviceOnline: false } : prev);
      }
    }, 5000);

    return () => {
      client.end();
      clearInterval(statusInterval);
    };
  }, []);

  // Update history for graphs when sensors change
  useEffect(() => {
    const newPoint = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temp: state.sensors.temperature,
      hum: state.sensors.humidity
    };
    setHistory(prev => [...prev, newPoint].slice(-20));
  }, [state.sensors.lastUpdate]);

  const toggleRelay = (id: number, currentStatus: boolean) => {
    if (mqttStatus !== "connected") {
      toast.error("Tidak terhubung ke broker MQTT");
      return;
    }

    const payload = JSON.stringify({ id, status: !currentStatus });
    mqttClient.current?.publish(TOPIC_RELAYS_CMD, payload);
    
    // Optimistic update
    setState(prev => ({
      ...prev,
      relays: prev.relays.map(r => r.id === id ? { ...r, status: !currentStatus } : r)
    }));
    
    toast.info(`Mengirim perintah: Relay ${id} ${!currentStatus ? "ON" : "OFF"}`);
  };

  const toggleVariation = (type: number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // For variations, we can just publish individual relay commands or a special variation command
    // Let's publish a variation command
    mqttClient.current?.publish("smartnode/variations", JSON.stringify({ type, status: nextStatus }));
    
    setState(prev => {
      const newVariations = { ...prev.variations, [type === 1 ? 'variation1' : 'variation2']: nextStatus };
      let newRelays = [...prev.relays];
      
      if (nextStatus) {
        if (type === 1) {
          newRelays = newRelays.map(r => ({ ...r, status: r.id % 2 !== 0 }));
        } else {
          newRelays = newRelays.map(r => ({ ...r, status: r.id % 2 === 0 }));
        }
      }
      return { ...prev, relays: newRelays, variations: newVariations };
    });
    toast.success(`Variasi ${type} ${nextStatus ? "Aktif" : "Mati"}`);
  };

  const sendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim()) return;

    if (mqttStatus !== "connected") {
      toast.error("Broker disconnected");
      return;
    }

    mqttClient.current?.publish("smartnode/voice", JSON.stringify({ text: command }));
    toast("Perintah sent via MQTT", {
      icon: <MessageSquare className="w-4 h-4 ml-1" />
    });
    setCommand("");
  };

  const handleVoiceSim = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      setCommand("Nyalakan Lampu");
      toast.info("Speech Recognized: 'Nyalakan Lampu'");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#E4E4E7] transition-colors duration-300 font-sans selection:bg-primary/30">
      <Toaster position="top-right" richColors />
      
      <main className="max-w-[1200px] mx-auto p-6 space-y-6">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SMART-NODE <span className="text-[#FF6321]">ESP32</span></h1>
            <p className="text-xs text-zinc-500 font-mono">ID: {DEVICE_ID} | MQTT REGION: ASIA-SOUTH</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-white/5">
              <div className={`w-2 h-2 rounded-full transition-all duration-1000 ${state.deviceOnline ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500"}`}></div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                {state.deviceOnline ? "ESP32 Online" : "ESP32 Offline"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-white/5">
              <div className={`w-2 h-2 rounded-full transition-all duration-1000 ${mqttStatus === "connected" ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : mqttStatus === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}></div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                {mqttStatus === "connected" ? "Dashboard Online" : mqttStatus === "connecting" ? "Connecting..." : "Dashboard Offline"}
              </span>
            </div>
          </div>
        </header>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 lg:gap-6">
          
          {/* Temperature Card - Large */}
          <motion.div 
            className="md:col-span-2 md:row-span-1 bento-card flex flex-col justify-between relative overflow-hidden h-[240px] md:h-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Thermometer className="w-32 h-32" />
            </div>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-[0.2em]">Live Temperature</span>
              <div className="flex items-baseline mt-4 group">
                <h2 className="text-7xl md:text-8xl font-light tracking-tighter transition-all duration-300 group-hover:scale-[1.02]">
                  {state?.sensors.temperature.toFixed(1)}
                </h2>
                <span className="text-3xl md:text-4xl text-[#FF6321] ml-2 font-medium">°C</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
              Sensor: DHT11 (GPIO 4)
            </div>
          </motion.div>

          {/* Humidity Card */}
          <motion.div 
            className="md:col-span-1 md:row-span-1 bento-card flex flex-col justify-between h-[240px] md:h-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div>
              <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-[0.2em]">Humidity</span>
              <div className="flex items-baseline mt-4">
                <h2 className="text-5xl md:text-6xl font-light tracking-tighter">{state?.sensors.humidity.toFixed(0)}</h2>
                <span className="text-2xl text-blue-400 ml-1 font-medium">%</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-blue-500 rounded-full" 
                  initial={{ width: 0 }}
                  animate={{ width: `${state?.sensors.humidity}%` }}
                />
              </div>
              <p className="text-[10px] font-mono text-zinc-600 uppercase">Atmospheric Saturation</p>
            </div>
          </motion.div>

          {/* Global Actions Card - Accent Blue/Orange */}
          <motion.div 
            className="md:col-span-1 md:row-span-1 bento-card-accent flex flex-col justify-between h-[240px] md:h-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60">Global Controls</span>
            <div className="space-y-3 my-4">
              <button 
                onClick={() => state?.relays.forEach(r => !r.status && toggleRelay(r.id, false))}
                className="w-full py-4 bg-black text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
              >
                All On
              </button>
              <button 
                onClick={() => state?.relays.forEach(r => r.status && toggleRelay(r.id, true))}
                className="w-full py-4 border-2 border-black rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-black/5 active:scale-[0.98] transition-all"
              >
                All Off
              </button>
            </div>
            <p className="text-[10px] leading-tight font-medium opacity-70">Quick relay override for emergency protocols.</p>
          </motion.div>

          {/* Relay Matrix - 2x2 inside a container */}
          <div className="md:col-span-2 md:row-span-1 grid grid-cols-2 gap-4">
            {state?.relays.map((relay, idx) => (
              <motion.div 
                key={relay.id}
                className="bg-zinc-900 border border-white/5 rounded-[2rem] p-5 flex flex-col justify-between hover:bg-zinc-800/80 transition-all cursor-pointer group"
                onClick={() => toggleRelay(relay.id, relay.status)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + (idx * 0.05) }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">RELAY {relay.id}</p>
                    <h3 className="font-bold text-sm md:text-base group-hover:text-[#FF6321] transition-colors">{relay.name}</h3>
                  </div>
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${relay.status ? "bg-green-500 shadow-[0_0_12px_#22c55e]" : "bg-zinc-700"}`}></div>
                </div>
                <div className={`text-[9px] font-mono py-1 px-2 rounded-md self-start font-bold tracking-widest transition-colors ${relay.status ? "bg-green-500/10 text-green-500" : "bg-zinc-800 text-zinc-500"}`}>
                  {relay.status ? "ACTIVE" : "STANDBY"}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Variations Section */}
          <div className="md:col-span-2 md:row-span-1 grid grid-cols-2 gap-4">
             <motion.div 
              className={`rounded-[2rem] p-6 flex flex-col justify-between cursor-pointer border transition-all ${state?.variations.variation1 ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_10px_30px_rgba(79,70,229,0.3)]" : "bg-zinc-900 border-white/5 text-zinc-400 hover:border-zinc-700"}`}
              onClick={() => toggleVariation(1, state?.variations.variation1 || false)}
              whileHover={{ y: -4 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Variation 1</span>
                <div className={`p-2 rounded-xl ${state?.variations.variation1 ? "bg-white/20" : "bg-zinc-800"}`}>
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg">Alternating</h3>
                <p className={`text-[10px] mt-1 ${state?.variations.variation1 ? "text-indigo-100" : "text-zinc-500"}`}>Odd relays toggle sequence</p>
              </div>
            </motion.div>

            <motion.div 
              className={`rounded-[2rem] p-6 flex flex-col justify-between cursor-pointer border transition-all ${state?.variations.variation2 ? "bg-cyan-600 border-cyan-400 text-white shadow-[0_10px_30px_rgba(8,145,178,0.3)]" : "bg-zinc-900 border-white/5 text-zinc-400 hover:border-zinc-700"}`}
              onClick={() => toggleVariation(2, state?.variations.variation2 || false)}
              whileHover={{ y: -4 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Variation 2</span>
                <div className={`p-2 rounded-xl ${state?.variations.variation2 ? "bg-white/20" : "bg-zinc-800"}`}>
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg">Inversion</h3>
                <p className={`text-[10px] mt-1 ${state?.variations.variation2 ? "text-cyan-100" : "text-zinc-500"}`}>Even relays toggle sequence</p>
              </div>
            </motion.div>
          </div>

          {/* Console / Telegram Log */}
          <motion.div 
            className="md:col-span-2 md:row-span-1 bg-zinc-900/30 rounded-[2rem] border border-white/5 p-6 flex flex-col min-h-[240px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-zinc-500" />
                <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Telegram Log</span>
              </div>
              <span className="text-[9px] text-[#FF6321] font-mono bg-[#FF6321]/10 px-2 py-0.5 rounded border border-[#FF6321]/20">ID: 8611103848</span>
            </div>
            
            <div className="flex-grow space-y-3 font-mono text-[10px] overflow-hidden overflow-y-auto pr-2 custom-scrollbar">
               <div className="flex gap-3 text-zinc-500/80">
                <span className="w-14">Live</span>
                <span className="text-zinc-600">---</span>
                <span className="text-zinc-600 italic">Connected to {MQTT_BROKER}</span>
              </div>
              <div className="flex gap-3 text-zinc-500/80">
                <span className="w-14">Topic</span>
                <span className="text-zinc-400">{TOPIC_SENSORS}</span>
              </div>
              <div className="flex gap-3 text-zinc-500/80">
                <span className="w-14">Status</span>
                <span className="text-green-500/80 italic">Streaming updates via WebSocket...</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Last Auth: 3s ago</span>
              <div className="flex gap-1.5">
                <div className="w-1 h-1 bg-zinc-700 rounded-full"></div>
                <div className="w-1 h-1 bg-zinc-700 rounded-full"></div>
                <div className="w-1 h-1 bg-[#FF6321] rounded-full animate-pulse shadow-[0_0_5px_#FF6321]"></div>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Footer Info Rail */}
        <footer className="mt-12 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-700 py-6 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Radio className="w-3 h-3" />
            <span>Architecture: ESP32-WROOM-32 (TENZIL-L)</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> Uptime: 12h 44m</span>
            <span className="flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> RSSI: -54 dBm</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> Memory: 74% Free</span>
          </div>
        </footer>

        {/* Floating Command Bar for Voice/Manual (Simplified) */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-6">
           <form onSubmit={sendCommand} className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex gap-2 shadow-2xl">
              <input 
                type="text" 
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Terminal Command..."
                className="flex-1 bg-transparent px-4 py-2 text-xs font-mono focus:outline-none placeholder:text-zinc-600"
              />
              <Button type="submit" size="icon" className="rounded-full bg-[#FF6321] hover:bg-[#FF6321]/90">
                {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
              </Button>
           </form>
        </div>
      </main>
    </div>
  );
}
