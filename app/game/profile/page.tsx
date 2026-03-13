"use client";
// app/profile/page.tsx

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Zap, Flame, Star, Shield, Edit2,
  Check, ChevronRight, LogOut, Users, RefreshCw,
} from "lucide-react";
import { supabase, getRankTier, type DBPlayerProfile, type Role } from "@/lib/supabase";
import { saveMyName, clearMyName } from "@/hooks/useProfile";

// ── DiceBear avatar ───────────────────────────────────────────────────────────
const AVATAR_STYLES = [
  { id:"adventurer",      label:"Explorer"    },
  { id:"adventurer-neutral", label:"Neutral"  },
  { id:"avataaars",       label:"Classic"     },
  { id:"bottts",          label:"Robot"       },
  { id:"croodles",        label:"Sketch"      },
  { id:"fun-emoji",       label:"Fun"         },
  { id:"lorelei",         label:"Lorelei"     },
  { id:"micah",           label:"Micah"       },
  { id:"miniavs",         label:"Mini"        },
  { id:"personas",        label:"Persona"     },
  { id:"pixel-art",       label:"Pixel"       },
  { id:"thumbs",          label:"Thumbs"      },
];

function avatarUrl(seed: string, style: string) {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0f0f12&radius=12`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
const Stat = ({ icon, value, label, color }: {
  icon: React.ReactNode; value: string|number; label: string; color: string;
}) => (
  <div className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
    {icon}
    <span className={`text-xl font-black ${color}`}>{value}</span>
    <span className="text-[9px] text-white/25 font-mono uppercase text-center leading-tight">{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();

  const [screen,       setScreen      ] = useState<"loading"|"setup"|"profile">("loading");
  const [profile,      setProfile     ] = useState<DBPlayerProfile | null>(null);
  const [storedName,   setStoredName  ] = useState("");
  const [avatarStyle,  setAvatarStyle ] = useState("adventurer");
  const [editingName,  setEditingName ] = useState(false);
  const [editingAvatar,setEditingAvatar] = useState(false);
  const [nameInput,    setNameInput   ] = useState("");
  const [roleInput,    setRoleInput   ] = useState<Role>("king");
  const [saving,       setSaving      ] = useState(false);
  const [error,        setError       ] = useState("");

  // Load stored prefs
  useEffect(() => {
    const name  = localStorage.getItem("fow_my_name") ?? "";
    const style = localStorage.getItem("fow_avatar_style") ?? "adventurer";
    setAvatarStyle(style);
    if (!name.trim()) { setScreen("setup"); return; }
    setStoredName(name.trim());
    setNameInput(name.trim());
    fetchProfile(name.trim());
  }, []);

  // Realtime
  useEffect(() => {
    if (!storedName) return;
    const ch = supabase.channel(`profile:${storedName.toLowerCase()}`)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"player_profiles",
        filter:`name=eq.${storedName.toLowerCase()}` },
        ({ new: u }) => setProfile(u as DBPlayerProfile))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storedName]);

  const fetchProfile = async (name: string) => {
    const { data } = await supabase.from("player_profiles").select("*")
      .eq("name", name.toLowerCase()).maybeSingle();
    setProfile(data ?? null);
    setScreen("profile");
  };

  // ── Setup submit ─────────────────────────────────────────────────────────────
  const handleSetup = async () => {
    const t = nameInput.trim();
    if (!t || t.length < 2) { setError("Name must be at least 2 characters."); return; }
    if (t.length > 30)       { setError("Name too long (max 30 chars)."); return; }
    setSaving(true); setError("");
    saveMyName(t);
    localStorage.setItem("fow_avatar_style", avatarStyle);
    setStoredName(t);
    await fetchProfile(t);
    setSaving(false);
  };

  // ── Save name edit ────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    const t = nameInput.trim();
    if (!t || t === storedName) { setEditingName(false); return; }
    setSaving(true);
    saveMyName(t);
    setStoredName(t);
    if (profile) {
      await supabase.from("player_profiles")
        .update({ display_name: t, updated_at: new Date().toISOString() })
        .eq("name", profile.name);
      setProfile({ ...profile, display_name: t });
    }
    setSaving(false);
    setEditingName(false);
  };

  // ── Save avatar style ─────────────────────────────────────────────────────────
  const handleSaveAvatar = (style: string) => {
    setAvatarStyle(style);
    localStorage.setItem("fow_avatar_style", style);
    setEditingAvatar(false);
  };

  const handleSignOut = () => {
    clearMyName();
    setProfile(null); setStoredName(""); setNameInput(""); setScreen("setup");
  };

  // ─── LOADING ──────────────────────────────────────────────────────────────────
  if (screen === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }}
        className="text-4xl">👑</motion.div>
    </div>
  );

  // ─── SETUP ───────────────────────────────────────────────────────────────────
  if (screen === "setup") return (
    <div className="min-h-screen text-white flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-red-900/20 rounded-full blur-[120px]"/>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-yellow-900/15 rounded-full blur-[100px]"/>
      </div>

      <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
        transition={{ type:"spring" }} className="relative z-10 w-full max-w-sm">

        {/* Big avatar preview */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <motion.div animate={{ rotate:[0,8,-8,0] }} transition={{ duration:3, repeat:Infinity }}
            className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/15
                       shadow-2xl shadow-red-500/20 bg-white/5">
            <img src={avatarUrl(nameInput || "guest", avatarStyle)} alt="preview"
              className="w-full h-full object-cover"/>
          </motion.div>
          <p className="text-white/30 text-xs font-mono">Your avatar preview</p>
        </div>

        <h1 className="text-3xl font-black text-center mb-1">
          <span className="text-white">Enter the </span>
          <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Realm</span>
        </h1>
        <p className="text-white/35 text-sm text-center mb-8">No account needed. Just your name.</p>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">Your Name</label>
            <input type="text" value={nameInput} onChange={e=>{setNameInput(e.target.value);setError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleSetup()} placeholder="e.g. Mugisha, Uwera..."
              maxLength={30} autoFocus
              className="w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-3.5 text-white
                         placeholder-white/20 text-base focus:outline-none focus:border-red-500/60 transition-all"/>
            {error && <p className="text-red-400 text-xs font-mono mt-1.5">{error}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">Role</label>
            <div className="flex gap-3">
              {(["king","queen"] as Role[]).map(r=>(
                <motion.button key={r} whileTap={{ scale:0.96 }} onClick={()=>setRoleInput(r)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 transition-all
                              ${roleInput===r
                                ? r==="king" ? "border-yellow-400 bg-yellow-400/12" : "border-rose-400 bg-rose-400/12"
                                : "border-white/10 bg-white/5"}`}>
                  <span className="text-3xl">{r==="king"?"⚔️":"👑"}</span>
                  <span className={`font-black text-sm capitalize ${roleInput===r ? r==="king"?"text-yellow-300":"text-rose-300" : "text-white/40"}`}>{r}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Avatar style quick pick */}
          <div>
            <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">Avatar Style</label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_STYLES.slice(0, 8).map(s=>(
                <motion.button key={s.id} whileTap={{ scale:0.9 }} onClick={()=>setAvatarStyle(s.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                              ${avatarStyle===s.id?"border-red-400/60 bg-red-400/10":"border-white/8 bg-white/4 hover:border-white/20"}`}>
                  <img src={avatarUrl(nameInput||"preview", s.id)} alt={s.label}
                    className="w-10 h-10 rounded-lg"/>
                  <span className="text-[8px] text-white/35 font-mono">{s.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={handleSetup} disabled={saving||!nameInput.trim()}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl
                       font-black text-base flex items-center justify-center gap-2
                       disabled:opacity-50 shadow-xl shadow-red-500/25">
            {saving ? <><RefreshCw className="w-5 h-5 animate-spin"/>Entering...</> : <><Crown className="w-5 h-5"/>Enter the Realm</>}
          </motion.button>
        </div>

        <p className="text-center text-white/15 text-[10px] font-mono mt-5">
          Already joined a session? Use the same name you used there.
        </p>
      </motion.div>
    </div>
  );

  // ─── PROFILE ─────────────────────────────────────────────────────────────────
  const rank     = profile ? getRankTier(profile.total_xp) : null;
  const progress = profile && rank && rank.nextXP !== Infinity
    ? Math.min(100, Math.round(((profile.total_xp-rank.minXP)/(rank.nextXP-rank.minXP))*100)) : 100;

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* ── Hero card ── */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }}
          className="mb-5 p-5 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden">

          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background:`radial-gradient(ellipse at 20% 0%,rgba(250,204,21,0.05) 0%,transparent 65%)` }}/>

          <div className="relative z-10 flex items-start gap-4 mb-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <motion.div
                animate={rank?.tier==="champion"
                  ? { boxShadow:["0 0 10px rgba(250,204,21,0.3)","0 0 30px rgba(250,204,21,0.6)","0 0 10px rgba(250,204,21,0.3)"] }
                  : {}}
                transition={{ duration:2, repeat:Infinity }}
                className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/12 bg-white/5"
              >
                <img src={avatarUrl(storedName, avatarStyle)} alt="avatar"
                  className="w-full h-full object-cover"/>
              </motion.div>
              <motion.button whileTap={{ scale:0.85 }} onClick={() => setEditingAvatar(true)}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#1a1a22] border border-white/20
                           flex items-center justify-center hover:bg-white/15 transition-colors">
                <Edit2 className="w-3 h-3 text-white/60"/>
              </motion.button>
            </div>

            {/* Name + rank */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {editingName ? (
                  <motion.div key="edit" initial={{ opacity:0 }} animate={{ opacity:1 }}
                    className="flex items-center gap-2 mb-1">
                    <input type="text" value={nameInput} onChange={e=>setNameInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")handleSaveName();if(e.key==="Escape")setEditingName(false);}}
                      autoFocus maxLength={30}
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5
                                 text-white text-sm font-bold focus:outline-none focus:border-yellow-400/50"/>
                    <motion.button whileTap={{ scale:0.9 }} onClick={handleSaveName}
                      className="w-7 h-7 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-green-400"/>
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div key="show" initial={{ opacity:0 }} animate={{ opacity:1 }}
                    className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-black text-white truncate">{storedName}</h2>
                    <motion.button whileTap={{ scale:0.85 }}
                      onClick={() => { setEditingName(true); setNameInput(storedName); }}
                      className="w-6 h-6 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
                      <Edit2 className="w-3 h-3 text-white/35"/>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 flex-wrap">
                {profile ? (
                  <span className={`text-xs font-semibold capitalize flex items-center gap-1
                                    ${profile.role==="king"?"text-yellow-300":"text-rose-300"}`}>
                    {profile.role==="king"?"⚔️":"👑"} {profile.role}
                  </span>
                ) : null}
                {rank && (
                  <span className="text-xs text-white/30 font-mono">{rank.icon} {rank.label}</span>
                )}
              </div>

              {/* XP bar inline */}
              {profile && rank && (
                <div className="mt-2">
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div initial={{ width:0 }} animate={{ width:`${progress}%` }}
                      transition={{ duration:1, ease:"easeOut", delay:0.3 }}
                      className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-300"/>
                  </div>
                  {rank.nextXP !== Infinity && (
                    <p className="text-[9px] text-white/20 font-mono mt-1">
                      {profile.total_xp.toLocaleString()} / {rank.nextXP.toLocaleString()} XP
                      · {(rank.nextXP - profile.total_xp).toLocaleString()} to {getRankTier(rank.nextXP).label}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          {profile ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Zap className="w-3.5 h-3.5 text-yellow-400"/>} value={profile.total_xp >= 1000 ? `${(profile.total_xp/1000).toFixed(1)}k` : profile.total_xp} label="Total XP" color="text-yellow-300"/>
              <Stat icon={<Flame className="w-3.5 h-3.5 text-orange-400"/>} value={`${profile.current_streak}wk`} label="Streak" color="text-orange-300"/>
              <Stat icon={<Users className="w-3.5 h-3.5 text-blue-400"/>} value={profile.appearances} label="Sessions" color="text-blue-300"/>
              <Stat icon={<Star className="w-3.5 h-3.5 text-yellow-400"/>} value={`×${profile.agatambyi_count}`} label="Agatambyi" color="text-yellow-300"/>
              <Stat icon={<Shield className="w-3.5 h-3.5 text-green-400"/>} value={profile.new_pairings} label="New Pairs" color="text-green-300"/>
              <Stat icon={<Flame className="w-3.5 h-3.5 text-red-400"/>} value={`${profile.longest_streak}wk`} label="Best Streak" color="text-red-300"/>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-white/30 text-sm font-mono">No sessions yet — join one to start earning XP!</p>
              <motion.button whileTap={{ scale:0.97 }} onClick={() => router.push("/live")}
                className="mt-3 px-5 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold
                           flex items-center gap-1.5 mx-auto">
                <Crown className="w-3.5 h-3.5"/>Go to Live Pair
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* ── Avatar picker modal ── */}
        <AnimatePresence>
          {editingAvatar && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
              onClick={() => setEditingAvatar(false)}>
              <motion.div initial={{ y:300 }} animate={{ y:0 }} exit={{ y:300 }}
                transition={{ type:"spring", damping:30 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-lg bg-[#131318] border border-white/10 rounded-t-3xl p-5 pb-safe">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-black text-white text-base">Choose Your Avatar</p>
                  <p className="text-[10px] text-white/30 font-mono">Tap to select</p>
                </div>
                <div className="grid grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
                  {AVATAR_STYLES.map(s => (
                    <motion.button key={s.id} whileTap={{ scale:0.9 }}
                      onClick={() => handleSaveAvatar(s.id)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all
                                  ${avatarStyle===s.id
                                    ? "border-yellow-400/60 bg-yellow-400/10"
                                    : "border-white/8 bg-white/4 hover:border-white/20"}`}>
                      <img src={avatarUrl(storedName, s.id)} alt={s.label}
                        className="w-14 h-14 rounded-xl"/>
                      <span className="text-[9px] text-white/40 font-mono">{s.label}</span>
                      {avatarStyle===s.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"/>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quick links ── */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}
          className="flex flex-col gap-2 mb-6">
          {[
            { href:"/game/leaderboard", icon:"🏆", label:"Leaderboard",  sub:"See where you rank"          },
            { href:"/game/rewards",     icon:"🎁", label:"My Badges",    sub:"Check earned achievements"   },
            { href:"/game/xp",         icon:"⚡", label:"XP & Ranks",   sub:"How to level up"             },
            { href:"/game/champions",  icon:"🛡️", label:"Champions",    sub:"Hall of fame"                },
          ].map(link => (
            <motion.button key={link.href} whileHover={{ x:3 }} whileTap={{ scale:0.98 }}
              onClick={() => router.push(link.href)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/8
                         hover:bg-white/8 hover:border-white/15 transition-all text-left">
              <span className="text-xl shrink-0">{link.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{link.label}</p>
                <p className="text-white/30 text-[10px] font-mono">{link.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 shrink-0"/>
            </motion.button>
          ))}
        </motion.div>

        {/* ── Sign out ── */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
          <div className="h-px bg-white/8 mb-4"/>
          <button onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/8
                       text-white/30 hover:text-red-400 hover:border-red-500/25 hover:bg-red-500/8
                       text-sm font-semibold transition-all">
            <LogOut className="w-4 h-4"/>Switch identity (clear name)
          </button>
          <p className="text-center text-[9px] text-white/12 font-mono mt-2">
            This only clears your name on this device. Your XP and history stay in the database.
          </p>
        </motion.div>

      </div>
    </div>
  );
}