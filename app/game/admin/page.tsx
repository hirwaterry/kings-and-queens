"use client";

// ─────────────────────────────────────────────────────────────────────────────
// app/admin/page.tsx  —  FOW Admin Mode
// Add participants, generate pairs, see Agatambyi
// Uses fowEngine.ts for all logic + localStorage for persistence
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Sword, Plus, Trash2, Zap, Star,
  Users, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Copy, Download,
} from "lucide-react";
import { isAdminAuthed } from "@/hooks/useAdmin";

// Import from fowEngine — adjust path to match your project
import {
  loadStore, saveStore, createSession, getCurrentSession,
  addParticipant, removeParticipant, generatePairs, bulkAddParticipants,
  getSessionStats, genId,
  type FOWStore, type Participant, type PairingResult, type Role,
} from "@/lib/fowEngine";

// ─── Toast notification ───────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }: { msg: string; type: "ok" | "err"; onDone: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.9 }}
    onAnimationComplete={() => setTimeout(onDone, 2200)}
    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3
                rounded-2xl shadow-2xl border text-sm font-semibold backdrop-blur-sm
                ${type === "ok"
                  ? "bg-green-500/20 border-green-500/40 text-green-300"
                  : "bg-red-500/20 border-red-500/40 text-red-300"}`}
  >
    {type === "ok"
      ? <CheckCircle className="w-4 h-4 shrink-0" />
      : <AlertCircle className="w-4 h-4 shrink-0" />}
    {msg}
  </motion.div>
);

// ─── Participant chip ─────────────────────────────────────────────────────────
const ParticipantChip = ({
  p, onRemove, index,
}: { p: Participant; onRemove: () => void; index: number }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.7, y: 8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.7, x: -20 }}
    transition={{ delay: index * 0.03, type: "spring" }}
    className={`flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-full border group
                ${p.role === "king"
                  ? "bg-yellow-400/10 border-yellow-400/25 text-yellow-300"
                  : "bg-rose-400/10 border-rose-400/25 text-rose-300"}`}
  >
    <span className="text-sm">{p.role === "king" ? "⚔️" : "👑"}</span>
    <span className="text-xs font-semibold">{p.name}</span>
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onRemove}
      className="w-5 h-5 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center
                 opacity-0 group-hover:opacity-100 transition-all"
    >
      <Trash2 className="w-3 h-3" />
    </motion.button>
  </motion.div>
);

// ─── Pair card ────────────────────────────────────────────────────────────────
const PairCard = ({
  pair, index,
}: { pair: PairingResult["pairs"][0]; index: number }) => {
  const isKQ = pair.type === "king-queen";
  const isKK = pair.type === "king-king";

  const colorA = isKK ? "text-yellow-300" : pair.type === "king-queen" ? "text-yellow-300" : "text-rose-300";
  const colorB = isKK ? "text-yellow-300" : pair.type === "king-queen" ? "text-rose-300"   : "text-rose-300";
  const borderC = isKQ ? "border-white/10" : "border-orange-400/20";
  const bgC     = isKQ ? "bg-white/5"       : "bg-orange-400/5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, type: "spring" }}
      className={`flex items-center gap-3 p-4 rounded-2xl border ${borderC} ${bgC}`}
    >
      {/* Rank */}
      <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-[11px] font-mono text-white/30 shrink-0">
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Member A */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0
                         ${isKK || pair.type==="king-queen" ? "bg-yellow-400/15" : "bg-rose-400/15"}`}>
          {pair.memberA.role === "king" ? "⚔️" : "👑"}
        </div>
        <div className="min-w-0">
          <p className={`font-bold text-sm truncate ${colorA}`}>{pair.memberA.name}</p>
          <p className="text-[9px] text-white/25 font-mono uppercase">{pair.memberA.role}</p>
        </div>
      </div>

      {/* Connector */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.2 }}
          className="text-base"
        >
          {isKQ ? "❤️" : isKK ? "⚔️" : "👑"}
        </motion.div>
        {!isKQ && (
          <span className="text-[8px] text-orange-400/60 font-mono">fallback</span>
        )}
      </div>

      {/* Member B */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        <div className="min-w-0 text-right">
          <p className={`font-bold text-sm truncate ${colorB}`}>{pair.memberB.name}</p>
          <p className="text-[9px] text-white/25 font-mono uppercase">{pair.memberB.role}</p>
        </div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0
                         ${pair.memberB.role === "queen" ? "bg-rose-400/15" : "bg-yellow-400/15"}`}>
          {pair.memberB.role === "king" ? "⚔️" : "👑"}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Agatambyi spotlight ──────────────────────────────────────────────────────
const AgatambyiCard = ({ p }: { p: Participant }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: "spring", bounce: 0.4 }}
    className="relative overflow-hidden rounded-3xl border-2 border-yellow-400/40 p-6 text-center
               bg-gradient-to-br from-yellow-900/30 via-[#1a1208] to-amber-900/20"
    style={{ boxShadow: "0 0 50px rgba(250,204,21,0.15)" }}
  >
    {/* Star corners */}
    {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
      <motion.div key={i} animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
        className={`absolute text-yellow-400 text-xs ${pos}`}>⭐</motion.div>
    ))}

    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}
      className="text-4xl mb-3">⭐</motion.div>

    <p className="text-[10px] font-mono text-yellow-400/60 tracking-[0.3em] uppercase mb-1">
      ✦ Agatambyi ✦
    </p>
    <p className="text-yellow-300 font-black text-2xl tracking-tight mb-1">{p.name}</p>
    <p className="text-white/30 text-xs font-mono">
      {p.role === "king" ? "⚔️ King" : "👑 Queen"} · The Royal Standalone
    </p>

    <div className="mt-4 py-2 px-4 rounded-xl bg-yellow-400/10 border border-yellow-400/20 inline-block">
      <p className="text-[11px] text-yellow-400/70 font-mono">
        "The one who stands alone royally"
      </p>
    </div>
  </motion.div>
);

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [store,     setStore    ] = useState<FOWStore | null>(null);
  const [name,      setName     ] = useState("");
  const [role,      setRole     ] = useState<Role>("king");
  const [result,    setResult   ] = useState<PairingResult | null>(null);
  const [toast,     setToast    ] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [bulkMode,  setBulkMode ] = useState(false);
  const [bulkText,  setBulkText ] = useState("");
  const [showPairs, setShowPairs] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Admin auth guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdminAuthed()) router.replace("/admin/login");
  }, [router]);

  // ── Load / init store ─────────────────────────────────────────────────────
  useEffect(() => {
    let s = loadStore();
    // Create a session if none exists
    if (!s.currentSessionId || !s.sessions.find((x) => x.id === s.currentSessionId)) {
      const { store: next } = createSession(s);
      s = next;
      saveStore(s);
    }
    setStore(s);
    // Restore previous result if session already has one
    const sess = getCurrentSession(s);
    if (sess?.result) setResult(sess.result);
  }, []);

  const session = store ? getCurrentSession(store) : null;
  const participants = session?.participants ?? [];
  const stats = session ? getSessionStats(session) : null;

  const notify = (msg: string, type: "ok" | "err" = "ok") => setToast({ msg, type });

  // ── Add single ────────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!store || !session) return;
    const { store: next, participant, error } = addParticipant(store, session.id, name, role);
    if (error) { notify(error, "err"); return; }
    saveStore(next);
    setStore(next);
    setName("");
    nameRef.current?.focus();
    notify(`${participant.name} joined as ${role === "king" ? "King ⚔️" : "Queen 👑"}`);
  };

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = (pid: string) => {
    if (!store || !session) return;
    const next = removeParticipant(store, session.id, pid);
    saveStore(next);
    setStore(next);
  };

  // ── Bulk add ──────────────────────────────────────────────────────────────
  const handleBulk = () => {
    if (!store || !session || !bulkText.trim()) return;
    const { store: next, added, errors } = bulkAddParticipants(store, session.id, bulkText);
    saveStore(next);
    setStore(next);
    setBulkText("");
    setBulkMode(false);
    if (errors.length > 0) {
      notify(`Added ${added}, skipped ${errors.length}: ${errors[0]}`, "err");
    } else {
      notify(`${added} heroes added to the roster! 🎉`);
    }
  };

  // ── Generate pairs ────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!store || !session) return;
    if (participants.length < 2) { notify("Need at least 2 heroes to pair!", "err"); return; }

    const { store: next, result: res, error } = generatePairs(store, session.id);
    if (error) { notify(error, "err"); return; }

    saveStore(next);
    setStore(next);
    setResult(res);
    setShowPairs(true);

    const kqCount = res.pairs.filter((p) => p.type === "king-queen").length;
    const sameCount = res.pairs.filter((p) => p.type !== "king-queen").length;
    const aMsg = res.agatambyi ? ` · ${res.agatambyi.name} is Agatambyi ⭐` : "";
    const sameMsg = sameCount > 0 ? ` · ${sameCount} same-gender pair${sameCount > 1 ? "s" : ""}` : "";
    notify(`${kqCount} royal pairs forged!${sameMsg}${aMsg}`);
  };

  // ── New session ───────────────────────────────────────────────────────────
  const handleNewSession = () => {
    if (!store) return;
    const { store: next } = createSession(store);
    saveStore(next);
    setStore(next);
    setResult(null);
    setName("");
    notify(`Week ${next.sessions.length} session started! 👑`);
  };

  // ── Copy results ──────────────────────────────────────────────────────────
  const handleCopyResults = () => {
    if (!result) return;
    const lines = [
      `🏰 Friend of a Week — Week ${result.weekNumber} Pairs`,
      `📅 ${result.date}`,
      "",
      ...result.pairs.map((p, i) =>
        `${i + 1}. ${p.memberA.name} (${p.memberA.role}) ❤️ ${p.memberB.name} (${p.memberB.role})${p.type !== "king-queen" ? " [same-gender]" : ""}`
      ),
      ...(result.agatambyi
        ? ["", `⭐ Agatambyi: ${result.agatambyi.name} (${result.agatambyi.role})`]
        : []),
    ].join("\n");
    navigator.clipboard.writeText(lines).catch(() => {});
    notify("Results copied to clipboard! 📋");
  };

  if (!store || !session) {
    return (
      <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="text-4xl">👑</motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white overflow-x-hidden">

      {/* BG */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-red-900/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-900/8 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-8 pb-20 max-w-lg">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-red-400" />
              <span className="text-xs font-mono text-white/30 tracking-widest uppercase">Admin Mode</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span className="text-[10px] text-white/40 font-mono">Week</span>
              <span className="text-yellow-400 font-black text-sm">{session.weekNumber}</span>
              <span className="text-[10px] text-white/40 font-mono">·</span>
              <span className="text-[10px] text-white/40 font-mono">{session.date}</span>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-white">Roster </span>
            <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Builder</span>
          </h1>
          <p className="text-white/30 text-sm mt-0.5">Add heroes, then generate the royal pairs</p>
        </motion.div>

        {/* ── Live stats ── */}
        {stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total",  value: stats.total,  icon: "🧙", color: "text-white"      },
              { label: "Kings",  value: stats.kings,  icon: "⚔️", color: "text-yellow-300" },
              { label: "Queens", value: stats.queens, icon: "👑", color: "text-rose-300"   },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
                <span className="text-lg">{s.icon}</span>
                <motion.span key={s.value} initial={{ scale: 1.4 }} animate={{ scale: 1 }}
                  className={`text-2xl font-black ${s.color}`}>{s.value}</motion.span>
                <span className="text-[10px] text-white/25 tracking-widest uppercase font-mono">{s.label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Add form ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-4">

          {/* Single / Bulk toggle */}
          <div className="flex gap-2 mb-4 p-1 bg-white/5 border border-white/8 rounded-2xl">
            {[
              { id: false, label: "Add One" },
              { id: true,  label: "Bulk Add" },
            ].map((m) => (
              <motion.button key={String(m.id)} whileTap={{ scale: 0.97 }}
                onClick={() => setBulkMode(m.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                            ${bulkMode === m.id
                              ? "bg-white/15 text-white border border-white/20"
                              : "text-white/40 hover:text-white/60"}`}>
                {m.label}
              </motion.button>
            ))}
          </div>

          {!bulkMode ? (
            /* ── Single add ── */
            <div className="flex flex-col gap-3">
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Hero name..."
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3
                           text-white placeholder-white/20 text-sm font-medium
                           focus:outline-none focus:border-red-500/50 focus:bg-white/10 transition-all"
              />
              {/* Role selector */}
              <div className="flex gap-3">
                {(["king", "queen"] as Role[]).map((r) => (
                  <motion.button key={r} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setRole(r)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 transition-all
                                ${role === r
                                  ? r === "king"
                                    ? "border-yellow-400 bg-yellow-400/12 text-yellow-300 shadow-lg shadow-yellow-400/15"
                                    : "border-rose-400 bg-rose-400/12 text-rose-300 shadow-lg shadow-rose-400/15"
                                  : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"}`}>
                    <span className="text-lg">{r === "king" ? "⚔️" : "👑"}</span>
                    <span className="text-xs font-bold tracking-widest uppercase">{r}</span>
                    {role === r && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black
                                    ${r === "king" ? "bg-yellow-400 text-yellow-900" : "bg-rose-400 text-rose-900"}`}>✓</motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleAdd}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-500 rounded-xl
                           font-black text-sm tracking-wide shadow-lg shadow-red-500/20
                           flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Add to Roster
              </motion.button>
            </div>
          ) : (
            /* ── Bulk add ── */
            <div className="flex flex-col gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] text-white/30 font-mono mb-1">Format: one per line</p>
                <p className="text-[10px] text-yellow-400/60 font-mono">Mugisha, king</p>
                <p className="text-[10px] text-rose-400/60 font-mono">Kalisa, queen</p>
                <p className="text-[10px] text-white/20 font-mono">(default: king if no role given)</p>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Mugisha, king\nKalisa, queen\nUwera, queen\n..."}
                rows={6}
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3
                           text-white placeholder-white/20 text-sm font-mono
                           focus:outline-none focus:border-yellow-500/50 focus:bg-white/10 transition-all resize-none"
              />
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleBulk}
                className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900
                           rounded-xl font-black text-sm shadow-lg shadow-yellow-500/20
                           flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Add All Heroes
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* ── Participant roster ── */}
        <AnimatePresence>
          {participants.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase mb-3 flex items-center gap-2">
                <Users className="w-3 h-3" />
                Roster · {participants.length} heroes
              </p>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {participants.map((p, i) => (
                    <ParticipantChip key={p.id} p={p} index={i}
                      onRemove={() => handleRemove(p.id)} />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Generate button ── */}
        <AnimatePresence>
          {participants.length >= 2 && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleGenerate}
                className="relative w-full py-4 rounded-2xl font-black text-base tracking-wide overflow-hidden
                           bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 text-gray-900
                           shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all
                           flex items-center justify-center gap-2">
                {/* Shimmer */}
                <motion.div animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                <Crown className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Generate Royal Pairs</span>
                <Sword className="w-5 h-5 relative z-10" />
              </motion.button>
              {result && (
                <p className="text-center text-[11px] text-white/20 mt-2 font-mono">
                  Click again to re-randomize
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ── */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-4">

              {/* Results header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div animate={{ rotate: [0,10,-10,0] }} transition={{ duration:3, repeat:Infinity }}
                    className="text-xl">👑</motion.div>
                  <div>
                    <p className="text-white font-black">Week {result.weekNumber} Pairs</p>
                    <p className="text-white/30 text-xs font-mono">
                      {result.pairs.length} pair{result.pairs.length !== 1 ? "s" : ""}
                      {result.pairs.filter(p=>p.type!=="king-queen").length > 0 &&
                        ` · ${result.pairs.filter(p=>p.type!=="king-queen").length} same-gender`}
                      {result.agatambyi ? " · 1 Agatambyi" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopyResults}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <Copy className="w-3.5 h-3.5 text-white/50" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowPairs(!showPairs)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    {showPairs
                      ? <ChevronUp className="w-3.5 h-3.5 text-white/50" />
                      : <ChevronDown className="w-3.5 h-3.5 text-white/50" />}
                  </motion.button>
                </div>
              </div>

              {/* Pair type legend if any fallback pairs */}
              {result.pairs.some(p => p.type !== "king-queen") && (
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <span className="text-[10px]">❤️</span>
                    <span className="text-[10px] text-white/40 font-mono">King × Queen</span>
                  </div>
                  {result.pairs.some(p=>p.type==="king-king") && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-400/8 border border-orange-400/20">
                      <span className="text-[10px]">⚔️</span>
                      <span className="text-[10px] text-orange-400/70 font-mono">King × King (fallback)</span>
                    </div>
                  )}
                  {result.pairs.some(p=>p.type==="queen-queen") && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-400/8 border border-orange-400/20">
                      <span className="text-[10px]">👑</span>
                      <span className="text-[10px] text-orange-400/70 font-mono">Queen × Queen (fallback)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Pair cards */}
              <AnimatePresence>
                {showPairs && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-2 overflow-hidden">
                    {result.pairs.map((pair, i) => (
                      <PairCard key={pair.id} pair={pair} index={i} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Agatambyi */}
              {result.agatambyi && (
                <AgatambyiCard p={result.agatambyi} />
              )}

              {/* New session */}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleNewSession}
                className="w-full py-3 rounded-2xl border border-white/15 text-white/40
                           hover:border-white/30 hover:text-white/70 text-sm font-semibold
                           flex items-center justify-center gap-2 transition-all mt-2">
                <RefreshCw className="w-4 h-4" />
                Start Week {session.weekNumber + 1}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {participants.length === 0 && !result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-center py-16">
            <div className="text-5xl mb-4">⚔️</div>
            <p className="text-white/30 text-sm font-mono">The roster is empty.</p>
            <p className="text-white/20 text-xs font-mono mt-1">Add heroes above to begin.</p>
          </motion.div>
        )}

      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast key={toast.msg} msg={toast.msg} type={toast.type}
            onDone={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}