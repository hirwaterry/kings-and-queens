"use client";
// app/champions/page.tsx — visual showcase of record holders

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Zap, Star, Users } from "lucide-react";
import { supabase, getRankTier, type DBPlayerProfile } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { avatarUrl } from "@/app/game/layout";

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "xp",
    title: "👑 XP Champion",
    subtitle: "Most XP earned across all sessions",
    color: "text-yellow-300",
    borderGlow: "#facc15",
    bg: "from-yellow-900/30 to-yellow-950/10",
    border: "border-yellow-400/25",
    icon: <Zap className="w-4 h-4 text-yellow-400"/>,
    getValue: (p: DBPlayerProfile) => p.total_xp,
    format: (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k XP` : `${v} XP`,
    maxFn: (ps: DBPlayerProfile[]) => Math.max(...ps.map(p => p.total_xp), 1),
  },
  {
    id: "streak",
    title: "🔥 Streak King",
    subtitle: "Longest consecutive weekly streak",
    color: "text-orange-300",
    borderGlow: "#f97316",
    bg: "from-orange-900/30 to-orange-950/10",
    border: "border-orange-400/25",
    icon: <Flame className="w-4 h-4 text-orange-400"/>,
    getValue: (p: DBPlayerProfile) => p.longest_streak,
    format: (v: number) => `${v} weeks`,
    maxFn: (ps: DBPlayerProfile[]) => Math.max(...ps.map(p => p.longest_streak), 1),
  },
  {
    id: "loyal",
    title: "🎖️ Most Loyal",
    subtitle: "Never missed a session",
    color: "text-blue-300",
    borderGlow: "#60a5fa",
    bg: "from-blue-900/30 to-blue-950/10",
    border: "border-blue-400/25",
    icon: <Star className="w-4 h-4 text-blue-400"/>,
    getValue: (p: DBPlayerProfile) => p.appearances,
    format: (v: number) => `${v} sessions`,
    maxFn: (ps: DBPlayerProfile[]) => Math.max(...ps.map(p => p.appearances), 1),
  },
  {
    id: "social",
    title: "✨ Social Butterfly",
    subtitle: "Paired with the most unique people",
    color: "text-green-300",
    borderGlow: "#34d399",
    bg: "from-green-900/30 to-green-950/10",
    border: "border-green-400/25",
    icon: <Users className="w-4 h-4 text-green-400"/>,
    getValue: (p: DBPlayerProfile) => p.new_pairings,
    format: (v: number) => `${v} partners`,
    maxFn: (ps: DBPlayerProfile[]) => Math.max(...ps.map(p => p.new_pairings), 1),
  },
  {
    id: "agatambyi",
    title: "⭐ Royal Standalone",
    subtitle: "Selected as Agatambyi the most times",
    color: "text-amber-300",
    borderGlow: "#f59e0b",
    bg: "from-amber-900/30 to-amber-950/10",
    border: "border-amber-400/25",
    icon: <Star className="w-4 h-4 text-amber-400"/>,
    getValue: (p: DBPlayerProfile) => p.agatambyi_count,
    format: (v: number) => `×${v}`,
    maxFn: (ps: DBPlayerProfile[]) => Math.max(...ps.map(p => p.agatambyi_count), 1),
  },
];

// ── Avatar card ───────────────────────────────────────────────────────────────
const HeroCard = ({
  profile, rank, value, formattedValue, color, borderGlow, isMe, animDelay,
}: {
  profile: DBPlayerProfile;
  rank: number;
  value: number;
  formattedValue: string;
  color: string;
  borderGlow: string;
  isMe: boolean;
  animDelay: number;
}) => {
  const tier  = getRankTier(profile.total_xp);
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const sizes = ["w-16 h-16", "w-14 h-14", "w-12 h-12"];
  const nameSize = rank === 1 ? "text-sm" : "text-xs";
  const avatarStyle = "adventurer";

  return (
    <motion.div
      initial={{ opacity:0, y:20, scale:0.9 }}
      animate={{ opacity:1, y:0, scale:1 }}
      transition={{ delay:animDelay, type:"spring", bounce:0.3 }}
      className={`flex flex-col items-center gap-2 ${rank===1?"order-2":rank===2?"order-1":"order-3"}`}
    >
      {/* Medal */}
      <motion.div
        animate={rank===1 ? { rotate:[0,8,-8,0] } : {}}
        transition={{ duration:3, repeat:Infinity }}
        className="text-xl"
      >{medal}</motion.div>

      {/* Avatar ring */}
      <motion.div
        animate={rank===1 ? {
          boxShadow:[`0 0 15px ${borderGlow}40`,`0 0 40px ${borderGlow}80`,`0 0 15px ${borderGlow}40`]
        } : {}}
        transition={{ duration:2, repeat:Infinity }}
        className={`${sizes[rank-1]} rounded-2xl overflow-hidden border-2 relative
                    ${isMe ? "border-white/50" : ""}`}
        style={{ borderColor: isMe ? "#fff" : `${borderGlow}60` }}
      >
        <img
          src={avatarUrl(profile.display_name, avatarStyle)}
          alt={profile.display_name}
          className="w-full h-full object-cover bg-white/5"
        />
        {/* Role badge */}
        <div className="absolute bottom-0.5 right-0.5 text-[10px] leading-none">
          {profile.role === "king" ? "⚔️" : "👑"}
        </div>
      </motion.div>

      {/* Name */}
      <div className="text-center">
        <p className={`${nameSize} font-black text-white max-w-[70px] truncate`}>
          {profile.display_name}
          {isMe && <span className="block text-[8px] text-white/35 font-mono">(you)</span>}
        </p>
        <p className={`text-[10px] font-black font-mono ${color}`}>{formattedValue}</p>
        <p className="text-[8px] text-white/20 font-mono">{tier.icon} {tier.label}</p>
      </div>

      {/* Podium base */}
      <div
        className={`w-16 sm:w-20 rounded-t-xl border-t border-x
                    ${rank===1?"h-10":rank===2?"h-7":"h-5"}`}
        style={{
          borderColor: `${borderGlow}40`,
          background: `linear-gradient(to top, ${borderGlow}08, ${borderGlow}20)`,
        }}
      >
        <div className="flex items-center justify-center h-full">
          <span className={`font-black text-sm ${color}`}>#{rank}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ── Category section ──────────────────────────────────────────────────────────
const CategorySection = ({
  cat, profiles, myName, index,
}: {
  cat: typeof CATEGORIES[0];
  profiles: DBPlayerProfile[];
  myName: string;
  index: number;
}) => {
  const sorted = [...profiles].sort((a,b) => cat.getValue(b) - cat.getValue(a));
  const top3   = sorted.filter(p => cat.getValue(p) > 0).slice(0, 3);
  const max    = cat.maxFn(profiles);

  if (top3.length === 0) return (
    <div className={`rounded-3xl border p-5 bg-gradient-to-br ${cat.bg} ${cat.border}`}>
      <p className={`font-black text-base ${cat.color}`}>{cat.title}</p>
      <p className="text-white/20 text-xs font-mono mt-1">No data yet. Complete a session!</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-3xl border overflow-hidden bg-gradient-to-br ${cat.bg} ${cat.border}`}
      style={{ boxShadow:`0 0 30px ${cat.borderGlow}0d` }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-0.5">
          {cat.icon}
          <h3 className={`font-black text-base ${cat.color}`}>{cat.title}</h3>
        </div>
        <p className="text-[10px] text-white/30 font-mono">{cat.subtitle}</p>
      </div>

      {/* Podium */}
      {top3.length >= 3 ? (
        <div className="px-4 pb-4">
          <div className="flex items-end justify-center gap-3 sm:gap-5 mb-4">
            {[
              { p:top3[1], r:2 },
              { p:top3[0], r:1 },
              { p:top3[2], r:3 },
            ].map(({ p, r }) => (
              <HeroCard
                key={p.name}
                profile={p}
                rank={r}
                value={cat.getValue(p)}
                formattedValue={cat.format(cat.getValue(p))}
                color={cat.color}
                borderGlow={cat.borderGlow}
                isMe={p.name === myName}
                animDelay={index * 0.08 + (r === 1 ? 0.05 : r === 2 ? 0.1 : 0.15)}
              />
            ))}
          </div>

          {/* 4th & 5th if present */}
          {sorted.slice(3, 5).filter(p => cat.getValue(p) > 0).map((p, i) => (
            <div key={p.name}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl mb-1.5 text-xs
                          ${p.name === myName ? "bg-white/10 border border-white/15" : "bg-white/4"}`}>
              <span className="text-white/25 font-mono w-4">#{i+4}</span>
              <div className="w-6 h-6 rounded-lg overflow-hidden bg-white/8 shrink-0">
                <img src={avatarUrl(p.display_name)} alt={p.display_name} className="w-full h-full object-cover"/>
              </div>
              <span className="font-semibold text-white/70 flex-1 truncate">{p.display_name}</span>
              <span className={`font-black font-mono ${cat.color}`}>{cat.format(cat.getValue(p))}</span>
            </div>
          ))}
        </div>
      ) : (
        /* Fewer than 3 — list view */
        <div className="px-5 pb-5 flex flex-col gap-2">
          {top3.map((p, i) => (
            <div key={p.name}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl
                          ${p.name===myName?"bg-white/10 border border-white/15":"bg-white/5"}`}>
              <span className="text-lg">{i===0?"🥇":i===1?"🥈":"🥉"}</span>
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/8 shrink-0">
                <img src={avatarUrl(p.display_name)} alt={p.display_name} className="w-full h-full object-cover"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white truncate">{p.display_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* XP bar */}
                  <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width:0 }}
                      animate={{ width:`${(cat.getValue(p)/max)*100}%` }}
                      transition={{ duration:0.9, delay:index*0.1, ease:"easeOut" }}
                      className="h-full rounded-full"
                      style={{ background:`linear-gradient(90deg,${cat.borderGlow}80,${cat.borderGlow})` }}
                    />
                  </div>
                  <span className={`text-[10px] font-black font-mono shrink-0 ${cat.color}`}>
                    {cat.format(cat.getValue(p))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChampionsPage() {
  const router = useRouter();
  const { loading: profileLoading, needsSetup, myName } = useProfile();
  const [profiles, setProfiles] = useState<DBPlayerProfile[]>([]);
  const [loading,  setLoading ] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    if (!profileLoading && needsSetup) router.push("/profile");
  }, [profileLoading, needsSetup, router]);

  useEffect(() => {
    supabase.from("player_profiles").select("*")
      .then(({ data }) => { setProfiles(data ?? []); setLoading(false); });
  }, []);

  if (loading || profileLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }}
        className="text-3xl">🏆</motion.div>
    </div>
  );

  // My personal bests
  const me = profiles.find(p => p.name === myName);

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="mb-6">
          <h1 className="text-3xl font-black">
            <span className="text-white">Hall of </span>
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
              Champions
            </span>
          </h1>
          <p className="text-white/30 text-sm mt-1">The realm's greatest heroes, ranked by legend.</p>
        </motion.div>

        {/* My highlights if I have a profile */}
        {me && (
          <motion.div initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }}
            transition={{ delay:0.05 }}
            className="mb-6 p-4 rounded-2xl border border-white/10 bg-white/5">
            <p className="text-[9px] text-white/25 font-mono uppercase tracking-widest mb-3">Your Personal Bests</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label:"Total XP",    val:me.total_xp >= 1000 ? `${(me.total_xp/1000).toFixed(1)}k` : me.total_xp, icon:"⚡" },
                { label:"Streak",      val:`${me.longest_streak}wk`,   icon:"🔥" },
                { label:"Partners",    val:me.new_pairings,             icon:"✨" },
                { label:"Agatambyi",  val:`×${me.agatambyi_count}`,   icon:"⭐" },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center gap-1 py-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-white font-black text-sm">{s.val}</span>
                  <span className="text-[8px] text-white/25 font-mono uppercase text-center">{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Category filter pills */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none"
          style={{ scrollbarWidth:"none" }}>
          <motion.button whileTap={{ scale:0.95 }} onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all border
                        ${activeTab==="all"?"bg-white/15 text-white border-white/20":"bg-white/5 text-white/40 border-white/8"}`}>
            All
          </motion.button>
          {CATEGORIES.map(cat => (
            <motion.button key={cat.id} whileTap={{ scale:0.95 }} onClick={() => setActiveTab(cat.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all border whitespace-nowrap
                          ${activeTab===cat.id
                            ? `bg-white/15 text-white border-white/20`
                            : "bg-white/5 text-white/40 border-white/8"}`}>
              {cat.title.split(" ").slice(0,2).join(" ")}
            </motion.button>
          ))}
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-white/30 text-sm font-mono">No champions yet.</p>
            <p className="text-white/20 text-xs font-mono mt-1">Complete a session to create legends.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <AnimatePresence mode="popLayout">
              {CATEGORIES
                .filter(cat => activeTab === "all" || cat.id === activeTab)
                .map((cat, i) => (
                  <CategorySection
                    key={cat.id}
                    cat={cat}
                    profiles={profiles}
                    myName={myName}
                    index={i}
                  />
                ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}