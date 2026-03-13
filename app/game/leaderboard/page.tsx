"use client";
// app/game/leaderboard/page.tsx

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Flame, Star, Shield, RefreshCw } from "lucide-react";
import {
  supabase, getLeaderboard, getRankTier,
  type DBPlayerProfile,
} from "@/lib/supabase";
import { avatarUrl } from "@/app/game/layout";

type Filter = "all" | "king" | "queen";

// ── Helpers ───────────────────────────────────────────────────────────────────
function xpProgress(p: DBPlayerProfile) {
  const r = getRankTier(p.total_xp);
  if (r.nextXP === Infinity) return 100;
  return Math.min(100, Math.round(((p.total_xp - r.minXP) / (r.nextXP - r.minXP)) * 100));
}

async function getBestPartner(p: DBPlayerProfile): Promise<string> {
  const { data } = await supabase.from("pairs").select("member_a_name,member_b_name");
  if (!data) return "—";
  const key = p.name;
  const counts: Record<string, number> = {};
  for (const row of data) {
    const a = row.member_a_name.toLowerCase(), b = row.member_b_name.toLowerCase();
    if (a === key) counts[b] = (counts[b] ?? 0) + 1;
    if (b === key) counts[a] = (counts[a] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return "—";
  const [top] = entries.sort((a, b) => b[1] - a[1])[0];
  const { data: prof } = await supabase.from("player_profiles")
    .select("display_name").eq("name", top).maybeSingle();
  return prof?.display_name ?? top;
}

// ── Podium Card (matches ChampionsPage HeroCard) ──────────────────────────────
const PodiumCard = ({
  p, rank, order, myName,
}: { p: DBPlayerProfile; rank: number; order: number; myName: string }) => {
  const isMe  = p.name === myName.toLowerCase();
  const tier  = getRankTier(p.total_xp);
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const glow  = rank === 1 ? "#facc15" : rank === 2 ? "#cbd5e1" : "#b45309";
  const textC = rank === 1 ? "text-yellow-300" : rank === 2 ? "text-slate-200" : "text-amber-500";
  const sizes = ["w-16 h-16", "w-14 h-14", "w-12 h-12"];
  const podH  = rank === 1 ? "h-10" : rank === 2 ? "h-7" : "h-5";
  const delayMap = [0.1, 0.05, 0.15];
  const orderClass = rank === 2 ? "order-1" : rank === 1 ? "order-2" : "order-3";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: delayMap[order], type: "spring", bounce: 0.3 }}
      className={`flex flex-col items-center gap-2 ${orderClass}`}
    >
      {/* Medal */}
      <motion.div
        animate={rank === 1 ? { rotate: [0, 8, -8, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity }}
        className="text-xl"
      >{medal}</motion.div>

      {/* Avatar with glow ring */}
      <motion.div
        animate={rank === 1 ? {
          boxShadow: [`0 0 12px ${glow}40`, `0 0 38px ${glow}80`, `0 0 12px ${glow}40`],
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`${sizes[rank - 1]} rounded-2xl overflow-hidden border-2 relative`}
        style={{ borderColor: isMe ? "#ffffff80" : `${glow}60` }}
      >
        <img
          src={avatarUrl(p.display_name)}
          alt={p.display_name}
          className="w-full h-full object-cover bg-white/5"
        />
        {/* Role badge */}
        <div className="absolute bottom-0.5 right-0.5 text-[10px] leading-none drop-shadow">
          {p.role === "king" ? "⚔️" : "👑"}
        </div>
      </motion.div>

      {/* Name */}
      <div className="text-center">
        <p className={`${rank === 1 ? "text-sm" : "text-xs"} font-black text-white max-w-[74px] truncate`}>
          {p.display_name}
        </p>
        {isMe && <p className="text-[8px] text-white/35 font-mono">(you)</p>}
        <div className={`flex items-center justify-center gap-0.5 text-[10px] font-black font-mono ${textC}`}>
          <Zap className="w-2.5 h-2.5" />
          {p.total_xp >= 1000 ? `${(p.total_xp / 1000).toFixed(1)}k` : p.total_xp}
        </div>
        <p className="text-[8px] text-white/20 font-mono">{tier.icon} {tier.label}</p>
      </div>

      {/* Podium base */}
      <div
        className={`w-16 sm:w-20 ${podH} rounded-t-xl border-t border-x flex items-center justify-center`}
        style={{
          borderColor: `${glow}40`,
          background: `linear-gradient(to top, ${glow}08, ${glow}22)`,
          boxShadow: `0 -4px 16px ${glow}18`,
        }}
      >
        <span className={`font-black text-sm ${textC}`}>#{rank}</span>
      </div>
    </motion.div>
  );
};

// ── Full-list Row with avatar ──────────────────────────────────────────────────
const Row = ({
  p, rank, i, maxXP, myName,
}: { p: DBPlayerProfile; rank: number; i: number; maxXP: number; myName: string }) => {
  const [open,     setOpen    ] = useState(false);
  const [bestPair, setBestPair] = useState("...");
  const isMe = p.name === myName.toLowerCase();
  const tier = getRankTier(p.total_xp);
  const bar  = maxXP > 0 ? Math.round((p.total_xp / maxXP) * 100) : 0;

  const accent = (() => {
    switch (tier.tier) {
      case "champion": return { t:"text-yellow-300", b:"border-yellow-400/35", bg:"bg-yellow-400/10", g:"rgba(250,204,21,0.18)" };
      case "legend":   return { t:"text-slate-300",  b:"border-slate-400/35",  bg:"bg-slate-400/10",  g:"rgba(148,163,184,0.12)" };
      case "elite":    return { t:"text-amber-500",  b:"border-amber-600/35",  bg:"bg-amber-700/10",  g:"rgba(180,83,9,0.12)" };
      case "veteran":  return { t:"text-violet-300", b:"border-violet-500/25", bg:"bg-violet-500/8",  g:"rgba(139,92,246,0.1)" };
      case "warrior":  return { t:"text-blue-300",   b:"border-blue-500/25",   bg:"bg-blue-500/8",    g:"rgba(59,130,246,0.1)" };
      default:         return { t:"text-white/50",   b:"border-white/10",      bg:"bg-white/5",       g:"transparent" };
    }
  })();

  useEffect(() => {
    if (open && bestPair === "...") getBestPartner(p).then(setBestPair);
  }, [open]); // eslint-disable-line

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.03 + i * 0.03, type: "spring" }}
      layout
    >
      <motion.div
        whileHover={{ x: 2 }}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all
                    ${open
                      ? `${accent.bg} ${accent.b}`
                      : isMe
                        ? "bg-blue-500/8 border-blue-400/25 hover:bg-blue-500/12"
                        : "bg-white/4 border-white/8 hover:bg-white/7"}`}
        style={open ? { boxShadow: `0 0 18px ${accent.g}` } : {}}
      >
        {/* Rank bubble */}
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0
                         ${rank === 1 ? "bg-yellow-400/20 border border-yellow-400/40 text-yellow-300"
                           : rank === 2 ? "bg-slate-400/15 border border-slate-300/40 text-slate-200"
                           : rank === 3 ? "bg-amber-700/15 border border-amber-600/40 text-amber-500"
                           : `${accent.bg} border ${accent.b} ${accent.t}`}`}>
          {rank}
        </div>

        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl overflow-hidden border shrink-0 relative
                         ${isMe ? "border-blue-400/50" : "border-white/10"}`}>
          <img
            src={avatarUrl(p.display_name)}
            alt={p.display_name}
            className="w-full h-full object-cover bg-white/5"
          />
          <div className="absolute bottom-0 right-0 text-[8px] leading-none bg-black/30 rounded-tl px-0.5">
            {p.role === "king" ? "⚔️" : "👑"}
          </div>
        </div>

        {/* Name + XP bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-black text-sm truncate ${open ? accent.t : isMe ? "text-blue-300" : "text-white"}`}>
              {p.display_name}
            </span>
            {isMe && <span className="text-[9px] text-blue-400/60 font-mono shrink-0">(you)</span>}
            {p.current_streak >= 3 && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 shrink-0">
                <Flame className="w-2.5 h-2.5 text-orange-400" />
                <span className="text-[9px] text-orange-400 font-mono font-bold">{p.current_streak}</span>
              </div>
            )}
            <span className="text-[9px] text-white/20 font-mono ml-auto shrink-0">{tier.icon}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${bar}%` }}
                transition={{ delay: 0.1 + i * 0.03, duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{
                  background: rank === 1 ? "linear-gradient(90deg,#92400e,#facc15)"
                    : rank === 2 ? "linear-gradient(90deg,#475569,#cbd5e1)"
                    : rank === 3 ? "linear-gradient(90deg,#78350f,#b45309)"
                    : "rgba(255,255,255,0.2)",
                }}
              />
            </div>
            <span className="text-[10px] text-white/25 font-mono shrink-0">
              {p.total_xp >= 1000 ? `${(p.total_xp / 1000).toFixed(1)}k` : p.total_xp} XP
            </span>
          </div>
        </div>

        {/* Appearances */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black shrink-0 border ${accent.b} ${accent.bg}`}>
          <Star className={`w-3 h-3 ${accent.t}`} />
          <span className={accent.t}>{p.appearances}×</span>
        </div>
      </motion.div>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`mx-2 mb-1 p-4 rounded-b-2xl rounded-t-none border border-t-0 ${accent.b} ${accent.bg}`}>
              {/* Panel avatar header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/15 shrink-0">
                  <img src={avatarUrl(p.display_name)} alt={p.display_name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className={`font-black text-base ${accent.t}`}>{p.display_name}</p>
                  <p className="text-[10px] text-white/30 font-mono">{tier.icon} {tier.label} · #{rank} overall</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { icon: <Zap className="w-3.5 h-3.5 text-yellow-400"/>,    val: p.total_xp.toLocaleString(), sub: "Total XP"  },
                  { icon: <Flame className="w-3.5 h-3.5 text-orange-400"/>,  val: `${p.current_streak}wk`,     sub: "Streak"    },
                  { icon: <Shield className="w-3.5 h-3.5 text-violet-400"/>, val: bestPair,                    sub: "Best Pair" },
                  { icon: <Star className="w-3.5 h-3.5 text-rose-400"/>,     val: String(p.new_pairings),      sub: "New Pairs" },
                ].map((s, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    {s.icon}
                    <p className="text-white font-black text-sm truncate max-w-[56px] text-center">{s.val}</p>
                    <p className="text-[9px] text-white/30 font-mono uppercase">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* XP progress */}
              {tier.nextXP !== Infinity && (
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-white/25 font-mono">{tier.icon} {tier.label}</span>
                    <span className="text-[9px] text-white/25 font-mono">{p.total_xp} / {tier.nextXP} XP</span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${xpProgress(p)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-300"
                    />
                  </div>
                </div>
              )}

              {/* Badges */}
              <div className="pt-2 border-t border-white/8 flex flex-wrap gap-2">
                {p.agatambyi_count > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 font-mono">
                    ⭐ Agatambyi ×{p.agatambyi_count}
                  </span>
                )}
                {p.longest_streak >= 3 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 font-mono">
                    🔥 Best streak: {p.longest_streak}wk
                  </span>
                )}
                {p.challenge_xp > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 font-mono">
                    🎯 +{p.challenge_xp} challenge XP
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [filter,   setFilter  ] = useState<Filter>("all");
  const [profiles, setProfiles] = useState<DBPlayerProfile[]>([]);
  const [loading,  setLoading ] = useState(true);
  const [myName,   setMyName  ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getLeaderboard();
    setProfiles(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    setMyName(localStorage.getItem("fow_my_name") ?? "");
    load();
    const ch = supabase.channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "player_profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = profiles.filter(p => filter === "all" || p.role === filter);
  const top3     = filtered.slice(0, 3);
  const maxXP    = profiles[0]?.total_xp ?? 1;
  const completedWeeks = Math.max(...profiles.map(p => p.last_seen_week), 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="text-4xl">👑</motion.div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 pointer-events-none -z-0">
        <div className="absolute top-0 left-1/3 w-[500px] h-[400px] bg-yellow-900/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-violet-900/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-7">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-mono tracking-widest text-yellow-400 uppercase">Hall of Fame</span>
            </div>
            <motion.button whileTap={{ scale: 0.85 }} onClick={load}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-white/40" />
            </motion.button>
          </div>
          <h1 className="text-4xl font-black tracking-tight leading-none mb-2">
            <span className="text-white">Royal </span>
            <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">Legends</span>
          </h1>
          <p className="text-white/30 text-sm">
            {completedWeeks} week{completedWeeks !== 1 ? "s" : ""} · {profiles.length} heroes · live
          </p>
        </motion.div>

        {profiles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">👑</div>
            <p className="text-white/30 text-sm font-mono">No heroes yet. Complete a session!</p>
          </div>
        ) : (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 mb-7 p-1 bg-white/5 border border-white/8 rounded-2xl">
              {(["all","king","queen"] as Filter[]).map((f, fi) => (
                <motion.button key={f} whileTap={{ scale: 0.97 }} onClick={() => setFilter(f)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all
                              ${filter === f ? "bg-white/15 text-white border border-white/20" : "text-white/40 hover:text-white/60"}`}>
                  <span>{f === "all" ? "🧙" : f === "king" ? "⚔️" : "👑"}</span>
                  <span>{f === "all" ? "All" : f === "king" ? "Kings" : "Queens"}</span>
                </motion.button>
              ))}
            </div>

            {/* ── PODIUM ── */}
            {top3.length >= 3 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }} className="mb-8">
                <p className="text-[10px] text-white/20 font-mono tracking-widest uppercase text-center mb-5">✦ Top 3 Legends ✦</p>
                <div className="flex items-end justify-center gap-4 sm:gap-6">
                  {[
                    { p: top3[1], rank: 2, order: 1 },
                    { p: top3[0], rank: 1, order: 0 },
                    { p: top3[2], rank: 3, order: 2 },
                  ].map(({ p, rank, order }) => (
                    <PodiumCard key={p.name} p={p} rank={rank} order={order} myName={myName} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/8" />
              <p className="text-[10px] text-white/20 font-mono uppercase whitespace-nowrap">Full Rankings · by XP</p>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Full list */}
            <div className="flex flex-col gap-1.5">
              <AnimatePresence mode="popLayout">
                {filtered.map((p, i) => (
                  <Row key={p.name} p={p} rank={i + 1} i={i} maxXP={maxXP} myName={myName} />
                ))}
              </AnimatePresence>
            </div>

            {/* Tier legend */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="mt-8 p-4 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-[10px] text-white/20 font-mono uppercase text-center mb-3">Rank Tiers</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { icon:"🌱",label:"Novice",   xp:"0",    c:"text-white/40"   },
                  { icon:"🗡️",label:"Warrior",  xp:"150",  c:"text-blue-300"   },
                  { icon:"⚡",label:"Veteran",  xp:"500",  c:"text-violet-300" },
                  { icon:"🛡️",label:"Elite",    xp:"1.2k", c:"text-amber-500"  },
                  { icon:"⚔️",label:"Legend",   xp:"2.5k", c:"text-slate-300"  },
                  { icon:"👑",label:"Champion", xp:"5k",   c:"text-yellow-300" },
                ].map(t => (
                  <div key={t.label} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/8">
                    <span className="text-xs">{t.icon}</span>
                    <span className={`text-[10px] font-mono font-bold ${t.c}`}>{t.label}</span>
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