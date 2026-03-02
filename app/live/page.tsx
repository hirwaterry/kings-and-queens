"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Sword, Users, Zap, Star, Shield,
  Trophy, Copy, Check, ArrowRight, LogIn,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type AppView = "home" | "host-lobby" | "guest-join" | "guest-lobby" | "revealing" | "revealed";
type HeroRole = "king" | "queen";

interface Hero { id: string; name: string; role: HeroRole; }
interface Pair  { id: string; king: string; queen: string; }
interface Reaction { id: string; emoji: string; x: number; }

// ─── Constants ───────────────────────────────────────────────────────────────
const SESSION_CODE   = "WK12";
const REACTION_EMOJIS = ["👑", "❤️", "🔥", "⚔️", "✨", "🎉"];
const FAKE_JOINERS: Hero[] = [
  { id: "f1", name: "Kalisa",    role: "queen" },
  { id: "f2", name: "Mugisha",   role: "king"  },
  { id: "f3", name: "Uwera",     role: "queen" },
  { id: "f4", name: "Nshimiye",  role: "king"  },
  { id: "f5", name: "Ingabire",  role: "queen" },
  { id: "f6", name: "Habimana",  role: "king"  },
];

// ─── Utility: generate all pairs ────────────────────────────────────────────
function generateAllPairs(heroes: Hero[]): Pair[] {
  const kings  = [...heroes.filter((h) => h.role === "king" )].sort(() => Math.random() - 0.5);
  const queens = [...heroes.filter((h) => h.role === "queen")].sort(() => Math.random() - 0.5);
  const count  = Math.min(kings.length, queens.length);
  return Array.from({ length: count }, (_, i) => ({
    id:    Math.random().toString(36).slice(2) + Date.now().toString(36) + i,
    king:  kings[i].name,
    queen: queens[i].name,
  }));
}

// ─── Floating Reaction ───────────────────────────────────────────────────────
const FloatingReaction = ({ reaction, onDone }: { reaction: Reaction; onDone: () => void }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 0.6 }}
    animate={{ opacity: 0, y: -100, scale: 1.5 }}
    transition={{ duration: 1.8, ease: "easeOut" }}
    onAnimationComplete={onDone}
    className="absolute bottom-4 pointer-events-none text-2xl select-none z-10"
    style={{ left: `${reaction.x}%` }}
  >{reaction.emoji}</motion.div>
);

// ─── QR Visual ───────────────────────────────────────────────────────────────
const QRVisual = ({ code }: { code: string }) => (
  <div className="relative w-40 h-40 mx-auto">
    {["top-0 left-0","top-0 right-0","bottom-0 left-0","bottom-0 right-0"].map((pos, i) => (
      <motion.div key={i} animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2, repeat:Infinity, delay:i*0.3 }}
        className={`absolute w-6 h-6 ${pos}`}
        style={{
          borderTop:    i < 2      ? "2px solid #ef4444" : "none",
          borderBottom: i >= 2     ? "2px solid #ef4444" : "none",
          borderLeft:   i % 2 ===0 ? "2px solid #ef4444" : "none",
          borderRight:  i % 2 ===1 ? "2px solid #ef4444" : "none",
        }} />
    ))}
    <div className="absolute inset-3 bg-white/5 rounded-lg border border-white/10 grid grid-cols-7 grid-rows-7 gap-0.5 p-1">
      {Array.from({ length:49 }).map((_,i) => {
        const filled = [0,1,2,3,4,5,6,7,13,14,20,21,27,28,34,35,41,42,43,44,45,46,48,10,12,15,25,36,38].includes(i);
        return <div key={i} className={`rounded-[1px] ${filled?"bg-white/80":"bg-transparent"}`}/>;
      })}
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/50">
        <Crown className="w-4 h-4 text-white"/>
      </div>
    </div>
    <motion.div animate={{ top:["15%","85%","15%"] }} transition={{ duration:2.5, repeat:Infinity, ease:"easeInOut" }}
      className="absolute left-3 right-3 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent"/>
    <p className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-black font-mono tracking-[0.3em] text-white/50 whitespace-nowrap">{code}</p>
  </div>
);

// ─── Hero Chip ───────────────────────────────────────────────────────────────
const HeroChip = ({ hero, index }: { hero: Hero; index: number }) => (
  <motion.div initial={{ opacity:0, scale:0.7, y:8 }} animate={{ opacity:1, scale:1, y:0 }}
    transition={{ delay:index*0.07, type:"spring" }}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold
                ${hero.role==="king"?"bg-yellow-400/10 border-yellow-400/25 text-yellow-300":"bg-rose-400/10 border-rose-400/25 text-rose-300"}`}>
    <span>{hero.role==="king"?"⚔️":"👑"}</span>
    <span>{hero.name}</span>
  </motion.div>
);

// ─── Stats Row ───────────────────────────────────────────────────────────────
const StatsRow = ({ total, kings, queens }: { total:number; kings:number; queens:number }) => (
  <div className="grid grid-cols-3 gap-3">
    {[
      { label:"Total",  value:total,  icon:"🧙", color:"text-white"      },
      { label:"Kings",  value:kings,  icon:"⚔️", color:"text-yellow-300" },
      { label:"Queens", value:queens, icon:"👑", color:"text-rose-300"   },
    ].map((s) => (
      <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
        <span className="text-lg">{s.icon}</span>
        <motion.span key={s.value} initial={{ scale:1.4 }} animate={{ scale:1 }} className={`text-2xl font-black ${s.color}`}>{s.value}</motion.span>
        <span className="text-[10px] text-white/30 tracking-widest uppercase">{s.label}</span>
      </div>
    ))}
  </div>
);

// ─── Lobby List ──────────────────────────────────────────────────────────────
const LobbyList = ({ heroes }: { heroes: Hero[] }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
    <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase mb-3 flex items-center gap-2">
      <Users className="w-3 h-3"/> Heroes in lobby
    </p>
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {heroes.map((h,i) => <HeroChip key={h.id} hero={h} index={i}/>)}
      </AnimatePresence>
    </div>
  </div>
);

// ─── Big Featured Pair Card ──────────────────────────────────────────────────
const FeaturedPairCard = ({ pair, isYours }: { pair: Pair; isYours: boolean }) => (
  <motion.div initial={{ opacity:0, y:30, scale:0.92 }} animate={{ opacity:1, y:0, scale:1 }}
    transition={{ duration:0.6, type:"spring", bounce:0.3 }}
    className="relative w-full rounded-3xl overflow-hidden">
    {isYours && (
      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5
                   px-3 py-1 rounded-full bg-blue-500/90 backdrop-blur-sm border border-blue-400/50 shadow-lg shadow-blue-500/30">
        <span className="text-[10px] font-black text-white tracking-widest uppercase">Your Pair ✦</span>
      </motion.div>
    )}
    <div className={`relative p-6 pt-10 rounded-3xl border-2
                     ${isYours
                       ?"bg-gradient-to-br from-yellow-900/30 via-[#1a1208] to-rose-900/30 border-yellow-400/40"
                       :"bg-gradient-to-br from-yellow-900/20 via-[#141210] to-rose-900/20 border-yellow-400/25"}`}
      style={isYours?{boxShadow:"0 0 60px rgba(250,204,21,0.12), 0 0 30px rgba(251,113,133,0.08)"}:{}}>
      {/* Week badge */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-yellow-400/30"/>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/12">
          <Trophy className="w-3.5 h-3.5 text-yellow-400"/>
          <span className="text-[10px] font-mono text-yellow-400 tracking-widest uppercase font-bold">Week 12</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-rose-400/30"/>
      </div>
      {/* Cards row */}
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {/* King */}
        <motion.div initial={{ opacity:0, scale:0.5, rotateY:90 }} animate={{ opacity:1, scale:1, rotateY:0 }}
          transition={{ delay:0.15, duration:0.65, type:"spring", bounce:0.35 }}
          className="relative flex flex-col items-center flex-1">
          <motion.div animate={{ scale:[1,1.12,1], opacity:[0.25,0.55,0.25] }} transition={{ duration:2.5, repeat:Infinity }}
            className="absolute inset-0 rounded-3xl blur-2xl -z-10 bg-yellow-400/30"/>
          <div className="w-full max-w-[160px] rounded-2xl border-2 border-yellow-400/40 p-4 flex flex-col items-center gap-2.5
                          bg-gradient-to-b from-yellow-400/15 to-yellow-900/10"
            style={{ boxShadow:"0 0 30px rgba(250,204,21,0.18)" }}>
            <div className="w-14 h-14 rounded-xl bg-yellow-400/20 flex items-center justify-center text-3xl">⚔️</div>
            <div className="text-center">
              <p className="text-yellow-300 font-black text-base tracking-tight">{pair.king}</p>
              <p className="text-[9px] text-white/40 font-mono tracking-widest uppercase mt-0.5">King of the Week</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 text-[10px] font-bold">
              <Zap className="w-2.5 h-2.5"/>+500 XP
            </div>
          </div>
        </motion.div>
        {/* Heart */}
        <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ delay:0.6, type:"spring" }} className="flex flex-col items-center gap-1 shrink-0">
          <motion.div animate={{ scale:[1,1.35,1] }} transition={{ duration:1.4, repeat:Infinity }} className="text-xl">❤️</motion.div>
          <div className="w-px h-6 bg-gradient-to-b from-yellow-400/30 to-rose-400/30"/>
          <Shield className="w-3.5 h-3.5 text-white/20"/>
        </motion.div>
        {/* Queen */}
        <motion.div initial={{ opacity:0, scale:0.5, rotateY:-90 }} animate={{ opacity:1, scale:1, rotateY:0 }}
          transition={{ delay:0.3, duration:0.65, type:"spring", bounce:0.35 }}
          className="relative flex flex-col items-center flex-1">
          <motion.div animate={{ scale:[1,1.12,1], opacity:[0.25,0.55,0.25] }} transition={{ duration:2.5, repeat:Infinity, delay:0.4 }}
            className="absolute inset-0 rounded-3xl blur-2xl -z-10 bg-rose-400/30"/>
          <div className="w-full max-w-[160px] rounded-2xl border-2 border-rose-400/40 p-4 flex flex-col items-center gap-2.5
                          bg-gradient-to-b from-rose-400/15 to-rose-900/10"
            style={{ boxShadow:"0 0 30px rgba(251,113,133,0.18)" }}>
            <div className="w-14 h-14 rounded-xl bg-rose-400/20 flex items-center justify-center text-3xl">👑</div>
            <div className="text-center">
              <p className="text-rose-300 font-black text-base tracking-tight">{pair.queen}</p>
              <p className="text-[9px] text-white/40 font-mono tracking-widest uppercase mt-0.5">Queen of the Week</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-400 text-[10px] font-bold">
              <Zap className="w-2.5 h-2.5"/>+500 XP
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </motion.div>
);

// ─── Small Pair Row ──────────────────────────────────────────────────────────
const SmallPairRow = ({ pair, index, highlight }: { pair: Pair; index: number; highlight: boolean }) => (
  <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
    transition={{ delay:0.1+index*0.06, type:"spring" }}
    className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all
                ${highlight
                  ?"bg-blue-500/8 border-blue-500/25 hover:border-blue-500/40"
                  :"bg-white/5 border-white/8 hover:bg-white/8 hover:border-white/15"}`}>
    {highlight && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-400"/>}
    <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-[11px] font-mono text-white/30 shrink-0">
      {String(index+1).padStart(2,"0")}
    </div>
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className="w-6 h-6 rounded-lg bg-yellow-400/15 flex items-center justify-center text-sm shrink-0">⚔️</div>
      <p className="text-yellow-300 font-semibold text-sm truncate">{pair.king}</p>
    </div>
    <div className="flex items-center gap-1 shrink-0 px-1">
      <div className="w-3 h-px bg-yellow-400/30"/>
      <span className="text-xs">❤️</span>
      <div className="w-3 h-px bg-rose-400/30"/>
    </div>
    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
      <p className="text-rose-300 font-semibold text-sm truncate text-right">{pair.queen}</p>
      <div className="w-6 h-6 rounded-lg bg-rose-400/15 flex items-center justify-center text-sm shrink-0">👑</div>
    </div>
    {highlight && (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold shrink-0">YOU</span>
    )}
  </motion.div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function LivePairPage() {
  const [view,       setView      ] = useState<AppView>("home");
  const [heroes,     setHeroes    ] = useState<Hero[]>([]);
  const [allPairs,   setAllPairs  ] = useState<Pair[]>([]);
  const [isHost,     setIsHost    ] = useState(false);

  // Guest form
  const [guestName, setGuestName] = useState("");
  const [guestRole, setGuestRole] = useState<HeroRole | null>(null);
  const [joinCode,  setJoinCode  ] = useState("");
  const [formError, setFormError ] = useState("");

  // Reactions
  const [reactions,      setReactions     ] = useState<Reaction[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string,number>>({
    "❤️":12, "🔥":8, "👑":19, "⚔️":5,
  });

  // Misc
  const [featuredPair, setFeaturedPair] = useState<Pair | null>(null);
  const [copied,       setCopied      ] = useState(false);
  const [confetti,     setConfetti    ] = useState(false);
  const joinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate others joining
  useEffect(() => {
    if (view !== "host-lobby" && view !== "guest-lobby") return;
    let i = 0;
    joinIntervalRef.current = setInterval(() => {
      if (i < FAKE_JOINERS.length) {
        const joiner = FAKE_JOINERS[i];
        setHeroes((prev) => prev.find((h) => h.id === joiner.id) ? prev : [...prev, joiner]);
        i++;
      } else clearInterval(joinIntervalRef.current!);
    }, 1100);
    return () => { if (joinIntervalRef.current) clearInterval(joinIntervalRef.current!); };
  }, [view]);

  // Auto-reactions after reveal
  useEffect(() => {
    if (view !== "revealed") return;
    const t = setInterval(() => {
      const emoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
      const id    = Math.random().toString(36).slice(2) + Date.now().toString(36);
      setReactions((prev) => [...prev.slice(-10), { id, emoji, x: 5 + Math.random() * 85 }]);
      setReactionCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    }, 550);
    return () => clearInterval(t);
  }, [view]);

  // ── Safe hero list (no undefined) ──────────────────────────────────────────
  const safeHeroes  = heroes.filter((h) => h && typeof h.role === "string");
  const kingCount   = safeHeroes.filter((h) => h.role === "king" ).length;
  const queenCount  = safeHeroes.filter((h) => h.role === "queen").length;
  const canStart    = safeHeroes.length >= 2 && kingCount >= 1 && queenCount >= 1;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleHostSession = () => {
    setIsHost(true); setHeroes([]); setAllPairs([]); setFeaturedPair(null);
    setView("host-lobby");
  };

  const handleGuestCodeSubmit = () => {
    if (!joinCode.trim())                                      { setFormError("Enter the session code!"); return; }
    if (joinCode.trim().toUpperCase() !== SESSION_CODE)        { setFormError("Invalid code — try WK12 for demo!"); return; }
    setFormError(""); setView("guest-join");
  };

  const handleGuestEnterLobby = () => {
    if (!guestName.trim()) { setFormError("Enter your hero name!"); return; }
    if (!guestRole)         { setFormError("Choose King or Queen!"); return; }
    setFormError("");
    const me: Hero = { id: "me-" + Date.now().toString(36), name: guestName.trim(), role: guestRole };
    setHeroes([me]); setIsHost(false); setView("guest-lobby");
  };

  // ── START PAIRING — generates ALL pairs ────────────────────────────────────
  const handleStartPairing = () => {
    setView("revealing");
    setTimeout(() => {
      const pairs = generateAllPairs(safeHeroes);

      // For guests: find the pair containing their name
      const myName = guestName.trim();
      const myPair = pairs.find(
        (p) => p.king === myName || p.queen === myName
      ) ?? pairs[0];                                          // fallback to first

      setAllPairs(pairs);
      setFeaturedPair(myPair);
      setView("revealed");
      setConfetti(true);
      setTimeout(() => setConfetti(false), 4000);
    }, 3000);
  };

  const handleReact = (emoji: string) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    setReactions((prev) => [...prev.slice(-10), { id, emoji, x: 5 + Math.random() * 85 }]);
    setReactionCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setView("home"); setHeroes([]); setAllPairs([]); setFeaturedPair(null);
    setGuestName(""); setGuestRole(null); setJoinCode(""); setFormError("");
  };

  // ── Shared BG ──────────────────────────────────────────────────────────────
  const Bg = () => (
    <div className="fixed inset-0 pointer-events-none">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/15 rounded-full blur-[140px]"/>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-900/10 rounded-full blur-[120px]"/>
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize:"40px 40px" }}/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white overflow-x-hidden">
      <Bg/>

      {/* Confetti */}
      <AnimatePresence>
        {confetti && Array.from({ length:22 }).map((_,i) => (
          <motion.div key={i}
            initial={{ opacity:1, y:-20, x:`${Math.random()*100}vw`, rotate:0 }}
            animate={{ opacity:0, y:"100vh", rotate:Math.random()*720-360 }}
            transition={{ duration:3+Math.random()*2, delay:Math.random()*0.5 }}
            className="fixed top-0 w-2 h-3 rounded-sm pointer-events-none z-50"
            style={{ background:["#ef4444","#facc15","#f472b6","#60a5fa","#34d399"][i%5] }}/>
        ))}
      </AnimatePresence>

      <div className="relative z-10 container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* ══ HOME ══════════════════════════════════════════════════════════ */}
        {view === "home" && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col gap-5">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.2, repeat:Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                <span className="text-xs font-mono tracking-widest text-red-400 uppercase">Live Pairing</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-2">
                <span className="text-white">Royal </span>
                <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Session</span>
              </h1>
              <p className="text-white/30 text-sm">Host a pairing or join one with a code</p>
            </div>

            {/* Host */}
            <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} onClick={handleHostSession}
              className="w-full p-6 rounded-3xl bg-gradient-to-br from-red-600/20 to-rose-900/20
                         border border-red-500/30 text-left group hover:border-red-500/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0 group-hover:bg-red-500/30 transition-colors">
                  <Crown className="w-6 h-6 text-red-400"/>
                </div>
                <div className="flex-1">
                  <p className="text-white font-black text-lg leading-tight">Host a Session</p>
                  <p className="text-white/40 text-sm mt-1 leading-relaxed">Create a live pairing. Get a QR code & session code to share.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-red-400/60 group-hover:text-red-400 mt-1 transition-colors"/>
              </div>
            </motion.button>

            {/* Join */}
            <div className="w-full p-6 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                  <LogIn className="w-6 h-6 text-yellow-400"/>
                </div>
                <div>
                  <p className="text-white font-black text-lg leading-tight">Join a Session</p>
                  <p className="text-white/40 text-sm mt-1">Enter the code shared by the host</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setFormError(""); }}
                  onKeyDown={(e) => e.key==="Enter" && handleGuestCodeSubmit()}
                  placeholder="e.g. WK12" maxLength={6}
                  className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3
                             text-white placeholder-white/20 text-sm font-mono font-bold tracking-widest uppercase
                             focus:outline-none focus:border-yellow-500/50 focus:bg-white/10 transition-all"/>
                <motion.button whileTap={{ scale:0.97 }} onClick={handleGuestCodeSubmit}
                  className="px-5 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900
                             rounded-xl font-black text-sm shadow-lg shadow-yellow-500/20 shrink-0">Join</motion.button>
              </div>
              <AnimatePresence>
                {formError && view==="home" && (
                  <motion.p initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                    className="text-red-400 text-xs mt-2 flex items-center gap-1"><span>⚠</span>{formError}</motion.p>
                )}
              </AnimatePresence>
              <p className="text-white/20 text-[11px] font-mono mt-3 text-center">or scan the QR code shared by the host</p>
            </div>
          </motion.div>
        )}

        {/* ══ GUEST JOIN FORM ═══════════════════════════════════════════════ */}
        {view === "guest-join" && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col gap-5">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                <span className="text-xs font-mono tracking-widest text-green-400 uppercase">Code Verified ✓</span>
              </div>
              <h1 className="text-3xl font-black mb-1">Choose Your Class</h1>
              <p className="text-white/30 text-sm">Enter your name and pick King or Queen</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-5">
              <div>
                <label className="block text-[11px] text-white/40 tracking-widest uppercase mb-2 font-mono">Hero Name</label>
                <input type="text" value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setFormError(""); }}
                  onKeyDown={(e) => e.key==="Enter" && handleGuestEnterLobby()}
                  placeholder="Enter your name..."
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3.5
                             text-white placeholder-white/20 text-sm font-medium
                             focus:outline-none focus:border-red-500/50 focus:bg-white/10 transition-all"/>
              </div>
              <div>
                <label className="block text-[11px] text-white/40 tracking-widest uppercase mb-2 font-mono">Choose Class</label>
                <div className="flex gap-3">
                  {(["king","queen"] as HeroRole[]).map((r) => (
                    <motion.button key={r} whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                      onClick={() => { setGuestRole(r); setFormError(""); }}
                      className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all relative overflow-hidden
                                  ${guestRole===r
                                    ? r==="king"?"border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20"
                                               :"border-rose-400 bg-rose-400/10 shadow-lg shadow-rose-400/20"
                                    :"border-white/10 bg-white/5 hover:border-white/20"}`}>
                      {guestRole===r && (
                        <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
                          className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold
                                      ${r==="king"?"bg-yellow-400 text-yellow-900":"bg-rose-400 text-rose-900"}`}>✓</motion.div>
                      )}
                      <span className="text-3xl">{r==="king"?"⚔️":"👑"}</span>
                      <p className={`text-xs font-bold tracking-widest uppercase ${guestRole===r?r==="king"?"text-yellow-300":"text-rose-300":"text-white/40"}`}>
                        {r==="king"?"King":"Queen"}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>
              <AnimatePresence>
                {formError && (
                  <motion.p initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                    className="text-red-400 text-xs flex items-center gap-1"><span>⚠</span>{formError}</motion.p>
                )}
              </AnimatePresence>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={handleGuestEnterLobby}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-500 rounded-xl
                           font-black text-sm tracking-wide shadow-lg shadow-red-500/25 flex items-center justify-center gap-2">
                <Sword className="w-4 h-4"/>Join the Live Pairing
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ══ HOST LOBBY ════════════════════════════════════════════════════ */}
        {view === "host-lobby" && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col gap-5">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:1, repeat:Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                <span className="text-xs font-mono tracking-widest text-red-400 uppercase">You're the Host · Session Open</span>
              </div>
              <h1 className="text-3xl font-black mb-1">Share & Wait</h1>
              <p className="text-white/30 text-sm">Heroes are joining your session</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-6">
              <QRVisual code={SESSION_CODE}/>
              <div className="w-full mt-4">
                <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase text-center mb-2">Or share this code</p>
                <div className="flex items-center gap-2 bg-white/8 border border-white/12 rounded-xl px-4 py-3">
                  <span className="flex-1 text-center font-black font-mono text-2xl tracking-[0.3em] text-white">{SESSION_CODE}</span>
                  <motion.button whileTap={{ scale:0.9 }} onClick={() => handleCopy(SESSION_CODE)}
                    className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-400"/> : <Copy className="w-4 h-4 text-white/50"/>}
                  </motion.button>
                </div>
              </div>
            </div>
            <StatsRow total={safeHeroes.length} kings={kingCount} queens={queenCount}/>
            {safeHeroes.length > 0 && <LobbyList heroes={safeHeroes}/>}
            <AnimatePresence>
              {canStart ? (
                <motion.div initial={{ opacity:0,y:15 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}>
                  <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={handleStartPairing}
                    className="w-full py-4 rounded-2xl font-black text-base tracking-wide
                               bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 text-gray-900
                               shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all
                               flex items-center justify-center gap-2">
                    <Crown className="w-5 h-5"/>Start the Royal Pairing<Sword className="w-5 h-5"/>
                  </motion.button>
                  <p className="text-center text-[11px] text-white/25 mt-2 font-mono">
                    Only you (the host) can start · {safeHeroes.length} heroes ready
                  </p>
                </motion.div>
              ) : (
                <p className="text-center text-white/20 text-xs font-mono py-2">✦ waiting for at least 1 King & 1 Queen ✦</p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ══ GUEST LOBBY ═══════════════════════════════════════════════════ */}
        {view === "guest-lobby" && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col gap-5">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:1, repeat:Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                <span className="text-xs font-mono tracking-widest text-green-400 uppercase">You're in the Lobby!</span>
              </div>
              <h1 className="text-3xl font-black mb-1">Waiting for Host</h1>
              <p className="text-white/30 text-sm">The host will start when everyone's ready</p>
            </div>
            {safeHeroes.find((h) => h.id.startsWith("me-")) && (() => {
              const me = safeHeroes.find((h) => h.id.startsWith("me-"))!;
              return (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${me.role==="king"?"bg-yellow-400/15":"bg-rose-400/15"}`}>
                    {me.role==="king"?"⚔️":"👑"}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{me.name}</p>
                    <p className={`text-[11px] font-mono ${me.role==="king"?"text-yellow-400/60":"text-rose-400/60"}`}>
                      {me.role==="king"?"King · You":"Queen · You"}
                    </p>
                  </div>
                  <div className="ml-auto px-2 py-1 rounded-full bg-blue-500/15 border border-blue-500/20">
                    <span className="text-[10px] text-blue-400 font-mono font-bold">YOU</span>
                  </div>
                </div>
              );
            })()}
            <StatsRow total={safeHeroes.length} kings={kingCount} queens={queenCount}/>
            {safeHeroes.length > 0 && <LobbyList heroes={safeHeroes}/>}
            <div className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/3 border border-white/8">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <motion.div key={i} animate={{ scale:[1,1.5,1], opacity:[0.3,1,0.3] }}
                    transition={{ duration:0.8, repeat:Infinity, delay:i*0.25 }}
                    className="w-1.5 h-1.5 rounded-full bg-yellow-400"/>
                ))}
              </div>
              <p className="text-white/30 text-xs font-mono">Waiting for host to start...</p>
            </div>
          </motion.div>
        )}

        {/* ══ REVEALING ═════════════════════════════════════════════════════ */}
        {view === "revealing" && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex flex-col items-center gap-8 py-10">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <motion.div animate={{ rotate:360 }} transition={{ duration:3, repeat:Infinity, ease:"linear" }}
                className="absolute inset-0 rounded-full border border-dashed border-yellow-400/20"/>
              <motion.div animate={{ rotate:-360 }} transition={{ duration:2, repeat:Infinity, ease:"linear" }}
                className="absolute inset-4 rounded-full border border-dashed border-red-400/30"/>
              <motion.div animate={{ scale:[1,1.3,1], opacity:[0.3,0.7,0.3] }} transition={{ duration:1.2, repeat:Infinity }}
                className="absolute inset-8 rounded-full bg-yellow-400/20 blur-lg"/>
              <motion.div animate={{ scale:[1,1.1,1], rotate:[0,5,-5,0] }} transition={{ duration:0.8, repeat:Infinity }}
                className="relative z-10 text-5xl">👑</motion.div>
              {[0,60,120,180,240,300].map((deg,i) => (
                <motion.div key={i} animate={{ rotate:360 }} transition={{ duration:2.5, repeat:Infinity, ease:"linear", delay:i*0.1 }} className="absolute inset-0">
                  <div className="absolute w-2 h-2 rounded-full bg-yellow-400/60"
                    style={{ top:"50%",left:"50%",transform:`rotate(${deg}deg) translateX(65px) translate(-50%,-50%)` }}/>
                </motion.div>
              ))}
            </div>
            <div className="text-center">
              <motion.p animate={{ opacity:[0.5,1,0.5] }} transition={{ duration:1.5, repeat:Infinity }}
                className="text-white/60 text-sm font-mono tracking-widest uppercase">The Royal Spirits Are Choosing...</motion.p>
              <div className="flex justify-center gap-1 mt-3">
                {[0,1,2].map(i => (
                  <motion.div key={i} animate={{ scale:[1,1.5,1], opacity:[0.3,1,0.3] }}
                    transition={{ duration:0.8, repeat:Infinity, delay:i*0.25 }}
                    className="w-1.5 h-1.5 rounded-full bg-yellow-400"/>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ REVEALED ══════════════════════════════════════════════════════ */}
        {view === "revealed" && featuredPair && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex flex-col items-center gap-5 w-full">

            {/* Title */}
            <div className="text-center mb-1">
              <motion.h1 initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }}
                className="text-4xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-rose-400 bg-clip-text text-transparent mb-1">
                The Royal Pairs! 👑
              </motion.h1>
              <p className="text-white/30 text-sm">{allPairs.length} pair{allPairs.length!==1?"s":""} forged this week</p>
            </div>

            {/* ── YOUR / FEATURED big pair ── */}
            {!isHost && (
              <p className="text-[10px] text-blue-400 font-mono tracking-widest uppercase -mb-2">
                ✦ your destined pair ✦
              </p>
            )}
            <FeaturedPairCard pair={featuredPair} isYours={!isHost}/>

            {/* ── Reactions ── */}
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <AnimatePresence>
                  {reactions.map((r) => (
                    <FloatingReaction key={r.id} reaction={r}
                      onDone={() => setReactions((prev) => prev.filter((x) => x.id!==r.id))}/>
                  ))}
                </AnimatePresence>
              </div>
              <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase mb-3 text-center relative z-10">React to the Pair</p>
              <div className="flex items-center justify-center gap-2 flex-wrap relative z-10">
                {REACTION_EMOJIS.map((emoji) => (
                  <motion.button key={emoji} whileHover={{ scale:1.15 }} whileTap={{ scale:0.85 }} onClick={() => handleReact(emoji)}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                               bg-white/5 hover:bg-white/12 border border-white/8 hover:border-white/20 transition-all">
                    <span className="text-xl">{emoji}</span>
                    <span className="text-[9px] text-white/30 font-mono">{reactionCounts[emoji]||0}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ── All pairs list ── */}
            {allPairs.length > 0 && (
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4 }} className="w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-white/8"/>
                  <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase whitespace-nowrap">
                    All {allPairs.length} Pairs This Week
                  </p>
                  <div className="flex-1 h-px bg-white/8"/>
                </div>
                <div className="flex flex-col gap-2">
                  {allPairs.map((pair, i) => (
                    <SmallPairRow
                      key={pair.id}
                      pair={pair}
                      index={i}
                      highlight={pair.id === featuredPair.id}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Actions ── */}
            <div className="flex gap-3 w-full pt-1">
              <motion.button whileTap={{ scale:0.97 }} onClick={handleReset}
                className="flex-1 py-3 rounded-xl border border-white/15 text-white/50
                           hover:border-white/30 hover:text-white/80 text-sm font-semibold transition-all">
                New Session
              </motion.button>
              <motion.button whileTap={{ scale:0.97 }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-500
                           text-white text-sm font-bold shadow-lg shadow-red-500/20
                           flex items-center justify-center gap-2">
                <Star className="w-4 h-4"/>Share Pairs
              </motion.button>
            </div>

          </motion.div>
        )}

      </div>
    </div>
  );
}