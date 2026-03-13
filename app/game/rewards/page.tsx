"use client";
// app/rewards/page.tsx

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gift, Lock, Crown } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import type { DBPlayerProfile } from "@/lib/supabase";

// ── Badge definitions ─────────────────────────────────────────────────────────
interface Badge {
  id: string; icon: string; title: string; desc: string;
  color: string; bg: string; border: string;
  check: (p: DBPlayerProfile) => boolean;
}

const BADGES: Badge[] = [
  { id:"first_step",     icon:"👶", title:"First Step",       desc:"Appear in your first session",              color:"text-white/60",   bg:"bg-white/5",       border:"border-white/10",      check:p=>p.appearances>=1         },
  { id:"regular",        icon:"🎖️", title:"Regular",          desc:"Participate in 3+ sessions",                color:"text-blue-300",   bg:"bg-blue-500/10",   border:"border-blue-500/20",   check:p=>p.appearances>=3         },
  { id:"veteran_badge",  icon:"⚡", title:"Veteran",          desc:"Participate in 8 sessions",                 color:"text-violet-300", bg:"bg-violet-500/10", border:"border-violet-500/20", check:p=>p.appearances>=8         },
  { id:"on_fire",        icon:"🔥", title:"On Fire",          desc:"3-week streak",                             color:"text-orange-300", bg:"bg-orange-500/10", border:"border-orange-500/20", check:p=>p.longest_streak>=3      },
  { id:"unstoppable",    icon:"💥", title:"Unstoppable",      desc:"5-week streak — legendary consistency",     color:"text-red-300",    bg:"bg-red-500/10",    border:"border-red-500/20",    check:p=>p.longest_streak>=5      },
  { id:"social",         icon:"✨", title:"Social Butterfly", desc:"Pair with 5 unique people",                 color:"text-green-300",  bg:"bg-green-500/10",  border:"border-green-500/20",  check:p=>p.new_pairings>=5        },
  { id:"networker",      icon:"🌐", title:"Networker",        desc:"Pair with 10 unique people",                color:"text-teal-300",   bg:"bg-teal-500/10",   border:"border-teal-500/20",   check:p=>p.new_pairings>=10       },
  { id:"agatambyi_once", icon:"⭐", title:"Royal Standalone", desc:"Be selected as Agatambyi once",             color:"text-yellow-300", bg:"bg-yellow-400/12", border:"border-yellow-400/30", check:p=>p.agatambyi_count>=1     },
  { id:"agatambyi_x3",   icon:"🌟", title:"Triple Crown",     desc:"Be Agatambyi 3 times",                      color:"text-yellow-400", bg:"bg-yellow-400/18", border:"border-yellow-400/40", check:p=>p.agatambyi_count>=3     },
  { id:"warrior_rank",   icon:"🗡️", title:"Warrior",          desc:"Reach 150 XP",                              color:"text-blue-300",   bg:"bg-blue-500/10",   border:"border-blue-500/20",   check:p=>p.total_xp>=150          },
  { id:"elite_rank",     icon:"🛡️", title:"Elite",            desc:"Reach 1,200 XP",                            color:"text-amber-500",  bg:"bg-amber-700/15",  border:"border-amber-700/30",  check:p=>p.total_xp>=1200         },
  { id:"legend_rank",    icon:"⚔️", title:"Legend",           desc:"Reach 2,500 XP",                            color:"text-slate-300",  bg:"bg-slate-400/15",  border:"border-slate-400/30",  check:p=>p.total_xp>=2500         },
  { id:"champion_rank",  icon:"👑", title:"Champion",         desc:"Reach 5,000 XP — the absolute peak",        color:"text-yellow-300", bg:"bg-yellow-400/20", border:"border-yellow-400/40", check:p=>p.total_xp>=5000         },
  { id:"challenger",     icon:"🎯", title:"Challenger",       desc:"Earn XP from a weekly challenge",           color:"text-violet-300", bg:"bg-violet-500/10", border:"border-violet-500/20", check:p=>(p.challenge_xp??0)>0    },
  { id:"quiz_master",    icon:"🧠", title:"Quiz Master",      desc:"Earn 200+ XP from challenges",              color:"text-purple-300", bg:"bg-purple-500/10", border:"border-purple-500/20", check:p=>(p.challenge_xp??0)>=200 },
];

// ── Badge card ────────────────────────────────────────────────────────────────
const BadgeCard = ({ badge, unlocked, index }: { badge: Badge; unlocked: boolean; index: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.88 }}
    animate={{ opacity: unlocked ? 1 : 0.45, scale: 1 }}
    transition={{ delay: index * 0.04, type: "spring", bounce: 0.25 }}
    className={`p-4 rounded-2xl border flex flex-col gap-2.5 relative overflow-hidden
                ${unlocked ? `${badge.bg} ${badge.border}` : "bg-white/3 border-white/6"}`}
    style={unlocked ? { boxShadow: "0 4px 20px rgba(0,0,0,0.2)" } : {}}
  >
    {/* Shimmer on unlocked */}
    {unlocked && (
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 3, repeat: Infinity, delay: index * 0.3, ease: "easeInOut" }}
        className="absolute inset-y-0 w-6 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
      />
    )}

    <div className="relative w-fit">
      <span className={`text-3xl ${unlocked ? "" : "grayscale opacity-40"}`}>{badge.icon}</span>
      {!unlocked && (
        <Lock className="absolute -bottom-0.5 -right-1.5 w-3 h-3 text-white/30" />
      )}
    </div>

    <div>
      <p className={`font-black text-sm ${unlocked ? badge.color : "text-white/25"}`}>
        {badge.title}
      </p>
      <p className={`text-[10px] leading-tight mt-0.5 ${unlocked ? "text-white/40" : "text-white/18"}`}>
        {badge.desc}
      </p>
    </div>

    {unlocked && (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.2 + index * 0.04, type: "spring" }}
        className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-green-500/30 border border-green-500/40
                   flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
      </motion.div>
    )}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function RewardsPage() {
  const router = useRouter();
  const { profile, loading, needsSetup, displayName } = useProfile();

  // Redirect to profile setup if no name stored
  useEffect(() => {
    if (!loading && needsSetup) router.push("/profile");
  }, [loading, needsSetup, router]);

  if (loading || needsSetup) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="text-4xl">🎁</motion.div>
    </div>
  );

  // Name is set but no profile yet (hasn't played a session)
  if (!profile) return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center gap-5 px-4">
      <div className="text-5xl">🎁</div>
      <div className="text-center">
        <h2 className="text-xl font-black mb-1">No badges yet, {displayName}!</h2>
        <p className="text-white/40 text-sm">
          Join a Live Pair session to start earning badges and XP.
        </p>
      </div>
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={() => router.push("/live")}
        className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl
                   font-black text-sm flex items-center gap-2 shadow-lg shadow-red-500/20">
        <Crown className="w-4 h-4" /> Join a Session
      </motion.button>
    </div>
  );

  const unlocked = BADGES.filter(b => b.check(profile));
  const locked   = BADGES.filter(b => !b.check(profile));
  const pct      = Math.round((unlocked.length / BADGES.length) * 100);

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-5 h-5 text-red-400" />
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Rewards</span>
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">{displayName}'s </span>
            <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Badges</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">{unlocked.length} / {BADGES.length} unlocked</p>
        </motion.div>

        {/* Progress ring */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-5 rounded-3xl bg-white/5 border border-white/10 flex items-center gap-5">
          {/* Circle progress */}
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <motion.circle cx="32" cy="32" r="26" fill="none"
                stroke="url(#rewardGrad)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - pct / 100) }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              />
              <defs>
                <linearGradient id="rewardGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-black text-sm">{pct}%</span>
            </div>
          </div>

          <div>
            <p className="text-white font-black text-lg">{unlocked.length} badges</p>
            <p className="text-white/30 text-sm">{locked.length} still to unlock</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {unlocked.slice(0, 5).map(b => (
                <span key={b.id} className="text-base">{b.icon}</span>
              ))}
              {unlocked.length > 5 && (
                <span className="text-[10px] text-white/30 font-mono self-center">+{unlocked.length - 5} more</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Unlocked section */}
        {unlocked.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-4">
              ✦ Unlocked · {unlocked.length}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {unlocked.map((b, i) => <BadgeCard key={b.id} badge={b} unlocked index={i} />)}
            </div>
          </div>
        )}

        {/* Locked section */}
        {locked.length > 0 && (
          <div>
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-4">
              🔒 Locked · {locked.length}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {locked.map((b, i) => <BadgeCard key={b.id} badge={b} unlocked={false} index={i} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}