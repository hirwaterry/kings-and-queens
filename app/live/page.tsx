"use client";

// app/live/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// FOW Live Pair Page — wired to Supabase
//
// FLOW:
//   Admin view  → sees lobby + participant list + Generate button
//   Guest view  → scans QR / enters name → joins lobby → waits for reveal
//   On Generate → status flips to 'revealed', ALL phones update simultaneously
//   Results     → every player sees full pair list + their own pair highlighted
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Sword, Users, Zap, QrCode,
  RefreshCw, Copy, Check, Star, Flame,
} from "lucide-react";
import { supabase, createSession, getSession, getParticipants,
  addParticipant, removeParticipant, generateAndSavePairs,
  updateSessionStatus, getPairs, getAgatambyi, addReaction,
  genId,
  type DBSession, type DBParticipant, type DBPair, type DBAgatambyi, type Role,
} from "@/lib/supabase";

// ── QR code (lightweight inline SVG generator via api.qrserver.com) ───────────
const QRCode = ({ value, size = 160 }: { value: string; size?: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=0d0d10&color=ffffff&qzone=1`}
    alt="QR Code"
    width={size}
    height={size}
    className="rounded-2xl"
  />
);

// ── Reaction emojis ────────────────────────────────────────────────────────────
const REACTION_EMOJIS = ["❤️", "🔥", "👑", "⚔️", "🎉", "😍"];

// ── Role colors ────────────────────────────────────────────────────────────────
const KING_STYLE  = { border: "border-yellow-400/40", bg: "bg-yellow-400/10", text: "text-yellow-300", glow: "rgba(250,204,21,0.3)"  };
const QUEEN_STYLE = { border: "border-rose-400/40",   bg: "bg-rose-400/10",   text: "text-rose-300",   glow: "rgba(251,113,133,0.3)" };
const roleStyle   = (role: string) => role === "king" ? KING_STYLE : QUEEN_STYLE;

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }: { msg: string; type: "ok"|"err"; onDone: () => void }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border text-sm font-semibold
                  backdrop-blur-sm flex items-center gap-2 shadow-2xl
                  ${type==="ok" ? "bg-green-500/20 border-green-500/40 text-green-300" : "bg-red-500/20 border-red-500/40 text-red-300"}`}>
      {type==="ok" ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
      {msg}
    </motion.div>
  );
};

// ── Floating emoji burst (reaction animation) ─────────────────────────────────
const EmojiFloat = ({ emoji, id, onDone }: { emoji:string; id:string; onDone:()=>void }) => {
  // Each float gets its own fixed random values so they don't re-randomise on re-render
  const [props] = useState(() => ({
    left:    15 + Math.random() * 70,       // 15–85vw
    drift:   (Math.random() - 0.5) * 80,    // horizontal wobble ±40px
    size:    2.2 + Math.random() * 1.4,     // 2.2–3.6rem
    duration:3.5 + Math.random() * 1.5,     // 3.5–5s
  }));

  // Remove from DOM after animation completes
  useEffect(() => {
    const t = setTimeout(onDone, (props.duration + 0.3) * 1000);
    return () => clearTimeout(t);
  }, [onDone, props.duration]);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, x: 0, scale: 0.6, rotate: 0 }}
      animate={{
        opacity: [1, 1, 1, 0.6, 0],
        y:       -window.innerHeight * 0.75,   // rise 75% of screen height
        x:       [0, props.drift * 0.4, props.drift, props.drift * 0.6, 0],
        scale:   [0.6, 1.3, 1.1, 1.0, 0.8],
        rotate:  [0, -12, 10, -6, 0],
      }}
      transition={{ duration: props.duration, ease: "easeOut" }}
      className="fixed bottom-24 pointer-events-none z-50 select-none"
      style={{ left: `${props.left}vw`, fontSize: `${props.size}rem`, lineHeight: 1 }}
    >
      {emoji}
    </motion.div>
  );
};

// ── Pair card (results screen) ─────────────────────────────────────────────────
const PairCard = ({
  pair, index, myName,
}: { pair: DBPair; index: number; myName: string }) => {
  const isMyPair = myName &&
    (pair.member_a_name.toLowerCase() === myName.toLowerCase() ||
     pair.member_b_name.toLowerCase() === myName.toLowerCase());
  const isKQ = pair.pair_type === "king-queen";

  return (
    <motion.div
      initial={{ opacity:0, y:20, scale:0.95 }}
      animate={{ opacity:1, y:0, scale:1 }}
      transition={{ delay: index * 0.07, type:"spring" }}
      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all
                  ${isMyPair
                    ? "border-blue-400/50 bg-blue-400/10 shadow-lg shadow-blue-400/15"
                    : "border-white/10 bg-white/5"}`}
    >
      {/* Rank */}
      <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-[11px] font-mono text-white/30 shrink-0">
        {String(index+1).padStart(2,"0")}
      </div>

      {/* Member A */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0
                         ${pair.member_a_role==="king" ? "bg-yellow-400/15" : "bg-rose-400/15"}`}>
          {pair.member_a_role==="king" ? "⚔️" : "👑"}
        </div>
        <div className="min-w-0">
          <p className={`font-bold text-sm truncate ${pair.member_a_role==="king" ? "text-yellow-300" : "text-rose-300"}`}>
            {pair.member_a_name}
          </p>
          <p className="text-[9px] text-white/25 font-mono uppercase">{pair.member_a_role}</p>
        </div>
      </div>

      {/* Connector */}
      <motion.div animate={{ scale:[1,1.3,1] }} transition={{ duration:1.8, repeat:Infinity, delay:index*0.2 }}
        className="text-base shrink-0">
        {isKQ ? "❤️" : pair.pair_type==="king-king" ? "⚔️" : "👑"}
      </motion.div>

      {/* Member B */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <div className="min-w-0 text-right">
          <p className={`font-bold text-sm truncate ${pair.member_b_role==="king" ? "text-yellow-300" : "text-rose-300"}`}>
            {pair.member_b_name}
          </p>
          <p className="text-[9px] text-white/25 font-mono uppercase">{pair.member_b_role}</p>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0
                         ${pair.member_b_role==="king" ? "bg-yellow-400/15" : "bg-rose-400/15"}`}>
          {pair.member_b_role==="king" ? "⚔️" : "👑"}
        </div>
      </div>

      {/* "YOU" badge */}
      {isMyPair && (
        <div className="shrink-0 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-[9px] text-blue-300 font-black">
          YOU
        </div>
      )}
    </motion.div>
  );
};

// ── Agatambyi card ─────────────────────────────────────────────────────────────
const AgatambyiCard = ({ ag, myName }: { ag: DBAgatambyi; myName: string }) => {
  const isMe = myName && ag.name.toLowerCase() === myName.toLowerCase();
  return (
    <motion.div initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
      transition={{ type:"spring", bounce:0.4 }}
      className={`relative overflow-hidden rounded-3xl border-2 p-6 text-center
                  ${isMe ? "border-yellow-300/60 shadow-xl shadow-yellow-400/20" : "border-yellow-400/40"}
                  bg-gradient-to-br from-yellow-900/30 via-[#1a1208] to-amber-900/20`}
      style={{ boxShadow: isMe ? "0 0 60px rgba(250,204,21,0.2)" : "0 0 30px rgba(250,204,21,0.1)" }}>
      {["top-3 left-3","top-3 right-3","bottom-3 left-3","bottom-3 right-3"].map((pos,i) => (
        <motion.div key={i} animate={{ opacity:[0.4,1,0.4], scale:[1,1.2,1] }}
          transition={{ duration:2, repeat:Infinity, delay:i*0.4 }}
          className={`absolute text-yellow-400 text-xs ${pos}`}>⭐</motion.div>
      ))}
      <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3, repeat:Infinity }} className="text-4xl mb-3">⭐</motion.div>
      <p className="text-[10px] font-mono text-yellow-400/60 tracking-[0.3em] uppercase mb-1">✦ Agatambyi ✦</p>
      <p className="text-yellow-300 font-black text-2xl tracking-tight mb-1">{ag.name}</p>
      <p className="text-white/30 text-xs font-mono">{ag.role==="king" ? "⚔️ King" : "👑 Queen"} · The Royal Standalone</p>
      {isMe && (
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:0.3, type:"spring" }}
          className="mt-3 py-2 px-4 rounded-xl bg-yellow-400/15 border border-yellow-400/30 inline-block">
          <p className="text-[11px] text-yellow-400 font-black">That's you! ⭐ You stand alone royally</p>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

type Screen = "mode-select" | "join" | "lobby-guest" | "lobby-admin" | "revealing" | "results";

export default function LivePage() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [screen,       setScreen      ] = useState<Screen>("mode-select");
  const [session,      setSession     ] = useState<DBSession | null>(null);
  const [participants, setParticipants] = useState<DBParticipant[]>([]);
  const [pairs,        setPairs       ] = useState<DBPair[]>([]);
  const [agatambyi,    setAgatambyi   ] = useState<DBAgatambyi | null>(null);
  const [myName,       setMyName      ] = useState("");
  const [myRole,       setMyRole      ] = useState<Role>("king");
  const [nameInput,    setNameInput   ] = useState("");
  const [sessionCode,  setSessionCode ] = useState("");
  const [isAdmin,      setIsAdmin     ] = useState(false);
  const [generating,   setGenerating  ] = useState(false);
  const [copied,       setCopied      ] = useState(false);
  const [toast,        setToast       ] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const [floats,       setFloats      ] = useState<{id:string;emoji:string}[]>([]);
  const [revealStep,   setRevealStep  ] = useState(0); // 0-3 countdown steps
  const subsRef = useRef<(() => void)[]>([]);

  const notify = (msg: string, type: "ok"|"err" = "ok") => setToast({ msg, type });

  // ── Cleanup subscriptions on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => { subsRef.current.forEach((unsub) => unsub()); };
  }, []);

  // ── Subscribe to session status changes ─────────────────────────────────────
  const subscribeToSession = useCallback((sessionId: string) => {
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "sessions",
        filter: `id=eq.${sessionId}`,
      }, async (payload) => {
        const updated = payload.new as DBSession;
        setSession(updated);
        if (updated.status === "revealing") {
          setScreen("revealing");
          // Countdown 3-2-1 then show results
          let step = 3;
          setRevealStep(step);
          const countdown = setInterval(() => {
            step--;
            setRevealStep(step);
            if (step <= 0) {
              clearInterval(countdown);
              setScreen("results");
            }
          }, 1000);
        }
        if (updated.status === "revealed") {
          // Load pairs & agatambyi
          const [p, ag] = await Promise.all([
            getPairs(sessionId),
            getAgatambyi(sessionId),
          ]);
          setPairs(p);
          setAgatambyi(ag);
          setScreen("results");
        }
      })
      .subscribe();

    subsRef.current.push(() => supabase.removeChannel(channel));
  }, []);

  // ── Subscribe to participant changes (lobby live updates) ───────────────────
  const subscribeToParticipants = useCallback((sessionId: string) => {
    const channel = supabase
      .channel(`participants:${sessionId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "participants",
        filter: `session_id=eq.${sessionId}`,
      }, async () => {
        const updated = await getParticipants(sessionId);
        setParticipants(updated);
      })
      .subscribe();

    subsRef.current.push(() => supabase.removeChannel(channel));
  }, []);

  // ── Subscribe to reactions ──────────────────────────────────────────────────
  const subscribeToReactions = useCallback((sessionId: string) => {
    const channel = supabase
      .channel(`reactions:${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "reactions",
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const emoji = (payload.new as {emoji:string}).emoji;
        setFloats((prev) => [...prev, { id: genId(), emoji }]);
      })
      .subscribe();

    subsRef.current.push(() => supabase.removeChannel(channel));
  }, []);

  // ── ADMIN: Create session ───────────────────────────────────────────────────
  const handleCreateSession = async () => {
    try {
      const sess = await createSession();
      setSession(sess);
      setIsAdmin(true);
      setScreen("lobby-admin");
      subscribeToSession(sess.id);
      subscribeToParticipants(sess.id);
      subscribeToReactions(sess.id);
      notify(`Week ${sess.week_number} session created! 👑`);
    } catch (e: any) {
      notify(e.message, "err");
    }
  };

  // ── GUEST: Join a session ───────────────────────────────────────────────────
  const handleJoinSession = async () => {
    if (!nameInput.trim()) { notify("Enter your name first", "err"); return; }

    // Find session — use code if provided, else latest
    let sess: DBSession | null = null;
    if (sessionCode.trim()) {
      sess = await getSession(sessionCode.trim());
      if (!sess) { notify("Session not found. Check the code.", "err"); return; }
    } else {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("status", "lobby")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      sess = data;
      if (!sess) { notify("No active session found.", "err"); return; }
    }

    // Add participant
    const { participant, error } = await addParticipant(sess.id, nameInput.trim(), myRole);
    if (error) { notify(error, "err"); return; }

    setSession(sess);
    setMyName(nameInput.trim());
    setScreen("lobby-guest");
    subscribeToSession(sess.id);
    subscribeToParticipants(sess.id);
    subscribeToReactions(sess.id);

    // Load current participants
    const current = await getParticipants(sess.id);
    setParticipants(current);
    notify(`Welcome to the realm, ${nameInput.trim()}! 👑`);
  };

  // ── ADMIN: Generate pairs ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!session) return;
    if (participants.length < 2) { notify("Need at least 2 heroes!", "err"); return; }
    setGenerating(true);
    try {
      // Flip to revealing — triggers countdown on ALL connected devices
      await updateSessionStatus(session.id, "revealing");

      // Generate pairs server-side while countdown runs
      const { pairs: newPairs, agatambyi: ag, error } = await generateAndSavePairs(session.id);
      if (error) { notify(error, "err"); setGenerating(false); return; }

      // Small buffer to let countdown finish, then flip to revealed
      await new Promise((r) => setTimeout(r, 3200));
      await updateSessionStatus(session.id, "revealed");

      setPairs(newPairs);
      setAgatambyi(ag);
    } catch (e: any) {
      notify(e.message, "err");
    }
    setGenerating(false);
  };

  // ── Copy session link ───────────────────────────────────────────────────────
  const handleCopyLink = () => {
    if (!session) return;
    const url = `${window.location.origin}/live?session=${session.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── React (emoji reaction) ──────────────────────────────────────────────────
  const handleReact = (emoji: string) => {
    if (!session) return;
    addReaction(session.id, emoji);
    // Instant local float too
    setFloats((prev) => [...prev, { id: genId(), emoji }]);
  };

  // ── Read session from URL on mount (for QR join) ────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session");
    if (sid) setSessionCode(sid);
  }, []);

  // ─── SCREENS ────────────────────────────────────────────────────────────────

  // ── 0. Mode select ──────────────────────────────────────────────────────────
  if (screen === "mode-select") return (
    <PageShell>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="flex flex-col items-center gap-6 pt-16">
        <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3, repeat:Infinity }}
          className="text-5xl">👑</motion.div>
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            <span className="text-white">Live </span>
            <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Pairing</span>
          </h1>
          <p className="text-white/30 text-sm">Are you hosting or joining?</p>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-3">
          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={handleCreateSession}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-500 rounded-2xl font-black text-base
                       shadow-xl shadow-red-500/25 flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" />
            I'm the Host
          </motion.button>

          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={() => setScreen("join")}
            className="w-full py-4 bg-white/8 border border-white/15 rounded-2xl font-black text-base
                       text-white hover:bg-white/12 transition-all flex items-center justify-center gap-2">
            <Users className="w-5 h-5" />
            I'm Joining
          </motion.button>
        </div>
      </motion.div>
      <ToastLayer toast={toast} onDone={() => setToast(null)} />
    </PageShell>
  );

  // ── 1. Join screen (guest) ──────────────────────────────────────────────────
  if (screen === "join") return (
    <PageShell>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col gap-5 pt-8">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-black">Join the Realm</h2>
          <p className="text-white/30 text-sm mt-1">Enter your name and choose your role</p>
        </div>

        <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
          placeholder="Your name..."
          className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3.5 text-white
                     placeholder-white/20 text-base font-medium focus:outline-none focus:border-red-500/50 transition-all" />

        {/* Role picker */}
        <div className="flex gap-3">
          {(["king","queen"] as Role[]).map((r) => (
            <motion.button key={r} whileTap={{ scale:0.97 }} onClick={() => setMyRole(r)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 transition-all
                          ${myRole===r
                            ? r==="king"
                              ? "border-yellow-400 bg-yellow-400/12 text-yellow-300 shadow-lg shadow-yellow-400/15"
                              : "border-rose-400 bg-rose-400/12 text-rose-300 shadow-lg shadow-rose-400/15"
                            : "border-white/10 bg-white/5 text-white/40"}`}>
              <span className="text-xl">{r==="king" ? "⚔️" : "👑"}</span>
              <span className="font-black text-sm capitalize">{r}</span>
            </motion.button>
          ))}
        </div>

        {/* Optional session code */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-white/25 font-mono uppercase tracking-widest">Session code (optional)</p>
          <input type="text" value={sessionCode} onChange={(e) => setSessionCode(e.target.value)}
            placeholder="Leave empty to join latest session"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white
                       placeholder-white/15 text-sm font-mono focus:outline-none focus:border-white/30 transition-all" />
        </div>

        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
          onClick={handleJoinSession}
          className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900
                     rounded-2xl font-black text-base shadow-lg shadow-yellow-500/20
                     flex items-center justify-center gap-2">
          <Crown className="w-5 h-5" />
          Enter the Realm
        </motion.button>

        <button onClick={() => setScreen("mode-select")}
          className="text-white/25 text-sm text-center hover:text-white/50 transition-colors mt-2">
          ← Back
        </button>
      </motion.div>
      <ToastLayer toast={toast} onDone={() => setToast(null)} />
    </PageShell>
  );

  // ── 2. Admin lobby ──────────────────────────────────────────────────────────
  if (screen === "lobby-admin" && session) return (
    <PageShell>
      <div className="flex flex-col gap-5 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Crown className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Host · Week {session.week_number}</span>
            </div>
            <h2 className="text-2xl font-black">Waiting Lobby</h2>
          </div>
          <motion.div animate={{ scale:[1,1.08,1] }} transition={{ duration:2, repeat:Infinity }}
            className="px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-green-400 font-mono">LIVE</span>
          </motion.div>
        </div>

        {/* Session ID + QR */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col items-center gap-4">
          <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase">Share to invite players</p>
          <QRCode value={`${typeof window !== "undefined" ? window.location.origin : ""}/live?session=${session.id}`} size={160} />
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 bg-white/8 rounded-xl px-3 py-2 font-mono text-xs text-white/50 truncate">
              /live?session={session.id}
            </div>
            <motion.button whileTap={{ scale:0.9 }} onClick={handleCopyLink}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all
                          ${copied ? "bg-green-500/20 border-green-500/40" : "bg-white/10 border-white/15 hover:bg-white/15"}`}>
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/50" />}
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:"Total",  value:participants.length,                               icon:"🧙", color:"text-white"      },
            { label:"Kings",  value:participants.filter(p=>p.role==="king").length,   icon:"⚔️", color:"text-yellow-300" },
            { label:"Queens", value:participants.filter(p=>p.role==="queen").length,  icon:"👑", color:"text-rose-300"   },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
              <span className="text-lg">{s.icon}</span>
              <motion.span key={s.value} initial={{ scale:1.4 }} animate={{ scale:1 }}
                className={`text-2xl font-black ${s.color}`}>{s.value}</motion.span>
              <span className="text-[9px] text-white/25 uppercase font-mono">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Participant chips */}
        {participants.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3">Heroes in lobby</p>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.div key={p.id} initial={{ opacity:0, scale:0.7 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.7 }}
                    className={`flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full border text-xs font-semibold
                                ${p.role==="king" ? "bg-yellow-400/10 border-yellow-400/25 text-yellow-300" : "bg-rose-400/10 border-rose-400/25 text-rose-300"}`}>
                    <span>{p.role==="king" ? "⚔️" : "👑"}</span>
                    <span>{p.name}</span>
                    <motion.button whileTap={{ scale:0.85 }} onClick={() => removeParticipant(p.id)}
                      className="w-4 h-4 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-[9px] ml-0.5">
                      ×
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Generate button */}
        <motion.button
          whileHover={{ scale: participants.length >= 2 ? 1.02 : 1 }}
          whileTap={{ scale: participants.length >= 2 ? 0.97 : 1 }}
          onClick={handleGenerate}
          disabled={participants.length < 2 || generating}
          className={`w-full py-4 rounded-2xl font-black text-base relative overflow-hidden
                       flex items-center justify-center gap-2 transition-all
                       ${participants.length >= 2 && !generating
                         ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 text-gray-900 shadow-xl shadow-yellow-500/30"
                         : "bg-white/8 text-white/25 cursor-not-allowed"}`}>
          {generating ? (
            <><RefreshCw className="w-5 h-5 animate-spin" />Generating...</>
          ) : (
            <>
              <motion.div animate={{ x:["-100%","200%"] }} transition={{ duration:2, repeat:Infinity }}
                className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 pointer-events-none" />
              <Crown className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Generate Royal Pairs</span>
              <Sword className="w-5 h-5 relative z-10" />
            </>
          )}
        </motion.button>

        {participants.length < 2 && (
          <p className="text-center text-white/20 text-xs font-mono -mt-2">
            {participants.length === 0 ? "Waiting for heroes to join..." : "Need at least 2 heroes to pair"}
          </p>
        )}
      </div>
      <ToastLayer toast={toast} onDone={() => setToast(null)} />
    </PageShell>
  );

  // ── 3. Guest lobby ──────────────────────────────────────────────────────────
  if (screen === "lobby-guest" && session) return (
    <PageShell>
      <div className="flex flex-col items-center gap-6 pt-10">
        {/* Breathing logo */}
        <motion.div animate={{ scale:[1,1.08,1], opacity:[0.8,1,0.8] }} transition={{ duration:2.5, repeat:Infinity }}
          className="text-6xl">👑</motion.div>

        <div className="text-center">
          <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase mb-1">You're in the realm</p>
          <h2 className="text-2xl font-black text-white">
            Welcome, <span className={myRole==="king" ? "text-yellow-300" : "text-rose-300"}>{myName}</span>!
          </h2>
          <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border text-xs font-bold
                           ${myRole==="king" ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-300" : "bg-rose-400/10 border-rose-400/30 text-rose-300"}`}>
            <span>{myRole==="king" ? "⚔️" : "👑"}</span>
            <span>{myRole==="king" ? "King" : "Queen"}</span>
          </div>
        </div>

        {/* Live participant counter */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">Heroes in lobby</p>
            <motion.div animate={{ scale:[1,1.08,1] }} transition={{ duration:2, repeat:Infinity }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-mono">{participants.length} joined</span>
            </motion.div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {participants.map((p) => (
                <motion.div key={p.id} initial={{ opacity:0, scale:0.7 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold
                              ${p.name.toLowerCase()===myName.toLowerCase()
                                ? "bg-blue-400/15 border-blue-400/40 text-blue-300"
                                : p.role==="king" ? "bg-yellow-400/10 border-yellow-400/25 text-yellow-300" : "bg-rose-400/10 border-rose-400/25 text-rose-300"}`}>
                  <span>{p.role==="king" ? "⚔️" : "👑"}</span>
                  <span>{p.name}{p.name.toLowerCase()===myName.toLowerCase() ? " (you)" : ""}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Waiting pulse */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {[0,1,2].map((i) => (
              <motion.div key={i} animate={{ opacity:[0.3,1,0.3], scale:[0.8,1.1,0.8] }}
                transition={{ duration:1.2, repeat:Infinity, delay:i*0.2 }}
                className="w-2 h-2 rounded-full bg-red-400" />
            ))}
          </div>
          <p className="text-white/25 text-xs font-mono">Waiting for host to generate pairs...</p>
        </div>
      </div>
      <ToastLayer toast={toast} onDone={() => setToast(null)} />
    </PageShell>
  );

  // ── 4. Revealing (countdown) ─────────────────────────────────────────────────
  if (screen === "revealing") return (
    <PageShell>
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
        <motion.p initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
          className="text-white/50 font-mono text-sm tracking-widest uppercase">
          The spirits are choosing...
        </motion.p>

        <AnimatePresence mode="wait">
          <motion.div key={revealStep}
            initial={{ scale:0.3, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:2, opacity:0 }}
            transition={{ type:"spring", bounce:0.4, duration:0.5 }}
            className="text-[120px] font-black text-white leading-none text-center"
            style={{ textShadow:"0 0 80px rgba(239,68,68,0.6)" }}>
            {revealStep > 0 ? revealStep : "✨"}
          </motion.div>
        </AnimatePresence>

        <motion.div animate={{ opacity:[0.5,1,0.5] }} transition={{ duration:1, repeat:Infinity }}
          className="text-white/30 text-sm font-mono">
          {revealStep > 0 ? `Revealing in ${revealStep}...` : "Forging royal bonds..."}
        </motion.div>

        {/* Particle ring */}
        <div className="relative w-32 h-32">
          {[...Array(8)].map((_,i) => (
            <motion.div key={i}
              animate={{ rotate: 360 }} transition={{ duration: 3+i*0.3, repeat:Infinity, ease:"linear" }}
              className="absolute inset-0 flex items-start justify-center"
              style={{ transform:`rotate(${i*45}deg)` }}>
              <motion.div animate={{ opacity:[0.3,1,0.3], scale:[0.8,1.2,0.8] }}
                transition={{ duration:1.5, repeat:Infinity, delay:i*0.2 }}
                className="w-2 h-2 rounded-full bg-yellow-400 mt-1" />
            </motion.div>
          ))}
        </div>
      </div>
    </PageShell>
  );

  // ── 5. Results ───────────────────────────────────────────────────────────────
  if (screen === "results" && session) return (
    <PageShell>
      {/* Emoji floats */}
      <AnimatePresence>
        {floats.map((f) => (
          <EmojiFloat key={f.id} emoji={f.emoji} id={f.id}
            onDone={() => setFloats((prev) => prev.filter((x) => x.id !== f.id))} />
        ))}
      </AnimatePresence>

      <div className="flex flex-col gap-5 pt-6 pb-24">
        {/* Header */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center">
          <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3, repeat:Infinity }}
            className="text-4xl mb-2">👑</motion.div>
          <h2 className="text-3xl font-black tracking-tight">
            <span className="text-white">Week </span>
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
              {session.week_number}
            </span>
            <span className="text-white"> Pairs</span>
          </h2>
          <p className="text-white/30 text-sm mt-1">
            {pairs.length} pair{pairs.length!==1?"s":""} · {session.date}
            {myName && <span className="text-blue-300"> · your pair is highlighted</span>}
          </p>
        </motion.div>

        {/* Your pair hero card */}
        {myName && (() => {
          const myPair = pairs.find((p) =>
            p.member_a_name.toLowerCase()===myName.toLowerCase() ||
            p.member_b_name.toLowerCase()===myName.toLowerCase()
          );
          if (!myPair) return null;
          const partner = myPair.member_a_name.toLowerCase()===myName.toLowerCase()
            ? { name: myPair.member_b_name, role: myPair.member_b_role }
            : { name: myPair.member_a_name, role: myPair.member_a_role };
          return (
            <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
              transition={{ delay:0.2, type:"spring" }}
              className="bg-blue-500/10 border-2 border-blue-400/40 rounded-3xl p-5 text-center"
              style={{ boxShadow:"0 0 40px rgba(59,130,246,0.15)" }}>
              <p className="text-[10px] text-blue-400/60 font-mono tracking-widest uppercase mb-3">✦ Your Royal Pair ✦</p>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-2xl">
                    {myRole==="king" ? "⚔️" : "👑"}
                  </div>
                  <p className={`font-black text-sm ${myRole==="king" ? "text-yellow-300" : "text-rose-300"}`}>{myName}</p>
                  <p className="text-[9px] text-blue-400/60 font-mono">You</p>
                </div>
                <motion.div animate={{ scale:[1,1.3,1] }} transition={{ duration:1.5, repeat:Infinity }}
                  className="text-2xl">❤️</motion.div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl
                                   ${partner.role==="king" ? "bg-yellow-400/15 border-yellow-400/30" : "bg-rose-400/15 border-rose-400/30"}`}>
                    {partner.role==="king" ? "⚔️" : "👑"}
                  </div>
                  <p className={`font-black text-sm ${partner.role==="king" ? "text-yellow-300" : "text-rose-300"}`}>{partner.name}</p>
                  <p className="text-[9px] text-white/25 font-mono capitalize">{partner.role}</p>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Agatambyi */}
        {agatambyi && <AgatambyiCard ag={agatambyi} myName={myName} />}

        {/* All pairs */}
        <div>
          <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
            <Star className="w-3 h-3" /> All Royal Pairs
          </p>
          <div className="flex flex-col gap-2">
            {pairs.map((pair, i) => (
              <PairCard key={pair.id} pair={pair} index={i} myName={myName} />
            ))}
          </div>
        </div>
      </div>

      {/* Sticky reaction bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
        <div className="max-w-lg mx-auto px-4 pb-4">
          <div className="bg-[#1a1a22]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3
                           flex items-center justify-center gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <motion.button key={emoji} whileHover={{ scale:1.3 }} whileTap={{ scale:0.85 }}
                onClick={() => handleReact(emoji)}
                className="text-2xl p-1 rounded-xl hover:bg-white/10 transition-colors">
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <ToastLayer toast={toast} onDone={() => setToast(null)} />
    </PageShell>
  );

  return null;
}

// ── Page shell (shared BG + container) ────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d10] text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-red-900/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-900/8 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize:"40px 40px" }} />
      </div>
      <div className="relative z-10 container mx-auto px-4 pt-6 pb-8 max-w-lg">
        {children}
      </div>
    </div>
  );
}

// ── Toast layer ────────────────────────────────────────────────────────────────
function ToastLayer({ toast, onDone }: { toast:{msg:string;type:"ok"|"err"}|null; onDone:()=>void }) {
  return (
    <AnimatePresence>
      {toast && <Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={onDone} />}
    </AnimatePresence>
  );
}