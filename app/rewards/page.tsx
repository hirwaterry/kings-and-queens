"use client";
// app/rewards/page.tsx — achievement badges based on player_profiles stats

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, Lock } from "lucide-react";
import { supabase, type DBPlayerProfile } from "@/lib/supabase";

interface Badge {
  id: string;
  icon: string;
  title: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  check: (p: DBPlayerProfile) => boolean;
}

const BADGES: Badge[] = [
  { id:"first_step",     icon:"👶", title:"First Step",      desc:"Appear in your first session",                   color:"text-white/60",   bg:"bg-white/5",       border:"border-white/10",      check:p => p.appearances >= 1    },
  { id:"regular",        icon:"🎖️", title:"Regular",         desc:"Participate in 3 or more sessions",              color:"text-blue-300",   bg:"bg-blue-500/10",   border:"border-blue-500/20",   check:p => p.appearances >= 3    },
  { id:"veteran_badge",  icon:"⚡", title:"Veteran",         desc:"Participate in 8 sessions",                      color:"text-violet-300", bg:"bg-violet-500/10", border:"border-violet-500/20", check:p => p.appearances >= 8    },
  { id:"on_fire",        icon:"🔥", title:"On Fire",         desc:"Maintain a 3-week streak",                       color:"text-orange-300", bg:"bg-orange-500/10", border:"border-orange-500/20", check:p => p.longest_streak >= 3 },
  { id:"unstoppable",    icon:"💥", title:"Unstoppable",     desc:"Maintain a 5-week streak",                       color:"text-red-300",    bg:"bg-red-500/10",    border:"border-red-500/20",    check:p => p.longest_streak >= 5 },
  { id:"social",         icon:"✨", title:"Social Butterfly", desc:"Pair with 5 unique people",                     color:"text-green-300",  bg:"bg-green-500/10",  border:"border-green-500/20",  check:p => p.new_pairings >= 5   },
  { id:"networker",      icon:"🌐", title:"Networker",        desc:"Pair with 10 unique people",                    color:"text-teal-300",   bg:"bg-teal-500/10",   border:"border-teal-500/20",   check:p => p.new_pairings >= 10  },
  { id:"agatambyi_once", icon:"⭐", title:"Royal Standalone", desc:"Be selected as Agatambyi",                      color:"text-yellow-300", bg:"bg-yellow-400/12", border:"border-yellow-400/30", check:p => p.agatambyi_count >= 1 },
  { id:"agatambyi_x3",   icon:"🌟", title:"Triple Crown",    desc:"Be Agatambyi 3 times",                           color:"text-yellow-400", bg:"bg-yellow-400/18", border:"border-yellow-400/40", check:p => p.agatambyi_count >= 3 },
  { id:"warrior_rank",   icon:"🗡️", title:"Warrior Rank",    desc:"Reach 150 XP",                                  color:"text-blue-300",   bg:"bg-blue-500/10",   border:"border-blue-500/20",   check:p => p.total_xp >= 150     },
  { id:"elite_rank",     icon:"🛡️", title:"Elite Rank",      desc:"Reach 1,200 XP",                                color:"text-amber-500",  bg:"bg-amber-700/15",  border:"border-amber-700/30",  check:p => p.total_xp >= 1200    },
  { id:"legend_rank",    icon:"⚔️", title:"Legend Rank",     desc:"Reach 2,500 XP",                                color:"text-slate-300",  bg:"bg-slate-400/15",  border:"border-slate-400/30",  check:p => p.total_xp >= 2500    },
  { id:"champion_rank",  icon:"👑", title:"Champion",        desc:"Reach 5,000 XP — the peak",                     color:"text-yellow-300", bg:"bg-yellow-400/20", border:"border-yellow-400/40", check:p => p.total_xp >= 5000    },
  { id:"challenge_xp",   icon:"🎯", title:"Challenger",      desc:"Earn XP from a weekly challenge",               color:"text-violet-300", bg:"bg-violet-500/10", border:"border-violet-500/20", check:p => (p.challenge_xp ?? 0) > 0 },
];

export default function RewardsPage() {
  const [profile,  setProfile ] = useState<DBPlayerProfile | null>(null);
  const [loading,  setLoading ] = useState(true);
  const [myName,   setMyName  ] = useState("");

  useEffect(() => {
    const name = localStorage.getItem("fow_my_name") ?? "";
    setMyName(name);
    if (!name) { setLoading(false); return; }
    supabase.from("player_profiles").select("*").eq("name", name.toLowerCase())
      .maybeSingle().then(({ data }) => { setProfile(data); setLoading(false); });
  }, []);

  const unlocked = profile ? BADGES.filter(b => b.check(profile)) : [];
  const locked   = profile ? BADGES.filter(b => !b.check(profile)) : BADGES;

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-5 h-5 text-red-400"/>
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Rewards</span>
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">Your </span>
            <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Badges</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">
            {myName ? `${unlocked.length} / ${BADGES.length} unlocked` : "Join a session to start earning badges"}
          </p>
        </motion.div>

        {/* No profile yet */}
        {!profile && !loading && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎁</div>
            <p className="text-white/30 text-sm font-mono">No profile found.</p>
            <p className="text-white/20 text-xs font-mono mt-1">
              {myName ? "Play a session first to earn badges." : "Set your name in Live Pair to track progress."}
            </p>
          </div>
        )}

        {/* Unlocked */}
        {unlocked.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-4">
              ✦ Unlocked · {unlocked.length}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {unlocked.map((b, i) => (
                <motion.div key={b.id} initial={{ opacity:0, scale:0.88 }} animate={{ opacity:1, scale:1 }}
                  transition={{ delay:i*0.06, type:"spring", bounce:0.3 }}
                  className={`p-4 rounded-2xl border ${b.bg} ${b.border} flex flex-col gap-2`}
                  style={{ boxShadow:`0 0 15px rgba(0,0,0,0.2)` }}>
                  <span className="text-3xl">{b.icon}</span>
                  <div>
                    <p className={`font-black text-sm ${b.color}`}>{b.title}</p>
                    <p className="text-[10px] text-white/35 leading-tight mt-0.5">{b.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Locked */}
        {locked.length > 0 && profile && (
          <div>
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-4">
              🔒 Locked · {locked.length}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {locked.map((b, i) => (
                <motion.div key={b.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                  transition={{ delay:0.02*i }}
                  className="p-4 rounded-2xl border border-white/6 bg-white/3 flex flex-col gap-2 opacity-50">
                  <div className="relative w-fit">
                    <span className="text-3xl grayscale opacity-50">{b.icon}</span>
                    <Lock className="absolute -bottom-0.5 -right-1.5 w-3 h-3 text-white/40"/>
                  </div>
                  <div>
                    <p className="font-black text-sm text-white/30">{b.title}</p>
                    <p className="text-[10px] text-white/20 leading-tight mt-0.5">{b.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}