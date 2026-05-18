import React, { useState, useEffect, useRef } from "react";
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
  Mic
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
}

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Fetch initial state
  const fetchStatus = async () => {
    console.log("[Client] Fetching status...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("/api/status", { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (!data || !data.sensors) throw new Error("Invalid data received from server");

      setState(data);
      setError(null);
      
      // Update history for graphs
      setHistory(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temp: data.sensors.temperature,
          hum: data.sensors.humidity
        };
        const next = [...prev, newPoint].slice(-20); // Keep last 20 points
        return next;
      });
      
      setLoading(false);
    } catch (e: any) {
      console.error("[Client] Error fetching status:", e);
      if (e.name === 'AbortError') {
        setError("Request timeout. Server is slow to respond.");
      } else {
        setError(e.message || "Gagal terhubung ke backend");
      }
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleRelay = async (id: number, currentStatus: boolean) => {
    try {
      const response = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: !currentStatus }),
      });
      const data = await response.json();
      if (data.success) {
        setState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            relays: prev.relays.map(r => r.id === id ? { ...r, status: !currentStatus } : r)
          };
        });
        toast.success(`${data.relay.name} ${!currentStatus ? "Aktif" : "Mati"}`);
      }
    } catch (error) {
      toast.error("Gagal mengubah status relay");
    }
  };

  const toggleVariation = async (type: number, currentStatus: boolean) => {
    try {
      const response = await fetch("/api/variation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, status: !currentStatus }),
      });
      const data = await response.json();
      if (data.success) {
        fetchStatus(); // Refresh all state
        toast.success(`Variasi ${type} ${!currentStatus ? "Aktif" : "Mati"}`);
      }
    } catch (error) {
      toast.error("Gagal mengubah variasi");
    }
  };

  const sendCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim()) return;

    try {
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: command }),
      });
      const data = await response.json();
      toast(data.message, {
        icon: <MessageSquare className="w-4 h-4 ml-1" />
      });
      if (data.state) setState(data.state);
      setCommand("");
    } catch (error) {
      toast.error("Gagal mengirim perintah");
    }
  };

  const handleVoiceSim = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      setCommand("Nyalakan Lampu");
      toast.info("Mendengar: 'Nyalakan Lampu'");
    }, 2000);
  };

  if (loading && !state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0A0C] text-white p-4 text-center">
        <Toaster position="top-right" richColors />
        <AnimatePresence mode="wait">
          {!error ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mb-8"
                >
                  <RefreshCw className="w-16 h-16 text-[#FF6321]" />
                </motion.div>
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Zap className="w-6 h-6 text-[#FF6321] opacity-50" />
                </motion.div>
              </div>
              <h2 className="text-xl font-bold mb-2">Connecting to SmartNode... v2.1</h2>
              <p className="text-zinc-500 max-w-xs">Establishing secure connection to ESP32 Gateway</p>
              <div className="mt-4 text-[10px] text-zinc-800 uppercase tracking-widest">
                ID: {Math.random().toString(36).substring(7)}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="bg-red-500/10 p-4 rounded-3xl mb-6 border border-red-500/20">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
              <p className="text-zinc-500 mb-8 max-w-xs">{error}</p>
              <div className="flex gap-4">
                <Button 
                  className="bg-white/10 hover:bg-white/20 border-white/5 px-8" 
                  onClick={() => fetchStatus()}
                >
                  Retry
                </Button>
                <Button 
                  variant="outline"
                  className="border-[#FF6321] text-[#FF6321] hover:bg-[#FF6321]/10 px-8"
                  onClick={() => {
                    // Mock data so user can see it
                    setLoading(false);
                    setState({
                      relays: [
                        { id: 1, name: "Lampu 1", status: false },
                        { id: 2, name: "Lampu 2", status: false },
                        { id: 3, name: "Lampu 3", status: false },
                        { id: 4, name: "Lampu 4", status: false },
                      ],
                      sensors: { temperature: 0, humidity: 0, lastUpdate: new Date().toISOString() },
                      variations: { variation1: false, variation2: false }
                    });
                  }}
                >
                  Enter Offline Mode
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#E4E4E7] transition-colors duration-300 font-sans selection:bg-primary/30">
      <Toaster position="top-right" richColors />
      
      <main className="max-w-[1200px] mx-auto p-6 space-y-6">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SMART-NODE <span className="text-[#FF6321]">ESP32</span></h1>
            <p className="text-xs text-zinc-500 font-mono">ID: 8749143834 | GATEWAY: 192.168.1.104</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">WiFi Connected</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Bot Online</span>
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
                <span className="w-14">14:22:15</span>
                <span className="text-blue-400 font-bold">USER</span>
                <span className="text-zinc-400">/r1_on</span>
              </div>
              <div className="flex gap-3 text-green-500/90">
                <span className="w-14">14:22:16</span>
                <span className="text-[#FF6321] font-bold">BOT</span>
                <span className="italic">OK: Relay 1 set to ACTIVE</span>
              </div>
              <div className="flex gap-3 text-zinc-500/80">
                <span className="w-14">14:24:02</span>
                <span className="text-blue-400 font-bold">USER</span>
                <span className="text-zinc-400">/dht</span>
              </div>
              <div className="flex gap-3 text-zinc-400">
                <span className="w-14">14:24:03</span>
                <span className="text-[#FF6321] font-bold">BOT</span>
                <span>DATA: T={state?.sensors.temperature.toFixed(1)}°C H={state?.sensors.humidity.toFixed(0)}%</span>
              </div>
              <div className="flex gap-3 text-zinc-500/80">
                <span className="w-14">Refresh</span>
                <span className="text-zinc-600">---</span>
                <span className="text-zinc-600 italic">Streaming updates via WebSocket...</span>
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
