"use client";

// components/GameLayout.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crown, Sword, Users, Zap, Trophy, Star,
  ChevronRight, Menu, X, Flame, Shield,
  Dices, Radio, Gift, ChevronLeft,
  BookOpen, Target, Sparkles,
} from "lucide-react";
import { supabase, getRankTier, type DBPlayerProfile } from "@/lib/supabase";

// ─── Nav Data ──────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: "GAMES",
    items: [
      { href:"/live",      icon:Radio,    label:"Live Pair",        badge:"LIVE", badgeColor:"bg-red-500 text-white animate-pulse",       glow:"#ef4444" },
      { href:"/admin",     icon:Sword,    label:"Add List",         badge:null,   badgeColor:"",                                           glow:"#f59e0b" },
      { href:"/challenge", icon:Target,   label:"Weekly Challenge", badge:"NEW",  badgeColor:"bg-violet-500 text-white",                   glow:"#8b5cf6" },
      { href:"/spin",      icon:Dices,    label:"Royal Spin",       badge:"SOON", badgeColor:"bg-white/10 text-white/40",                  glow:"#facc15" },
      { href:"/battle",    icon:Flame,    label:"War Mode",         badge:"SOON", badgeColor:"bg-white/10 text-white/40",                  glow:"#f97316" },
    ],
  },
  {
    label: "COMPETE",
    items: [
      { href:"/leaderboard", icon:Trophy,   label:"Leaderboard",  badge:null, badgeColor:"", glow:"#a78bfa" },
      { href:"/pairs",       icon:Users,    label:"All Pairs",    badge:null, badgeColor:"", glow:"#60a5fa" },
      { href:"/champions",   icon:Shield,   label:"Champions",    badge:null, badgeColor:"", glow:"#34d399" },
    ],
  },
  {
    label: "EARN",
    items: [
      { href:"/rewards",  icon:Gift,       label:"Rewards",     badge:"3",  badgeColor:"bg-red-500 text-white",  glow:"#f43f5e" },
      { href:"/xp",       icon:Zap,        label:"XP & Ranks",  badge:null, badgeColor:"",                       glow:"#facc15" },
      { href:"/weekly",   icon:Star,       label:"Weekly Best", badge:null, badgeColor:"",                       glow:"#c084fc" },
    ],
  },
];

// ─── Nav Item ──────────────────────────────────────────────────────────────────
const NavItem = ({
  item, collapsed, active,
}: {
  item: (typeof NAV_SECTIONS)[0]["items"][0];
  collapsed: boolean;
  active: boolean;
}) => {
  const Icon = item.icon;
  const isSoon = item.badge === "SOON";

  return (
    <Link href={isSoon ? "#" : item.href} onClick={e => isSoon && e.preventDefault()}>
      <motion.div
        whileHover={{ x: collapsed ? 0 : isSoon ? 0 : 3 }}
        whileTap={{ scale: isSoon ? 1 : 0.97 }}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                    transition-all duration-150 group
                    ${isSoon ? "opacity-50 cursor-not-allowed" : ""}
                    ${active
                      ? "bg-white/10 border border-white/15"
                      : "hover:bg-white/5 border border-transparent"}`}
        style={active ? { boxShadow: `0 0 20px ${item.glow}22` } : {}}
      >
        {/* Active bar */}
        {active && (
          <motion.div layoutId="activeBar"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
            style={{ background: item.glow }} />
        )}

        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all
                      ${active ? "bg-white/10" : "bg-white/5 group-hover:bg-white/8"}`}
          style={active ? { boxShadow: `0 0 12px ${item.glow}44` } : {}}
        >
          <Icon className="w-4 h-4 transition-colors"
            style={{ color: active ? item.glow : "rgba(255,255,255,0.45)" }} />
        </div>

        {/* Label + badge */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:"auto" }}
              exit={{ opacity:0, width:0 }} transition={{ duration:0.2 }}
              className="flex items-center justify-between flex-1 overflow-hidden"
            >
              <span className={`text-sm font-semibold whitespace-nowrap transition-colors
                                ${active ? "text-white" : "text-white/50 group-hover:text-white/80"}`}>
                {item.label}
              </span>
              {item.badge && (
                <span className={`text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-md ml-2 shrink-0
                                  ${item.badgeColor || "bg-white/10 text-white/50"}`}>
                  {item.badge}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed badge dot */}
        {collapsed && item.badge && !["SOON","NEW"].includes(item.badge) && (
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        )}
      </motion.div>
    </Link>
  );
};

// ─── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({
  collapsed, setCollapsed, mobileOpen, setMobileOpen, profile,
}: {
  collapsed: boolean; setCollapsed: (v:boolean)=>void;
  mobileOpen: boolean; setMobileOpen: (v:boolean)=>void;
  profile: DBPlayerProfile | null;
}) => {
  const pathname = usePathname();
  const rank = profile ? getRankTier(profile.total_xp) : null;
  const initials = profile?.display_name?.slice(0,1).toUpperCase() ?? "?";

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className={`flex items-center gap-3 px-3 py-5 shrink-0 ${collapsed?"justify-center":""}`}>
        <motion.div animate={{ rotate:[0,8,-8,0] }} transition={{ duration:4, repeat:Infinity }}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-700
                     flex items-center justify-center shrink-0 shadow-lg shadow-red-500/30">
          <Crown className="w-5 h-5 text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-10 }} transition={{ duration:0.2 }}>
              <p className="text-white font-black text-sm tracking-wide leading-none">Friend of</p>
              <p className="text-red-400 font-black text-sm tracking-wide leading-none">a Week</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3 shrink-0" />

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-5
                      scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  className="text-[9px] font-black tracking-[0.2em] text-white/25 px-3 mb-1.5 uppercase">
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.href} item={item} collapsed={collapsed}
                  active={pathname === item.href} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Player card at bottom */}
      <div className="shrink-0 px-2 pb-4 pt-3">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
        {collapsed ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600
                            flex items-center justify-center text-xs font-black text-gray-900">
              {initials}
            </div>
          </div>
        ) : (
          <Link href="/profile">
            <motion.div whileHover={{ x:2 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8
                         hover:bg-white/8 hover:border-white/15 transition-all cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600
                              flex items-center justify-center text-xs font-black text-gray-900 shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">
                  {profile?.display_name ?? "Guest"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Zap className="w-2.5 h-2.5 text-yellow-400" />
                  <span className="text-[10px] text-yellow-400 font-mono">
                    {(profile?.total_xp ?? 0).toLocaleString()} XP
                  </span>
                  {rank && (
                    <span className="text-[9px] text-white/25 font-mono ml-1">
                      · {rank.icon} {rank.label}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
            </motion.div>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <motion.aside animate={{ width: collapsed ? 64 : 220 }}
        transition={{ type:"spring", stiffness:300, damping:30 }}
        className="hidden md:flex flex-col relative h-screen bg-[#0f0f12] border-r border-white/8 shrink-0"
        style={{ background:"linear-gradient(180deg, #131318 0%, #0d0d10 100%)" }}>
        <motion.button whileTap={{ scale:0.9 }} onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-[#1a1a22] border border-white/15
                     flex items-center justify-center shadow-lg hover:border-white/30 transition-colors">
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }}>
            <ChevronLeft className="w-3 h-3 text-white/60" />
          </motion.div>
        </motion.button>
        {sidebarContent}
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />
            <motion.aside initial={{ x:-260 }} animate={{ x:0 }} exit={{ x:-260 }}
              transition={{ type:"spring", stiffness:300, damping:30 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[220px] md:hidden"
              style={{ background:"linear-gradient(180deg, #131318 0%, #0d0d10 100%)" }}>
              <button onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-white/8
                           flex items-center justify-center hover:bg-white/15 transition-colors">
                <X className="w-4 h-4 text-white/60" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Top Bar ───────────────────────────────────────────────────────────────────
const TopBar = ({
  onMenuClick, profile,
}: { onMenuClick:()=>void; profile: DBPlayerProfile | null }) => {
  const pathname = usePathname();
  const pageName = NAV_SECTIONS.flatMap(s => s.items).find(i => i.href === pathname)?.label ?? "Dashboard";
  const initials = profile?.display_name?.slice(0,1).toUpperCase() ?? "?";

  return (
    <header className="h-14 backdrop-blur-md border-b border-white/8
                       flex items-center px-4 gap-4 shrink-0 sticky top-0 z-30"
      style={{ background:"linear-gradient(90deg, #131318 0%, #0f0f13 100%)" }}>
      <button onClick={onMenuClick}
        className="md:hidden w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center
                   hover:bg-white/15 transition-colors">
        <Menu className="w-4 h-4 text-white/60" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-white/30 text-sm hidden sm:block">Friend of a Week</span>
        <span className="text-white/20 hidden sm:block">/</span>
        <span className="text-white text-sm font-semibold">{pageName}</span>
      </div>

      <div className="flex-1" />

      {/* Live dot */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
        <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.5, repeat:Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="text-[11px] text-red-400 font-mono font-bold tracking-wide">LIVE</span>
      </div>

      {/* XP pill */}
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/20">
        <Zap className="w-3 h-3 text-yellow-400" />
        <span className="text-[11px] text-yellow-400 font-mono font-bold">
          {(profile?.total_xp ?? 0).toLocaleString()} XP
        </span>
      </div>

      {/* Avatar */}
      <Link href="/profile">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600
                        flex items-center justify-center text-xs font-black text-gray-900 cursor-pointer
                        ring-2 ring-yellow-400/30 hover:ring-yellow-400/60 transition-all">
          {initials}
        </div>
      </Link>
    </header>
  );
};

// ─── Layout ────────────────────────────────────────────────────────────────────
export const GameLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed,   setCollapsed  ] = useState(false);
  const [mobileOpen,  setMobileOpen ] = useState(false);
  const [profile,     setProfile    ] = useState<DBPlayerProfile | null>(null);

  // Load the "current player" from localStorage name key, then fetch their profile
  useEffect(() => {
    const storedName = localStorage.getItem("fow_my_name");
    if (!storedName) return;
    supabase.from("player_profiles").select("*")
      .eq("name", storedName.toLowerCase()).maybeSingle()
      .then(({ data }) => { if (data) setProfile(data); });

    // Realtime: update sidebar XP whenever player_profiles changes
    const channel = supabase.channel("profile-sidebar")
      .on("postgres_changes", {
        event:"UPDATE", schema:"public", table:"player_profiles",
        filter:`name=eq.${storedName.toLowerCase()}`,
      }, ({ new: updated }) => {
        setProfile(updated as DBPlayerProfile);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex h-screen bg-[#0d0d10] overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}
        mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
        profile={profile} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} profile={profile} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="fixed inset-0 pointer-events-none -z-0">
            <div className="absolute top-0 left-1/3 w-96 h-96 bg-red-900/15 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-yellow-900/10 rounded-full blur-[100px]" />
          </div>
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default GameLayout;