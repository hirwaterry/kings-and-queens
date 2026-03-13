"use client";
// components/GameLayout.tsx

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Crown, Sword, Users, Zap, Trophy, Star,
  ChevronRight, Menu, X, Flame, Shield,
  Dices, Radio, Gift, ChevronLeft, Target,
  Settings, LogOut, UserCircle, Edit3,
  Brain,
} from "lucide-react";
import { supabase, getRankTier, type DBPlayerProfile } from "@/lib/supabase";
import { isAdminAuthed, adminLogout } from "@/hooks/useAdmin";

// ── DiceBear avatar URL ───────────────────────────────────────────────────────
export function avatarUrl(seed: string, style = "adventurer"): string {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0f0f12&radius=12`;
}

// ── Nav sections ──────────────────────────────────────────────────────────────
const PLAYER_NAV = [
  {
    label: "GAMES",
    items: [
      { href:"/game/live",      icon:Radio,   label:"Live Pair",        badge:"LIVE",  badgeColor:"bg-red-500 text-white",          glow:"#ef4444" },
      { href:"/game/challenge", icon:Target,  label:"Weekly Challenge", badge:null,    badgeColor:"",                                glow:"#8b5cf6" },
      { href:"/game/quiz",      icon:Brain,   label:"Quiz",             badge:"NEW",    badgeColor:"bg-[#34d399] text-black",        glow:"#facc15" },
      { href:"/game/spin",      icon:Dices,   label:"Royal Spin",       badge:"SOON",  badgeColor:"bg-white/10 text-white/35",      glow:"#facc15" },
      { href:"/game/battle",    icon:Flame,   label:"War Mode",         badge:"SOON",  badgeColor:"bg-white/10 text-white/35",      glow:"#f97316" },

    ],
  },
  {
    label: "COMPETE",
    items: [
      { href:"/game/leaderboard", icon:Trophy,  label:"Leaderboard", badge:null, badgeColor:"", glow:"#a78bfa" },
      { href:"/game/pairs",       icon:Users,   label:"All Pairs",   badge:null, badgeColor:"", glow:"#60a5fa" },
      { href:"/game/champions",   icon:Shield,  label:"Champions",   badge:null, badgeColor:"", glow:"#34d399" },
    ],
  },
  {
    label: "EARN",
    items: [
      { href:"/game/rewards", icon:Gift, label:"Rewards",     badge:null, badgeColor:"", glow:"#f43f5e" },
      { href:"/game/xp",      icon:Zap,  label:"XP & Ranks",  badge:null, badgeColor:"", glow:"#facc15" },
      { href:"/game/weekly",  icon:Star, label:"Weekly Best", badge:null, badgeColor:"", glow:"#c084fc" },
    ],
  },
];

const ADMIN_NAV = [
  {
    label: "ADMIN",
    items: [
      { href:"/game/admin",            icon:Sword,    label:"Add List",   badge:null, badgeColor:"", glow:"#f59e0b" },
      { href:"/game/admin/edit", icon:Edit3,    label:"Edit Pairs", badge:null, badgeColor:"", glow:"#f97316" },
      { href:"/game/admin/sessions",   icon:Settings, label:"Sessions",   badge:null, badgeColor:"", glow:"#94a3b8" },
      { href:"/game/admin/door",       icon:Gift,     label:"Secret",    badge:"Premium", badgeColor:"bg-green-500", glow:"#f43f5e" },
      { href:"/game/admin/live", icon:Crown, label:"Host Session", badge:null, badgeColor:"", glow:"#ef4444" },
    ],
  },
];

// ── Compact NavItem ───────────────────────────────────────────────────────────
const NavItem = ({
  item, collapsed, active,
}: {
  item: { href:string; icon:any; label:string; badge:string|null; badgeColor:string; glow:string };
  collapsed: boolean;
  active: boolean;
}) => {
  const Icon = item.icon;
  const isSoon = item.badge === "SOON";

  return (
    <Link href={isSoon ? "#" : item.href} onClick={e => isSoon && e.preventDefault()}>
      <motion.div
        whileHover={{ x: collapsed || isSoon ? 0 : 2 }}
        whileTap={{ scale: isSoon ? 1 : 0.97 }}
        className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer
                    transition-all duration-150 group
                    ${isSoon ? "opacity-40 cursor-not-allowed" : ""}
                    ${active
                      ? "bg-white/10 border border-white/12"
                      : "hover:bg-white/5 border border-transparent"}`}
        style={active ? { boxShadow: `0 0 16px ${item.glow}1a` } : {}}
      >
        {/* Active bar */}
        {active && (
          <motion.div layoutId="activeBar"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
            style={{ background: item.glow }} />
        )}

        {/* Icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all
                         ${active ? "bg-white/10" : "bg-white/5 group-hover:bg-white/8"}`}
          style={active ? { boxShadow: `0 0 10px ${item.glow}40` } : {}}>
          <Icon className="w-3.5 h-3.5 transition-colors"
            style={{ color: active ? item.glow : "rgba(255,255,255,0.4)" }} />
        </div>

        {/* Label + badge */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:"auto" }}
              exit={{ opacity:0, width:0 }} transition={{ duration:0.18 }}
              className="flex items-center justify-between flex-1 overflow-hidden min-w-0"
            >
              <span className={`text-[12px] font-semibold whitespace-nowrap transition-colors
                                ${active ? "text-white" : "text-white/45 group-hover:text-white/75"}`}>
                {item.label}
              </span>
              {item.badge && (
                <span className={`text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded-md ml-1.5 shrink-0
                                  ${item.badgeColor || "bg-white/10 text-white/40"}`}>
                  {item.badge}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed dot */}
        {collapsed && item.badge && !["SOON","NEW"].includes(item.badge) && (
          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
        )}
      </motion.div>
    </Link>
  );
};

// ── Sidebar content ───────────────────────────────────────────────────────────
const Sidebar = ({
  collapsed, setCollapsed, mobileOpen, setMobileOpen, profile, isAdmin,
}: {
  collapsed: boolean; setCollapsed:(v:boolean)=>void;
  mobileOpen: boolean; setMobileOpen:(v:boolean)=>void;
  profile: DBPlayerProfile | null; isAdmin: boolean;
}) => {
  const router   = useRouter();
  const pathname = usePathname();
  const rank     = profile ? getRankTier(profile.total_xp) : null;

  // Read localStorage only on client — avoids SSR crash
  const [seed,        setSeed       ] = useState("guest");
  const [avatarStyle, setAvatarStyle] = useState("adventurer");
  useEffect(() => {
    setSeed(profile?.display_name ?? localStorage.getItem("fow_my_name") ?? "guest");
    setAvatarStyle(localStorage.getItem("fow_avatar_style") ?? "adventurer");
  }, [profile]);

  const allSections = isAdmin ? [...PLAYER_NAV, ...ADMIN_NAV] : PLAYER_NAV;

  const content = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo — compact */}
      <div className={`flex items-center gap-2.5 px-3 pt-4 pb-3 shrink-0 ${collapsed?"justify-center":""}`}>
        <motion.div animate={{ rotate:[0,8,-8,0] }} transition={{ duration:4, repeat:Infinity }}
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-700
                     flex items-center justify-center shrink-0 shadow-lg shadow-red-500/25">
          <Crown className="w-4 h-4 text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
              <p className="text-white font-black text-[11px] tracking-wide leading-none">Friend of</p>
              <p className="text-red-400 font-black text-[11px] tracking-wide leading-none mt-0.5">a Week</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-3 h-px bg-white/8 mb-2 shrink-0" />

      {/* Nav — scrollable, compact spacing */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 scrollbar-none"
        style={{ scrollbarWidth:"none" }}>
        <div className="flex flex-col gap-3 py-1">
          {allSections.map((section) => (
            <div key={section.label}>
              <AnimatePresence>
                {!collapsed && (
                  <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    className="text-[8px] font-black tracking-[0.2em] text-white/20 px-2.5 mb-1 uppercase">
                    {section.label}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.href} item={item} collapsed={collapsed}
                    active={pathname === item.href} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-3 h-px bg-white/8 mt-1 shrink-0" />

      {/* Player card — compact */}
      <div className="shrink-0 px-2 pb-3 pt-2">
        {collapsed ? (
          <Link href="/game/profile">
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/8 border border-white/15">
                <img src={avatarUrl(seed, avatarStyle)} alt="avatar" className="w-full h-full"/>
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/game/profile">
            <motion.div whileHover={{ x:2 }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/5 border border-white/8
                         hover:bg-white/8 hover:border-white/12 transition-all cursor-pointer">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/8 border border-white/15 shrink-0">
                <img src={avatarUrl(seed, avatarStyle)} alt="avatar" className="w-full h-full object-cover"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-bold truncate">
                  {profile?.display_name ?? seed ?? "Guest"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Zap className="w-2.5 h-2.5 text-yellow-400" />
                  <span className="text-[9px] text-yellow-400 font-mono">
                    {(profile?.total_xp ?? 0).toLocaleString()}
                  </span>
                  {rank && <span className="text-[8px] text-white/20 font-mono">· {rank.icon}</span>}
                </div>
              </div>
              <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
            </motion.div>
          </Link>
        )}

        {/* Admin badge + logout */}
        {isAdmin && !collapsed && (
          <div className="flex items-center justify-between mt-1.5 px-2.5">
            <span className="text-[8px] text-red-400/70 font-mono">ADMIN MODE</span>
            <button onClick={() => { adminLogout(); router.push("/game/admin/login"); }}
              className="text-[8px] text-white/20 hover:text-red-400 font-mono transition-colors flex items-center gap-0.5">
              <LogOut className="w-2.5 h-2.5"/> logout
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <motion.aside animate={{ width: collapsed ? 56 : 210 }}
        transition={{ type:"spring", stiffness:320, damping:32 }}
        className="hidden md:flex flex-col relative h-screen border-r border-white/8 shrink-0"
        style={{ background:"linear-gradient(180deg, #131318 0%, #0d0d10 100%)" }}>
        <motion.button whileTap={{ scale:0.9 }} onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-14 z-10 w-6 h-6 rounded-full bg-[#1a1a22] border border-white/15
                     flex items-center justify-center shadow-lg hover:border-white/30 transition-colors">
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }}>
            <ChevronLeft className="w-3 h-3 text-white/60" />
          </motion.div>
        </motion.button>
        {content}
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />
            <motion.aside initial={{ x:-220 }} animate={{ x:0 }} exit={{ x:-220 }}
              transition={{ type:"spring", stiffness:320, damping:32 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[210px] md:hidden"
              style={{ background:"linear-gradient(180deg, #131318 0%, #0d0d10 100%)" }}>
              <button onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/8
                           flex items-center justify-center hover:bg-white/15 transition-colors">
                <X className="w-4 h-4 text-white/60" />
              </button>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ── Top bar ───────────────────────────────────────────────────────────────────
const TopBar = ({ onMenuClick, profile }: { onMenuClick:()=>void; profile:DBPlayerProfile|null }) => {
  const pathname = usePathname();
  const allItems = [...PLAYER_NAV, ...ADMIN_NAV].flatMap(s => s.items);
  const pageName = allItems.find(i => i.href === pathname)?.label ?? "Dashboard";

  // Read localStorage only on client
  const [seed,        setSeed       ] = useState("guest");
  const [avatarStyle, setAvatarStyle] = useState("adventurer");
  useEffect(() => {
    setSeed(profile?.display_name ?? localStorage.getItem("fow_my_name") ?? "guest");
    setAvatarStyle(localStorage.getItem("fow_avatar_style") ?? "adventurer");
  }, [profile]);

  return (
    <header className="h-12 backdrop-blur-md border-b border-white/8 flex items-center px-4 gap-3
                       shrink-0 sticky top-0 z-30"
      style={{ background:"linear-gradient(90deg,#131318 0%,#0f0f13 100%)" }}>
      <button onClick={onMenuClick}
        className="md:hidden w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center
                   hover:bg-white/15 transition-colors">
        <Menu className="w-3.5 h-3.5 text-white/60" />
      </button>

      <div className="flex items-center gap-1.5">
        <span className="text-white/25 text-xs hidden sm:block">FOW</span>
        <span className="text-white/15 hidden sm:block">/</span>
        <span className="text-white text-xs font-semibold">{pageName}</span>
      </div>

      <div className="flex-1" />

      {/* Live dot */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
        <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.5, repeat:Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="text-[10px] text-red-400 font-mono font-bold">LIVE</span>
      </div>

      {/* XP */}
      <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20">
        <Zap className="w-2.5 h-2.5 text-yellow-400" />
        <span className="text-[10px] text-yellow-400 font-mono font-bold">
          {(profile?.total_xp ?? 0).toLocaleString()}
        </span>
      </div>

      {/* Avatar */}
      <Link href="/game/profile">
        <div className="w-7 h-7 rounded-full overflow-hidden cursor-pointer
                        ring-2 ring-yellow-400/25 hover:ring-yellow-400/50 transition-all">
          <img src={avatarUrl(seed, avatarStyle)} alt="avatar" className="w-full h-full object-cover"/>
        </div>
      </Link>
    </header>
  );
};

// ── Layout wrapper ────────────────────────────────────────────────────────────
export const GameLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed,  setCollapsed ] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile,    setProfile   ] = useState<DBPlayerProfile | null>(null);
  const [isAdmin,    setIsAdmin   ] = useState(false);

  useEffect(() => {
    setIsAdmin(isAdminAuthed());

    const name = localStorage.getItem("fow_my_name");
    if (!name) return;
    supabase.from("player_profiles").select("*").eq("name", name.toLowerCase()).maybeSingle()
      .then(({ data }) => { if (data) setProfile(data); });

    const ch = supabase.channel("layout-profile")
      .on("postgres_changes", {
        event:"UPDATE", schema:"public", table:"player_profiles",
        filter:`name=eq.${name.toLowerCase()}`,
      }, ({ new: u }) => setProfile(u as DBPlayerProfile))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="flex h-screen bg-[#0d0d10] overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}
        mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
        profile={profile} isAdmin={isAdmin} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} profile={profile} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="fixed inset-0 pointer-events-none -z-0">
            <div className="absolute top-0 left-1/3 w-96 h-96 bg-red-900/12 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-yellow-900/8 rounded-full blur-[100px]" />
          </div>
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default GameLayout;