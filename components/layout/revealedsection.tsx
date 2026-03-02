"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, Trophy, Star, Shield } from "lucide-react";

export interface Pair {
  id: string;
  king: string;
  queen: string;
}

interface Reaction {
  id: string;
  emoji: string;
  x: number;
}

const REACTION_EMOJIS = ["👑", "❤️", "🔥", "⚔️", "✨", "🎉"];

// ─── Utility: generate all pairs from hero list ────────────────────────────
export function generateAllPairs(heroes: { id: string; name: string; role: "king" | "queen" }[]): Pair[] {
  const kings = [...heroes.filter((h) => h.role === "king")].sort(() => Math.random() - 0.5);
  const queens = [...heroes.filter((h) => h.role === "queen")].sort(() => Math.random() - 0.5);
  const count = Math.min(kings.length, queens.length);
  return Array.from({ length: count }, (_, i) => ({
    id: Math.random().toString(36).slice(2) + i,
    king: kings[i].name,
    queen: queens[i].name,
  }));
}

// ─── Floating Reaction ─────────────────────────────────────────────────────
const FloatingReaction = ({ reaction, onDone }: { reaction: Reaction; onDone: () => void }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 0.6 }}
    animate={{ opacity: 0, y: -100, scale: 1.5 }}
    transition={{ duration: 1.8, ease: "easeOut" }}
    onAnimationComplete={onDone}
    className="absolute bottom-4 pointer-events-none text-2xl select-none z-10"
    style={{ left: `${reaction.x}%` }}
  >
    {reaction.emoji}
  </motion.div>
);

// ─── Big Featured Pair Card ────────────────────────────────────────────────
const FeaturedPairCard = ({
  pair,
  isYours,
  delay = 0,
}: {
  pair: Pair;
  isYours: boolean;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.92 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.6, type: "spring", bounce: 0.3 }}
    className="relative w-full rounded-3xl overflow-hidden"
  >
    {/* Yours badge */}
    {isYours && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.3 }}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5
                   px-3 py-1 rounded-full bg-blue-500/90 backdrop-blur-sm border border-blue-400/50
                   shadow-lg shadow-blue-500/30"
      >
        <span className="text-[10px] font-black text-white tracking-widest uppercase">Your Pair ✦</span>
      </motion.div>
    )}

    {/* Card background */}
    <div
      className={`relative p-6 pt-10 rounded-3xl border-2
                  ${isYours
                    ? "bg-gradient-to-br from-yellow-900/30 via-[#1a1208] to-rose-900/30 border-yellow-400/40"
                    : "bg-gradient-to-br from-yellow-900/20 via-[#141210] to-rose-900/20 border-yellow-400/25"}`}
      style={isYours ? { boxShadow: "0 0 60px rgba(250,204,21,0.12), 0 0 30px rgba(251,113,133,0.08)" } : {}}
    >
      {/* Week badge */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-yellow-400/30" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/12">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[10px] font-mono text-yellow-400 tracking-widest uppercase font-bold">Week 12</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-rose-400/30" />
      </div>

      {/* The two hero cards */}
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {/* King */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: delay + 0.15, duration: 0.65, type: "spring", bounce: 0.35 }}
          className="relative flex flex-col items-center flex-1"
        >
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="absolute inset-0 rounded-3xl blur-2xl -z-10 bg-yellow-400/30"
          />
          <div className="w-full max-w-[160px] rounded-2xl border-2 border-yellow-400/40 p-4 flex flex-col items-center gap-2.5
                          bg-gradient-to-b from-yellow-400/15 to-yellow-900/10"
            style={{ boxShadow: "0 0 30px rgba(250,204,21,0.18), inset 0 1px 0 rgba(250,204,21,0.1)" }}>
            <div className="w-14 h-14 rounded-xl bg-yellow-400/20 flex items-center justify-center text-3xl">⚔️</div>
            <div className="text-center">
              <p className="text-yellow-300 font-black text-base tracking-tight">{pair.king}</p>
              <p className="text-[9px] text-white/40 font-mono tracking-widest uppercase mt-0.5">King of the Week</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 text-[10px] font-bold">
              <Zap className="w-2.5 h-2.5" />+500 XP
            </div>
          </div>
        </motion.div>

        {/* Heart connector */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: delay + 0.6, type: "spring" }}
          className="flex flex-col items-center gap-1 shrink-0"
        >
          <motion.div
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="text-xl"
          >❤️</motion.div>
          <div className="w-px h-6 bg-gradient-to-b from-yellow-400/30 to-rose-400/30" />
          <Shield className="w-3.5 h-3.5 text-white/20" />
        </motion.div>

        {/* Queen */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotateY: -90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: delay + 0.3, duration: 0.65, type: "spring", bounce: 0.35 }}
          className="relative flex flex-col items-center flex-1"
        >
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.4 }}
            className="absolute inset-0 rounded-3xl blur-2xl -z-10 bg-rose-400/30"
          />
          <div className="w-full max-w-[160px] rounded-2xl border-2 border-rose-400/40 p-4 flex flex-col items-center gap-2.5
                          bg-gradient-to-b from-rose-400/15 to-rose-900/10"
            style={{ boxShadow: "0 0 30px rgba(251,113,133,0.18), inset 0 1px 0 rgba(251,113,133,0.1)" }}>
            <div className="w-14 h-14 rounded-xl bg-rose-400/20 flex items-center justify-center text-3xl">👑</div>
            <div className="text-center">
              <p className="text-rose-300 font-black text-base tracking-tight">{pair.queen}</p>
              <p className="text-[9px] text-white/40 font-mono tracking-widest uppercase mt-0.5">Queen of the Week</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-400 text-[10px] font-bold">
              <Zap className="w-2.5 h-2.5" />+500 XP
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </motion.div>
);

// ─── Small Pair Row ────────────────────────────────────────────────────────
const SmallPairRow = ({ pair, index }: { pair: Pair; index: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.1 + index * 0.07, type: "spring" }}
    className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/8
               hover:bg-white/8 hover:border-white/15 transition-all group"
  >
    {/* Rank */}
    <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-[11px]
                    font-mono text-white/30 shrink-0">
      {String(index + 1).padStart(2, "0")}
    </div>

    {/* King */}
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className="w-6 h-6 rounded-lg bg-yellow-400/15 flex items-center justify-center text-sm shrink-0">⚔️</div>
      <p className="text-yellow-300 font-semibold text-sm truncate">{pair.king}</p>
    </div>

    {/* Connector */}
    <div className="flex items-center gap-1 shrink-0 px-1">
      <div className="w-4 h-px bg-gradient-to-r from-yellow-400/30 to-rose-400/30" />
      <span className="text-xs">❤️</span>
      <div className="w-4 h-px bg-gradient-to-r from-rose-400/30 to-yellow-400/30" />
    </div>

    {/* Queen */}
    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
      <p className="text-rose-300 font-semibold text-sm truncate text-right">{pair.queen}</p>
      <div className="w-6 h-6 rounded-lg bg-rose-400/15 flex items-center justify-center text-sm shrink-0">👑</div>
    </div>
  </motion.div>
);

// ─── Full Revealed Section ─────────────────────────────────────────────────
export const RevealedSection = ({
  myPair,
  allPairs,
  myName,
  isHost,
  reactions,
  reactionCounts,
  onReact,
  onReset,
}: {
  myPair: Pair;
  allPairs: Pair[];
  myName?: string;
  isHost?: boolean;
  reactions: Reaction[];
  reactionCounts: Record<string, number>;
  onReact: (emoji: string) => void;
  onReset: () => void;
}) => {
  // Other pairs = all pairs except the featured one
  const otherPairs = allPairs.filter((p) => p.id !== myPair.id);
  const isYourPair = isHost
    ? false // host sees the "main" pair, not "yours"
    : !!(myName && (myPair.king === myName || myPair.queen === myName));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 w-full">

      {/* Page title */}
      <div className="text-center mb-1">
        <motion.h1
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-4xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-rose-400 bg-clip-text text-transparent mb-1"
        >
          The Royal Pairs! 👑
        </motion.h1>
        <p className="text-white/30 text-sm">
          {allPairs.length} pair{allPairs.length !== 1 ? "s" : ""} forged this week
        </p>
      </div>

      {/* ── YOUR / FEATURED big pair ── */}
      <div className="w-full">
        {isYourPair && (
          <p className="text-[10px] text-blue-400 font-mono tracking-widest uppercase mb-2 text-center">
            ✦ Your destined pair ✦
          </p>
        )}
        <FeaturedPairCard pair={myPair} isYours={isYourPair} delay={0} />
      </div>

      {/* ── Reactions ── */}
      <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <AnimatePresence>
            {reactions.map((r) => (
              <FloatingReaction
                key={r.id}
                reaction={r}
                onDone={() => {}} // parent handles removal
              />
            ))}
          </AnimatePresence>
        </div>
        <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase mb-3 text-center relative z-10">
          React to the Pair
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap relative z-10">
          {REACTION_EMOJIS.map((emoji) => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => onReact(emoji)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                         bg-white/5 hover:bg-white/12 border border-white/8 hover:border-white/20 transition-all"
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-[9px] text-white/30 font-mono">{reactionCounts[emoji] || 0}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── All other pairs ── */}
      {otherPairs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-white/8" />
            <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">
              All {allPairs.length} Pairs This Week
            </p>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <div className="flex flex-col gap-2">
            {/* Show the featured pair first in the list too */}
            {allPairs.map((pair, i) => (
              <div key={pair.id} className="relative">
                {pair.id === myPair.id && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-blue-400/70" />
                )}
                <SmallPairRow pair={pair} index={i} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex gap-3 w-full pt-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onReset}
          className="flex-1 py-3 rounded-xl border border-white/15 text-white/50
                     hover:border-white/30 hover:text-white/80 text-sm font-semibold transition-all"
        >
          New Session
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-500
                     text-white text-sm font-bold shadow-lg shadow-red-500/20
                     flex items-center justify-center gap-2"
        >
          <Star className="w-4 h-4" />
          Share Pairs
        </motion.button>
      </div>
    </motion.div>
  );
};
