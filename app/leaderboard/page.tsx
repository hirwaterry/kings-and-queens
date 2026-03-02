"use client";

// app/leaderboard/page.tsx
// Wired to real fowEngine data — no mock data anywhere.
// Reads localStorage via loadStore() + computeAllHeroStats()

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Flame, TrendingUp, Star, Shield, RefreshCw } from "lucide-react";
import {
  loadStore, computeAllHeroStats, getRankTier,
  type HeroStats, type FOWStore,
} from "@/lib/fowEngine";

// ── Types ──────────────────────────────────────────────────────────────────────
type FilterType = "all" | "king" | "queen";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Find the most frequent pair partner for a hero — by name, not id */
function getBestPairName(stats: HeroStats, store: FOWStore): string {
  const countMap: Record<string, number> = {};
  const heroKey = stats.name.toLowerCase();

  for (const session of store.sessions) {
    if (!session.result) continue;
    for (const pair of session.result.pairs) {
      const aKey = pair.memberA.name.toLowerCase();
      const bKey = pair.memberB.name.toLowerCase();
      if (aKey === heroKey) countMap[bKey] = (countMap[bKey] ?? 0) + 1;
      if (bKey === heroKey) countMap[aKey] = (countMap[aKey] ?? 0) + 1;
    }
  }

  const entries = Object.entries(countMap);
  if (!entries.length) return "—";
  const [topKey] = entries.sort((a, b) => b[1] - a[1])[0];

  for (const s of store.sessions) {
    const found = s.participants.find((p) => p.name.toLowerCase() === topKey);
    if (found) return found.name;
  }
  return topKey;
}

/** XP progress % toward next tier */
function xpProgress(xp: number): number {
  const rank = getRankTier(xp);
  if (rank.nextXP === Infinity) return 100;
  const range = rank.nextXP - rank.minXP;
  const earned = xp - rank.minXP;
  return Math.min(100, Math.round((earned / range) * 100));
}

/** Style for leaderboard rows — based on XP tier */
function getTierStyle(xp: number) {
  const { tier } = getRankTier(xp);
  switch (tier) {
    case "champion": return { color:"text-yellow-300", bg:"bg-yellow-400/15", border:"border-yellow-400/40", glow:"rgba(250,204,21,0.25)", rankColor:"text-yellow-300" };
    case "legend":   return { color:"text-slate-300",  bg:"bg-slate-400/15",  border:"border-slate-400/40",  glow:"rgba(148,163,184,0.2)", rankColor:"text-slate-300"  };
    case "elite":    return { color:"text-amber-500",  bg:"bg-amber-700/15",  border:"border-amber-700/40",  glow:"rgba(180,83,9,0.2)",    rankColor:"text-amber-500"  };
    case "veteran":  return { color:"text-violet-300", bg:"bg-violet-500/10", border:"border-violet-500/20", glow:"rgba(139,92,246,0.1)",  rankColor:"text-violet-300" };
    case "warrior":  return { color:"text-blue-300",   bg:"bg-blue-500/10",   border:"border-blue-500/20",   glow:"rgba(59,130,246,0.1)",  rankColor:"text-blue-300"   };
    default:         return { color:"text-white/50",   bg:"bg-white/5",       border:"border-white/10",      glow:"transparent",           rankColor:"text-white/40"   };
  }
}

/** PODIUM colors — always gold #1, silver #2, bronze #3, regardless of XP tier */
function getPodiumStyle(rank: number) {
  if (rank === 1) return {
    color: "text-yellow-300", bg: "bg-yellow-400/20", border: "border-yellow-400/50",
    glow: "rgba(250,204,21,0.35)", rankColor: "text-yellow-300",
    podiumBg: "bg-gradient-to-t from-yellow-900/40 to-yellow-400/15",
    avatarGlow: ["0 0 15px rgba(250,204,21,0.4)", "0 0 40px rgba(250,204,21,0.7)", "0 0 15px rgba(250,204,21,0.4)"],
  };
  if (rank === 2) return {
    color: "text-slate-200",  bg: "bg-slate-400/15",  border: "border-slate-300/50",
    glow: "rgba(203,213,225,0.25)", rankColor: "text-slate-200",
    podiumBg: "bg-gradient-to-t from-slate-800/40 to-slate-400/15",
    avatarGlow: ["0 0 10px rgba(203,213,225,0.3)", "0 0 25px rgba(203,213,225,0.5)", "0 0 10px rgba(203,213,225,0.3)"],
  };
  return {
    color: "text-amber-600",  bg: "bg-amber-700/15",  border: "border-amber-600/50",
    glow: "rgba(180,83,9,0.3)", rankColor: "text-amber-500",
    podiumBg: "bg-gradient-to-t from-amber-950/40 to-amber-700/15",
    avatarGlow: ["0 0 10px rgba(180,83,9,0.3)", "0 0 25px rgba(180,83,9,0.5)", "0 0 10px rgba(180,83,9,0.3)"],
  };
}

// ── Podium Card ────────────────────────────────────────────────────────────────
const PodiumCard = ({
  stats, rank, index, bestPair,
}: { stats: HeroStats; rank: number; index: number; bestPair: string }) => {
  const style    = getPodiumStyle(rank);
  const rankInfo = getRankTier(stats.totalXP);
  const heights  = ["h-36", "h-28", "h-24"];
  const scales   = ["scale-105", "scale-100", "scale-95"];
  const delays   = [0.1, 0.05, 0.15];
  const medals   = ["🥇", "🥈", "🥉"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delays[index], duration: 0.6, type: "spring", bounce: 0.3 }}
      className={`flex flex-col items-center gap-2 ${index === 0 ? "order-2" : index === 1 ? "order-1" : "order-3"}`}
    >
      <div className={`flex flex-col items-center gap-1.5 ${scales[index]}`}>
        {/* Medal emoji above */}
        <motion.div animate={{ rotate: rank === 1 ? [0, 8, -8, 0] : 0 }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-2xl mb-0.5">{medals[rank - 1]}</motion.div>

        {/* Avatar */}
        <motion.div
          animate={{ boxShadow: style.avatarGlow }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`w-14 h-14 rounded-2xl border-2 ${style.border} ${style.bg} flex items-center justify-center text-2xl`}
        >
          {stats.role === "king" ? "⚔️" : "👑"}
        </motion.div>

        <p className={`font-black text-sm ${style.color} text-center max-w-[80px] truncate`}>{stats.name}</p>
        <p className="text-[10px] text-white/30 font-mono">{stats.appearances}× paired</p>

        {/* XP pill */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.color} border ${style.border}`}>
          <Zap className="w-2.5 h-2.5" />
          {stats.totalXP >= 1000 ? `${(stats.totalXP / 1000).toFixed(1)}k` : stats.totalXP} XP
        </div>

        {/* Rank tier badge */}
        <div className="text-[9px] text-white/30 font-mono">{rankInfo.icon} {rankInfo.label}</div>
      </div>

      {/* Podium block */}
      <div
        className={`w-20 sm:w-24 ${heights[index]} rounded-t-2xl border-t-2 border-x-2 ${style.border} ${style.podiumBg}
                     flex items-start justify-center pt-2 relative overflow-hidden`}
        style={{ boxShadow: `0 -4px 20px ${style.glow}` }}
      >
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.4, ease: "easeInOut" }}
          className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12"
        />
        <span className={`font-black text-2xl ${style.rankColor} relative z-10`}>#{rank}</span>
      </div>
    </motion.div>
  );
};

// ── Leaderboard Row ────────────────────────────────────────────────────────────
const LeaderboardRow = ({
  stats, rank, index, bestPair, maxXP,
}: { stats: HeroStats; rank: number; index: number; bestPair: string; maxXP: number }) => {
  const [expanded, setExpanded] = useState(false);
  const style    = getTierStyle(stats.totalXP);
  const rankInfo = getRankTier(stats.totalXP);
  const barPct   = maxXP > 0 ? Math.round((stats.totalXP / maxXP) * 100) : 0;
  const progress = xpProgress(stats.totalXP);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 + index * 0.04, type: "spring" }}
      layout
    >
      <motion.div
        whileHover={{ x: 3 }}
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all duration-200
                    ${expanded
                      ? `${style.bg} ${style.border}`
                      : "bg-white/5 border-white/8 hover:bg-white/8 hover:border-white/15"}`}
        style={expanded ? { boxShadow: `0 0 20px ${style.glow}` } : {}}
      >
        {/* Rank */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${style.bg} border ${style.border}`}>
          <span className={style.rankColor}>{rank}</span>
        </div>

        {/* Role icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${style.bg}`}>
          {stats.role === "king" ? "⚔️" : "👑"}
        </div>

        {/* Name + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-black text-sm truncate ${expanded ? style.color : "text-white"}`}>{stats.name}</p>
            {/* Streak badge */}
            {stats.currentStreak >= 3 && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 shrink-0">
                <Flame className="w-2.5 h-2.5 text-orange-400" />
                <span className="text-[9px] text-orange-400 font-mono font-bold">{stats.currentStreak}</span>
              </div>
            )}
            {/* Rank tier */}
            <span className="text-[9px] text-white/20 font-mono shrink-0">{rankInfo.icon}</span>
          </div>
          {/* XP bar (relative to #1) */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barPct}%` }}
                transition={{ delay: 0.1 + index * 0.04, duration: 0.9, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{
                  background: rank <= 3
                    ? `linear-gradient(90deg, ${style.glow.replace(/[\d.]+\)$/, "0.9)")}, ${style.glow})`
                    : "rgba(255,255,255,0.2)"
                }}
              />
            </div>
            <span className="text-[10px] text-white/25 font-mono shrink-0">
              {stats.totalXP >= 1000 ? `${(stats.totalXP / 1000).toFixed(1)}k` : stats.totalXP}
            </span>
          </div>
        </div>

        {/* XP badge */}
        <div className="flex flex-col items-end shrink-0 gap-1">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black ${style.bg} border ${style.border}`}>
            <Star className={`w-3 h-3 ${style.color}`} />
            <span className={style.color}>{stats.appearances}×</span>
          </div>
          <span className="text-[9px] text-white/25 font-mono">paired</span>
        </div>
      </motion.div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className={`mx-2 mb-1 p-4 rounded-b-2xl rounded-t-none border border-t-0 ${style.border} ${style.bg}`}>
              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="flex flex-col items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <p className="text-white font-black text-sm">{stats.totalXP.toLocaleString()}</p>
                  <p className="text-[9px] text-white/30 font-mono uppercase">XP</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <p className="text-white font-black text-sm">{stats.currentStreak}wk</p>
                  <p className="text-[9px] text-white/30 font-mono uppercase">Streak</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-violet-400" />
                  <p className="text-white font-black text-sm truncate max-w-[50px] text-center">{bestPair}</p>
                  <p className="text-[9px] text-white/30 font-mono uppercase">Fav Pair</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-rose-400" />
                  <p className="text-white font-black text-sm">{stats.newPairings}</p>
                  <p className="text-[9px] text-white/30 font-mono uppercase">New Pairs</p>
                </div>
              </div>

              {/* XP progress to next tier */}
              {rankInfo.nextXP !== Infinity && (
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-white/25 font-mono">{rankInfo.icon} {rankInfo.label}</span>
                    <span className="text-[9px] text-white/25 font-mono">
                      {stats.totalXP} / {rankInfo.nextXP} XP → next rank
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-300"
                    />
                  </div>
                </div>
              )}

              {/* Footer: rank label + Agatambyi count */}
              <div className="pt-2 border-t border-white/8 flex items-center justify-between">
                <span className={`text-[10px] font-bold font-mono tracking-wider ${style.color}`}>
                  {rankInfo.icon} {rankInfo.label}
                </span>
                <div className="flex items-center gap-3">
                  {stats.agatambyiCount > 0 && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 font-mono">
                      ⭐ Agatambyi ×{stats.agatambyiCount}
                    </span>
                  )}
                  {stats.longestStreak >= 3 && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 font-mono">
                      🔥 Best streak: {stats.longestStreak}wk
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Empty state ────────────────────────────────────────────────────────────────
const EmptyState = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
    className="text-center py-20">
    <div className="text-5xl mb-4">👑</div>
    <p className="text-white/30 text-sm font-mono">No heroes yet.</p>
    <p className="text-white/20 text-xs font-mono mt-1">
      Run at least one session from the Admin page to see the leaderboard.
    </p>
  </motion.div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [filter,   setFilter  ] = useState<FilterType>("all");
  const [heroes,   setHeroes  ] = useState<HeroStats[]>([]);
  const [store,    setStore   ] = useState<FOWStore | null>(null);
  const [loading,  setLoading ] = useState(true);

  const loadData = () => {
    const s = loadStore();
    setStore(s);
    setHeroes(computeAllHeroStats(s));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filtered = heroes.filter((h) =>
    filter === "all" ? true : h.role === filter
  ); // already sorted by totalXP desc from computeAllHeroStats

  const top3    = filtered.slice(0, 3);
  const theRest = filtered.slice(3);
  const maxXP   = heroes[0]?.totalXP ?? 1;

  const completedSessions = store?.sessions.filter((s) => s.result !== null).length ?? 0;
  const totalPairings     = store?.sessions.reduce(
    (sum, s) => sum + (s.result?.pairs.length ?? 0), 0
  ) ?? 0;

  if (loading) {
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
        <div className="absolute top-0 left-1/3 w-[500px] h-[400px] bg-yellow-900/12 rounded-full blur-[140px]" />
        <div className="absolute top-1/4 right-0 w-80 h-80 bg-violet-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* ── Header ── */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-mono tracking-widest text-yellow-400 uppercase">Hall of Fame</span>
            </div>
            {/* Refresh */}
            <motion.button whileTap={{ scale: 0.85 }} onClick={loadData}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-white/40" />
            </motion.button>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-2">
            <span className="text-white">Royal </span>
            <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Legends
            </span>
          </h1>
          <p className="text-white/30 text-sm">
            {completedSessions > 0
              ? `Live data across ${completedSessions} week${completedSessions !== 1 ? "s" : ""}`
              : "Complete a session to see rankings"}
          </p>
        </motion.div>

        {/* ── Season Stats Bar ── */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
          className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label:"Heroes",       value: heroes.length,      icon:<UsersIcon />,                                              color:"text-white"       },
            { label:"Total Pairs",  value: totalPairings,      icon:<Zap className="w-4 h-4 text-yellow-400" />,               color:"text-yellow-300"  },
            { label:"Weeks",        value: completedSessions,  icon:<TrendingUp className="w-4 h-4 text-violet-400" />,        color:"text-violet-300"  },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
              transition={{ delay:0.15+i*0.05 }}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
              <div>{s.icon}</div>
              <motion.span key={s.value} initial={{ scale:1.4 }} animate={{ scale:1 }}
                className={`text-xl font-black ${s.color}`}>{s.value}</motion.span>
              <span className="text-[9px] text-white/25 tracking-widest uppercase font-mono text-center leading-tight">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {heroes.length === 0 ? <EmptyState /> : (
          <>
            {/* ── Filter Pills ── */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}
              className="flex items-center gap-2 mb-8 p-1 bg-white/5 border border-white/8 rounded-2xl">
              {([
                { id:"all",   label:"All Heroes", icon:"🧙" },
                { id:"king",  label:"Kings",      icon:"⚔️" },
                { id:"queen", label:"Queens",     icon:"👑" },
              ] as { id: FilterType; label: string; icon: string }[]).map((f) => (
                <motion.button key={f.id} whileTap={{ scale:0.97 }}
                  onClick={() => setFilter(f.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all duration-200
                              ${filter === f.id
                                ? "bg-white/15 text-white shadow-sm border border-white/20"
                                : "text-white/40 hover:text-white/60"}`}>
                  <span>{f.icon}</span><span>{f.label}</span>
                </motion.button>
              ))}
            </motion.div>

            {/* ── Podium ── */}
            {top3.length >= 3 && (
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
                className="mb-8">
                <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase text-center mb-6">✦ Top 3 Legends ✦</p>
                <div className="flex items-end justify-center gap-3 sm:gap-5">
                  {[top3[1], top3[0], top3[2]].map((hero, i) => {
                    const realRank = i === 0 ? 2 : i === 1 ? 1 : 3;
                    return (
                      <PodiumCard
                        key={hero.id} stats={hero} rank={realRank} index={i}
                        bestPair={store ? getBestPairName(hero, store) : "—"}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── XP Breakdown legend ── */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.25 }}
              className="mb-6 p-4 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase text-center mb-3">How XP is earned</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:"Show up & get paired", xp:"+100", color:"text-white/60"    },
                  { label:"New partner (first time)", xp:"+50",  color:"text-green-400/70" },
                  { label:"Being Agatambyi ⭐",    xp:"+75",  color:"text-yellow-400/70" },
                  { label:"Same-gender fallback",  xp:"+25",  color:"text-orange-400/70" },
                  { label:"Streak bonus (per week)",xp:"+10%", color:"text-blue-400/70"  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white/5">
                    <span className="text-[10px] text-white/40 leading-tight">{row.label}</span>
                    <span className={`text-[10px] font-black font-mono shrink-0 ${row.color}`}>{row.xp}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Divider ── */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/8" />
              <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase whitespace-nowrap">
                Full Rankings · sorted by XP
              </p>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* ── Full list ── */}
            <div className="flex flex-col gap-1.5">
              <AnimatePresence mode="popLayout">
                {filtered.map((hero, i) => (
                  <LeaderboardRow
                    key={hero.id}
                    stats={hero}
                    rank={i + 1}
                    index={i}
                    bestPair={store ? getBestPairName(hero, store) : "—"}
                    maxXP={maxXP}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* ── Tier legend ── */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
              className="mt-8 p-4 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase text-center mb-3">Rank Tiers · XP required</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { icon:"🌱", label:"Novice",   xp:"0",    color:"text-white/40"   },
                  { icon:"🗡️", label:"Warrior",  xp:"150",  color:"text-blue-300"   },
                  { icon:"⚡", label:"Veteran",  xp:"500",  color:"text-violet-300" },
                  { icon:"🛡️", label:"Elite",    xp:"1.2k", color:"text-amber-500"  },
                  { icon:"⚔️", label:"Legend",   xp:"2.5k", color:"text-slate-300"  },
                  { icon:"👑", label:"Champion", xp:"5k",   color:"text-yellow-300" },
                ].map((t) => (
                  <div key={t.label} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/8">
                    <span className="text-xs">{t.icon}</span>
                    <span className={`text-[10px] font-mono font-bold ${t.color}`}>{t.label}</span>
                    <span className="text-[9px] text-white/20 font-mono">{t.xp}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Inline icon ───────────────────────────────────────────────────────────────
function UsersIcon() {
  return (
    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}