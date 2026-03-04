"use client";
// app/leaderboard/page.tsx — reads live from Supabase player_profiles

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Flame, TrendingUp, Star, Shield, RefreshCw } from "lucide-react";
import {
  supabase, getLeaderboard, getRankTier,
  type DBPlayerProfile,
} from "@/lib/supabase";

type Filter = "all" | "king" | "queen";

// ── Helpers ───────────────────────────────────────────────────────────────────
function xpProgress(p: DBPlayerProfile) {
  const r = getRankTier(p.total_xp);
  if (r.nextXP === Infinity) return 100;
  return Math.min(100, Math.round(((p.total_xp - r.minXP) / (r.nextXP - r.minXP)) * 100));
}

async function getBestPartner(p: DBPlayerProfile): Promise<string> {
  // Count pair occurrences in the pairs table by name
  const { data } = await supabase.from("pairs").select("member_a_name,member_b_name");
  if (!data) return "—";
  const key = p.name; // already lowercased
  const counts: Record<string, number> = {};
  for (const row of data) {
    const a = row.member_a_name.toLowerCase(), b = row.member_b_name.toLowerCase();
    if (a === key) counts[b] = (counts[b] ?? 0) + 1;
    if (b === key) counts[a] = (counts[a] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return "—";
  const [top] = entries.sort((a, b) => b[1] - a[1])[0];
  // Get display name
  const { data: prof } = await supabase.from("player_profiles")
    .select("display_name").eq("name", top).maybeSingle();
  return prof?.display_name ?? top;
}

// ── Podium style — always gold/silver/bronze by position ─────────────────────
function podiumStyle(rank: number) {
  if (rank === 1) return {
    color:"text-yellow-300", bg:"bg-yellow-400/20", border:"border-yellow-400/50",
    glow:"rgba(250,204,21,0.35)", rankColor:"text-yellow-300",
    podiumBg:"bg-gradient-to-t from-yellow-900/40 to-yellow-400/15",
    pulse:["0 0 15px rgba(250,204,21,0.4)","0 0 45px rgba(250,204,21,0.75)","0 0 15px rgba(250,204,21,0.4)"],
    medal:"🥇",
  };
  if (rank === 2) return {
    color:"text-slate-200", bg:"bg-slate-400/15", border:"border-slate-300/50",
    glow:"rgba(203,213,225,0.25)", rankColor:"text-slate-200",
    podiumBg:"bg-gradient-to-t from-slate-800/40 to-slate-400/15",
    pulse:["0 0 10px rgba(203,213,225,0.3)","0 0 28px rgba(203,213,225,0.55)","0 0 10px rgba(203,213,225,0.3)"],
    medal:"🥈",
  };
  return {
    color:"text-amber-500", bg:"bg-amber-700/15", border:"border-amber-600/50",
    glow:"rgba(180,83,9,0.3)", rankColor:"text-amber-500",
    podiumBg:"bg-gradient-to-t from-amber-950/40 to-amber-700/15",
    pulse:["0 0 10px rgba(180,83,9,0.3)","0 0 28px rgba(180,83,9,0.55)","0 0 10px rgba(180,83,9,0.3)"],
    medal:"🥉",
  };
}

// ── Row tier style — by XP tier ───────────────────────────────────────────────
function tierStyle(xp: number) {
  const { tier } = getRankTier(xp);
  switch (tier) {
    case "champion": return { color:"text-yellow-300", bg:"bg-yellow-400/15", border:"border-yellow-400/40", glow:"rgba(250,204,21,0.25)", rc:"text-yellow-300" };
    case "legend":   return { color:"text-slate-300",  bg:"bg-slate-400/15",  border:"border-slate-400/40",  glow:"rgba(148,163,184,0.2)", rc:"text-slate-300"  };
    case "elite":    return { color:"text-amber-500",  bg:"bg-amber-700/15",  border:"border-amber-700/40",  glow:"rgba(180,83,9,0.2)",    rc:"text-amber-500"  };
    case "veteran":  return { color:"text-violet-300", bg:"bg-violet-500/10", border:"border-violet-500/20", glow:"rgba(139,92,246,0.1)",  rc:"text-violet-300" };
    case "warrior":  return { color:"text-blue-300",   bg:"bg-blue-500/10",   border:"border-blue-500/20",   glow:"rgba(59,130,246,0.1)",  rc:"text-blue-300"   };
    default:         return { color:"text-white/50",   bg:"bg-white/5",       border:"border-white/10",      glow:"transparent",           rc:"text-white/40"   };
  }
}

// ── Podium Card ───────────────────────────────────────────────────────────────
const PodiumCard = ({ p, rank, order }: { p: DBPlayerProfile; rank: number; order: number }) => {
  const s = podiumStyle(rank);
  const r = getRankTier(p.total_xp);
  const heights = ["h-36","h-28","h-24"];
  const delays  = [0.1, 0.05, 0.15];

  return (
    <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }}
      transition={{ delay:delays[order], duration:0.6, type:"spring", bounce:0.3 }}
      className={`flex flex-col items-center gap-2 ${order===0?"order-2":order===1?"order-1":"order-3"}`}>

      <div className={`flex flex-col items-center gap-1.5 ${order===0?"scale-105":order===2?"scale-95":""}`}>
        <motion.div animate={{ rotate: rank===1?[0,8,-8,0]:0 }}
          transition={{ duration:3, repeat:Infinity }} className="text-2xl mb-0.5">
          {s.medal}
        </motion.div>

        <motion.div animate={{ boxShadow: s.pulse }} transition={{ duration:2, repeat:Infinity }}
          className={`w-14 h-14 rounded-2xl border-2 ${s.border} ${s.bg} flex items-center justify-center text-2xl`}>
          {p.role==="king" ? "⚔️" : "👑"}
        </motion.div>

        <p className={`font-black text-sm ${s.color} text-center max-w-[80px] truncate`}>{p.display_name}</p>
        <p className="text-[10px] text-white/30 font-mono">{p.appearances}× paired</p>

        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.color} border ${s.border}`}>
          <Zap className="w-2.5 h-2.5" />
          {p.total_xp >= 1000 ? `${(p.total_xp/1000).toFixed(1)}k` : p.total_xp} XP
        </div>
        <div className="text-[9px] text-white/25 font-mono">{r.icon} {r.label}</div>
      </div>

      {/* Podium block */}
      <div className={`w-20 sm:w-24 ${heights[order]} rounded-t-2xl border-t-2 border-x-2 ${s.border} ${s.podiumBg}
                       flex items-start justify-center pt-2 relative overflow-hidden`}
        style={{ boxShadow:`0 -4px 20px ${s.glow}` }}>
        <motion.div animate={{ x:["-100%","200%"] }}
          transition={{ duration:2.5, repeat:Infinity, delay:order*0.4, ease:"easeInOut" }}
          className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12" />
        <span className={`font-black text-2xl ${s.rankColor} relative z-10`}>#{rank}</span>
      </div>
    </motion.div>
  );
};

// ── Leaderboard Row ───────────────────────────────────────────────────────────
const Row = ({ p, rank, i, maxXP }: { p: DBPlayerProfile; rank: number; i: number; maxXP: number }) => {
  const [open,       setOpen      ] = useState(false);
  const [bestPair,   setBestPair  ] = useState("...");
  const s = tierStyle(p.total_xp);
  const r = getRankTier(p.total_xp);
  const bar = maxXP > 0 ? Math.round((p.total_xp / maxXP) * 100) : 0;

  useEffect(() => {
    if (open && bestPair === "...") getBestPartner(p).then(setBestPair);
  }, [open]);

  return (
    <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
      transition={{ delay:0.04+i*0.04, type:"spring" }} layout>
      <motion.div whileHover={{ x:3 }} onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all
                    ${open ? `${s.bg} ${s.border}` : "bg-white/5 border-white/8 hover:bg-white/8 hover:border-white/15"}`}
        style={open ? { boxShadow:`0 0 20px ${s.glow}` } : {}}>

        {/* Rank number */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${s.bg} border ${s.border}`}>
          <span className={s.rc}>{rank}</span>
        </div>

        {/* Role icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${s.bg}`}>
          {p.role==="king"?"⚔️":"👑"}
        </div>

        {/* Name + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-black text-sm truncate ${open?s.color:"text-white"}`}>{p.display_name}</span>
            {p.current_streak >= 3 && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 shrink-0">
                <Flame className="w-2.5 h-2.5 text-orange-400"/>
                <span className="text-[9px] text-orange-400 font-mono font-bold">{p.current_streak}</span>
              </div>
            )}
            <span className="text-[9px] text-white/20 font-mono shrink-0">{r.icon}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
              <motion.div initial={{ width:0 }} animate={{ width:`${bar}%` }}
                transition={{ delay:0.1+i*0.04, duration:0.9, ease:"easeOut" }}
                className="h-full rounded-full"
                style={{ background: rank<=3 ? `linear-gradient(90deg,${s.glow.replace(/[\d.]+\)$/,"0.9)")},${s.glow})` : "rgba(255,255,255,0.2)" }} />
            </div>
            <span className="text-[10px] text-white/25 font-mono shrink-0">
              {p.total_xp>=1000?`${(p.total_xp/1000).toFixed(1)}k`:p.total_xp}
            </span>
          </div>
        </div>

        {/* Appearances */}
        <div className="flex flex-col items-end shrink-0 gap-1">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black ${s.bg} border ${s.border}`}>
            <Star className={`w-3 h-3 ${s.color}`}/><span className={s.color}>{p.appearances}×</span>
          </div>
          <span className="text-[9px] text-white/25 font-mono">paired</span>
        </div>
      </motion.div>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
            exit={{ opacity:0, height:0 }} transition={{ duration:0.22 }} className="overflow-hidden">
            <div className={`mx-2 mb-1 p-4 rounded-b-2xl rounded-t-none border border-t-0 ${s.border} ${s.bg}`}>

              {/* 4-stat grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { icon:<Zap className="w-3.5 h-3.5 text-yellow-400"/>,    val:p.total_xp.toLocaleString(), sub:"Total XP"    },
                  { icon:<Flame className="w-3.5 h-3.5 text-orange-400"/>,  val:`${p.current_streak}wk`,     sub:"Streak"      },
                  { icon:<Shield className="w-3.5 h-3.5 text-violet-400"/>, val:bestPair,                    sub:"Best Pair"   },
                  { icon:<Star className="w-3.5 h-3.5 text-rose-400"/>,     val:p.new_pairings,              sub:"New Pairs"   },
                ].map((stat,idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    {stat.icon}
                    <p className="text-white font-black text-sm truncate max-w-[56px] text-center">{stat.val}</p>
                    <p className="text-[9px] text-white/30 font-mono uppercase">{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* XP progress to next tier */}
              {r.nextXP !== Infinity && (
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-white/25 font-mono">{r.icon} {r.label}</span>
                    <span className="text-[9px] text-white/25 font-mono">{p.total_xp} / {r.nextXP} XP</span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div initial={{ width:0 }} animate={{ width:`${xpProgress(p)}%` }}
                      transition={{ duration:0.8, ease:"easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-300" />
                  </div>
                </div>
              )}

              {/* Challenge XP bar */}
              {p.challenge_xp > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-white/25 font-mono">Challenge XP</span>
                    <span className="text-[9px] text-violet-400 font-mono">+{p.challenge_xp} XP</span>
                  </div>
                  <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400/60"
                      style={{ width:`${Math.min(100,Math.round((p.challenge_xp/p.total_xp)*100))}%` }} />
                  </div>
                </div>
              )}

              {/* Footer badges */}
              <div className="pt-2 border-t border-white/8 flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold font-mono ${s.color}`}>{r.icon} {r.label}</span>
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [filter,   setFilter  ] = useState<Filter>("all");
  const [profiles, setProfiles] = useState<DBPlayerProfile[]>([]);
  const [loading,  setLoading ] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getLeaderboard();
    setProfiles(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Realtime: re-fetch whenever any player_profile changes
    const ch = supabase.channel("leaderboard-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"player_profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = profiles.filter(p => filter==="all" || p.role===filter);
  const top3     = filtered.slice(0, 3);
  const rest     = filtered.slice(3);
  const maxXP    = profiles[0]?.total_xp ?? 1;
  const completedWeeks = Math.max(...profiles.map(p => p.last_seen_week), 0);
  const totalPairings  = profiles.reduce((s, p) => s + p.appearances, 0);

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }}
        className="text-4xl">👑</motion.div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[400px] bg-yellow-900/12 rounded-full blur-[140px]" />
        <div className="absolute top-1/4 right-0 w-80 h-80 bg-violet-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-3.5 h-3.5 text-yellow-400"/>
              <span className="text-xs font-mono tracking-widest text-yellow-400 uppercase">Hall of Fame</span>
            </div>
            <motion.button whileTap={{ scale:0.85 }} onClick={load}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-white/40"/>
            </motion.button>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-2">
            <span className="text-white">Royal </span>
            <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">Legends</span>
          </h1>
          <p className="text-white/30 text-sm">
            Live · {completedWeeks} week{completedWeeks!==1?"s":""} played · updates in real-time
          </p>
        </motion.div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label:"Heroes",      val:profiles.length,    icon:<UsersIcon/>,                                            color:"text-white"      },
            { label:"Pairings",    val:totalPairings,       icon:<Zap className="w-4 h-4 text-yellow-400"/>,             color:"text-yellow-300" },
            { label:"Weeks",       val:completedWeeks,      icon:<TrendingUp className="w-4 h-4 text-violet-400"/>,      color:"text-violet-300" },
          ].map((s,i) => (
            <motion.div key={s.label} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
              transition={{ delay:0.1+i*0.05 }}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
              {s.icon}
              <motion.span key={s.val} initial={{ scale:1.4 }} animate={{ scale:1 }}
                className={`text-xl font-black ${s.color}`}>{s.val}</motion.span>
              <span className="text-[9px] text-white/25 uppercase font-mono">{s.label}</span>
            </motion.div>
          ))}
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">👑</div>
            <p className="text-white/30 text-sm font-mono">No heroes yet.</p>
            <p className="text-white/20 text-xs font-mono mt-1">Complete a session to see rankings.</p>
          </div>
        ) : (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 mb-8 p-1 bg-white/5 border border-white/8 rounded-2xl">
              {([{id:"all",label:"All Heroes",icon:"🧙"},{id:"king",label:"Kings",icon:"⚔️"},{id:"queen",label:"Queens",icon:"👑"}] as {id:Filter;label:string;icon:string}[]).map(f=>(
                <motion.button key={f.id} whileTap={{ scale:0.97 }} onClick={() => setFilter(f.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all
                              ${filter===f.id?"bg-white/15 text-white border border-white/20":"text-white/40 hover:text-white/60"}`}>
                  <span>{f.icon}</span><span>{f.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Podium */}
            {top3.length >= 3 && (
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }} className="mb-8">
                <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase text-center mb-6">✦ Top 3 Legends ✦</p>
                <div className="flex items-end justify-center gap-3 sm:gap-5">
                  {[{p:top3[1],r:2,o:1},{p:top3[0],r:1,o:0},{p:top3[2],r:3,o:2}].map(({p,r,o})=>(
                    <PodiumCard key={p.name} p={p} rank={r} order={o}/>
                  ))}
                </div>
              </motion.div>
            )}

            {/* XP breakdown */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.25 }}
              className="mb-6 p-4 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-[10px] text-white/25 font-mono uppercase text-center mb-3 tracking-widest">How XP is earned</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:"Show up & get paired",      xp:"+100", c:"text-white/60"      },
                  { label:"New partner (first time)",  xp:"+50",  c:"text-green-400/70"  },
                  { label:"Being Agatambyi ⭐",        xp:"+75",  c:"text-yellow-400/70" },
                  { label:"Same-gender pair",          xp:"+25",  c:"text-orange-400/70" },
                  { label:"Weekly challenge answer",   xp:"varies",c:"text-violet-400/70"},
                  { label:"Streak bonus (per week)",   xp:"+10%", c:"text-blue-400/70"   },
                ].map(row=>(
                  <div key={row.label} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white/5">
                    <span className="text-[10px] text-white/40 leading-tight">{row.label}</span>
                    <span className={`text-[10px] font-black font-mono shrink-0 ${row.c}`}>{row.xp}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/8"/>
              <p className="text-[10px] text-white/25 font-mono uppercase whitespace-nowrap">Full Rankings · sorted by XP</p>
              <div className="flex-1 h-px bg-white/8"/>
            </div>

            {/* Full list */}
            <div className="flex flex-col gap-1.5">
              <AnimatePresence mode="popLayout">
                {filtered.map((p,i) => <Row key={p.name} p={p} rank={i+1} i={i} maxXP={maxXP}/>)}
              </AnimatePresence>
            </div>

            {/* Tier legend */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
              className="mt-8 p-4 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-[10px] text-white/25 font-mono uppercase text-center mb-3">Rank Tiers · XP required</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  {icon:"🌱",label:"Novice",  xp:"0",    c:"text-white/40"},
                  {icon:"🗡️",label:"Warrior", xp:"150",  c:"text-blue-300"},
                  {icon:"⚡",label:"Veteran", xp:"500",  c:"text-violet-300"},
                  {icon:"🛡️",label:"Elite",   xp:"1.2k", c:"text-amber-500"},
                  {icon:"⚔️",label:"Legend",  xp:"2.5k", c:"text-slate-300"},
                  {icon:"👑",label:"Champion",xp:"5k",   c:"text-yellow-300"},
                ].map(t=>(
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

function UsersIcon() {
  return (
    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}