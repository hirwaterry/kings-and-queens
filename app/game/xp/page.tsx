"use client";
// app/xp/page.tsx

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Zap, Flame, Crown } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { getRankTier } from "@/lib/supabase";

const TIERS = [
  { icon:"🌱", label:"Novice",   minXP:0,    nextXP:150,    color:"text-white/50",   bg:"bg-white/5",       border:"border-white/10",      desc:"Just getting started. Show up every week!" },
  { icon:"🗡️", label:"Warrior",  minXP:150,  nextXP:500,    color:"text-blue-300",   bg:"bg-blue-500/10",   border:"border-blue-500/20",   desc:"You've been around a few weeks. Keep going." },
  { icon:"⚡", label:"Veteran",  minXP:500,  nextXP:1200,   color:"text-violet-300", bg:"bg-violet-500/10", border:"border-violet-500/20", desc:"Regular presence. Pairs trust you." },
  { icon:"🛡️", label:"Elite",    minXP:1200, nextXP:2500,   color:"text-amber-500",  bg:"bg-amber-700/15",  border:"border-amber-700/30",  desc:"Consistent top contributor. Top 20%." },
  { icon:"⚔️", label:"Legend",   minXP:2500, nextXP:5000,   color:"text-slate-300",  bg:"bg-slate-400/15",  border:"border-slate-400/30",  desc:"You've earned serious respect in the realm." },
  { icon:"👑", label:"Champion", minXP:5000, nextXP:Infinity,color:"text-yellow-300", bg:"bg-yellow-400/20", border:"border-yellow-400/40", desc:"The realm's absolute highest honour." },
];

const XP_EVENTS = [
  { label:"Show up & get paired",         xp:"+100",  icon:"👥", color:"text-white/70"    },
  { label:"First time with new partner",  xp:"+50",   icon:"✨", color:"text-green-400"   },
  { label:"Being selected as Agatambyi", xp:"+75",   icon:"⭐", color:"text-yellow-400"  },
  { label:"Same-gender fallback pair",    xp:"+25",   icon:"🤝", color:"text-orange-400"  },
  { label:"Weekly challenge answer",      xp:"varies",icon:"🎯", color:"text-violet-400"  },
  { label:"Streak bonus (per extra week)",xp:"+10%",  icon:"🔥", color:"text-orange-300"  },
];

export default function XPPage() {
  const router = useRouter();
  const { profile, loading, needsSetup, displayName } = useProfile();

  useEffect(() => {
    if (!loading && needsSetup) router.push("/profile");
  }, [loading, needsSetup, router]);

  if (loading || needsSetup) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="text-4xl">⚡</motion.div>
    </div>
  );

  const rank = profile ? getRankTier(profile.total_xp) : null;
  const nextTierIdx = rank ? TIERS.findIndex(t => t.label === rank.label) + 1 : 0;
  const progress = profile && rank && rank.nextXP !== Infinity
    ? Math.min(100, Math.round(((profile.total_xp - rank.minXP) / (rank.nextXP - rank.minXP)) * 100))
    : 100;

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">XP & Ranks</span>
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">{displayName ? `${displayName}'s ` : "Your "}</span>
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">Journey</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Earn XP every week. Rise through the ranks.</p>
        </motion.div>

        {/* My progress card — only if they have a profile */}
        {profile && rank ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-8 p-5 rounded-3xl border border-yellow-400/30 bg-yellow-400/8"
            style={{ boxShadow: "0 0 40px rgba(250,204,21,0.08)" }}>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">{rank.icon}</span>
              <div className="flex-1">
                <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest">Your rank</p>
                <p className="text-yellow-300 font-black text-xl">{rank.label}</p>
                <p className="text-white/40 text-xs font-mono">{profile.total_xp.toLocaleString()} XP total</p>
              </div>
              <div className="text-right">
                <p className="text-white/25 text-[9px] font-mono">streak</p>
                <div className="flex items-center gap-1 justify-end">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-orange-300 font-black">{profile.current_streak}wk</span>
                </div>
              </div>
            </div>

            {rank.nextXP !== Infinity ? (
              <>
                <div className="flex justify-between text-[10px] text-white/30 font-mono mb-1.5">
                  <span>{rank.label}</span>
                  <span>{profile.total_xp.toLocaleString()} / {rank.nextXP.toLocaleString()} → {TIERS[nextTierIdx]?.label}</span>
                </div>
                <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                    className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-300" />
                </div>
                <p className="text-[10px] text-white/20 font-mono mt-1.5">
                  {(rank.nextXP - profile.total_xp).toLocaleString()} XP to {TIERS[nextTierIdx]?.label}
                </p>
              </>
            ) : (
              <p className="text-yellow-300 font-black text-sm text-center py-2">
                👑 Maximum rank achieved — Champion!
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/8">
              {[
                { label:"Appearances",  val:profile.appearances       },
                { label:"New Pairs",    val:profile.new_pairings      },
                { label:"Agatambyi",   val:`×${profile.agatambyi_count}` },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center gap-0.5">
                  <span className="text-white font-black text-lg">{s.val}</span>
                  <span className="text-[9px] text-white/25 font-mono uppercase">{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* No profile yet — show prompt */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
            className="mb-8 p-5 rounded-3xl bg-white/5 border border-white/10 text-center">
            <p className="text-white/50 text-sm mb-3">Join a session to start earning XP and unlocking ranks.</p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/live")}
              className="px-5 py-2.5 bg-red-500/20 border border-red-500/30 rounded-xl
                         text-red-400 text-xs font-bold flex items-center gap-2 mx-auto">
              <Crown className="w-3.5 h-3.5" /> Go to Live Pair
            </motion.button>
          </motion.div>
        )}

        {/* XP events */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-8">
          <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3">How to earn XP</p>
          <div className="flex flex-col gap-2">
            {XP_EVENTS.map((e, i) => (
              <motion.div key={e.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                <span className="text-xl shrink-0">{e.icon}</span>
                <span className="text-sm text-white/70 flex-1">{e.label}</span>
                <span className={`font-black text-sm font-mono shrink-0 ${e.color}`}>{e.xp}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tier table */}
        <div>
          <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3">All Rank Tiers</p>
          <div className="flex flex-col gap-2">
            {TIERS.map((t, i) => {
              const isCurrent = rank?.label === t.label;
              return (
                <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all
                              ${isCurrent ? `${t.bg} ${t.border} ring-1 ring-yellow-400/15` : "bg-white/4 border-white/8"}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${t.bg} border ${t.border}`}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-black text-sm ${isCurrent ? t.color : "text-white/60"}`}>{t.label}</span>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 font-mono">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/35 mt-0.5">{t.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-black text-sm font-mono ${isCurrent ? t.color : "text-white/30"}`}>
                      {t.minXP === 0 ? "0" : t.minXP >= 1000 ? `${t.minXP / 1000}k` : t.minXP}
                    </span>
                    <p className="text-[9px] text-white/20 font-mono">XP</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}