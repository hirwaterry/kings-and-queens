"use client";
// app/champions/page.tsx — hall of fame, special record holders

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Flame, Star, Zap, Crown } from "lucide-react";
import { supabase, getRankTier, type DBPlayerProfile } from "@/lib/supabase";

export default function ChampionsPage() {
  const [profiles, setProfiles] = useState<DBPlayerProfile[]>([]);
  const [loading,  setLoading ] = useState(true);

  useEffect(() => {
    supabase.from("player_profiles").select("*").then(({ data }) => {
      setProfiles(data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }} className="text-3xl">🛡️</motion.div>
    </div>
  );

  // Compute record holders
  const byXP        = [...profiles].sort((a,b) => b.total_xp - a.total_xp);
  const byStreak    = [...profiles].sort((a,b) => b.longest_streak - a.longest_streak);
  const byAgatambyi = [...profiles].sort((a,b) => b.agatambyi_count - a.agatambyi_count).filter(p=>p.agatambyi_count>0);
  const byPairings  = [...profiles].sort((a,b) => b.new_pairings - a.new_pairings);
  const byAppear    = [...profiles].sort((a,b) => b.appearances - a.appearances);

  const champions = [
    {
      title:"👑 XP Champion",
      subtitle:"Highest total XP across all sessions",
      color:"text-yellow-300", bg:"bg-yellow-400/12", border:"border-yellow-400/30",
      glow:"rgba(250,204,21,0.15)",
      top3: byXP.slice(0,3).map(p => ({ name:p.display_name, value:`${p.total_xp.toLocaleString()} XP`, role:p.role })),
    },
    {
      title:"🔥 Streak King",
      subtitle:"Longest consecutive weeks without missing",
      color:"text-orange-300", bg:"bg-orange-500/12", border:"border-orange-500/30",
      glow:"rgba(249,115,22,0.12)",
      top3: byStreak.slice(0,3).map(p => ({ name:p.display_name, value:`${p.longest_streak} weeks`, role:p.role })),
    },
    {
      title:"⭐ Royal Standalone",
      subtitle:"Most times selected as Agatambyi",
      color:"text-yellow-400", bg:"bg-yellow-500/8", border:"border-yellow-500/20",
      glow:"rgba(234,179,8,0.1)",
      top3: byAgatambyi.slice(0,3).map(p => ({ name:p.display_name, value:`×${p.agatambyi_count}`, role:p.role })),
    },
    {
      title:"✨ Social Butterfly",
      subtitle:"Most unique pairing partners ever",
      color:"text-green-300", bg:"bg-green-500/10", border:"border-green-500/20",
      glow:"rgba(34,197,94,0.1)",
      top3: byPairings.slice(0,3).map(p => ({ name:p.display_name, value:`${p.new_pairings} new pairs`, role:p.role })),
    },
    {
      title:"🎖️ Most Loyal",
      subtitle:"Most total appearances across all sessions",
      color:"text-blue-300", bg:"bg-blue-500/10", border:"border-blue-500/20",
      glow:"rgba(59,130,246,0.1)",
      top3: byAppear.slice(0,3).map(p => ({ name:p.display_name, value:`${p.appearances} weeks`, role:p.role })),
    },
  ];

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-green-400"/>
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Champions</span>
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">Hall of </span>
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Champions</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Record holders across all categories.</p>
        </motion.div>

        {profiles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🛡️</div>
            <p className="text-white/30 text-sm font-mono">No champions yet. Complete sessions to populate records.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {champions.map((cat, ci) => (
              <motion.div key={cat.title} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:ci*0.08 }}
                className={`rounded-3xl border p-5 ${cat.bg} ${cat.border}`}
                style={{ boxShadow:`0 0 30px ${cat.glow}` }}>
                <p className={`font-black text-base mb-0.5 ${cat.color}`}>{cat.title}</p>
                <p className="text-[10px] text-white/30 font-mono mb-4">{cat.subtitle}</p>

                {cat.top3.length === 0 ? (
                  <p className="text-white/20 text-xs font-mono">No data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {cat.top3.map((p, pi) => (
                      <div key={p.name} className="flex items-center gap-3">
                        {/* Medal */}
                        <span className="text-lg w-7 text-center shrink-0">
                          {pi===0?"🥇":pi===1?"🥈":"🥉"}
                        </span>
                        {/* Role icon */}
                        <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-sm shrink-0">
                          {p.role==="king"?"⚔️":"👑"}
                        </div>
                        {/* Name */}
                        <span className={`font-bold text-sm truncate flex-1 ${pi===0?cat.color:"text-white/70"}`}>
                          {p.name}
                        </span>
                        {/* Value */}
                        <span className={`font-black text-sm font-mono shrink-0 ${pi===0?cat.color:"text-white/40"}`}>
                          {p.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}