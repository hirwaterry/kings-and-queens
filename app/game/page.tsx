"use client";
// app/game/page.tsx — Dashboard / Home

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Flame, Users, Target, Trophy, Radio,
  ChevronRight, Star, Crown, Brain, BookOpen, RefreshCw,
} from "lucide-react";
import {
  supabase, getLeaderboard, getRankTier, getPairs, getAgatambyi,
  type DBPlayerProfile, type DBPair, type DBAgatambyi, type DBSession,
} from "@/lib/supabase";
import { avatarUrl } from "@/app/game/layout";
import { useProfile } from "@/hooks/useProfile";

// ── Curated daily verse list (rotates by day-of-year) ─────────────────────────
// bible-api.com is free, no key needed — format: bible-api.com/John+3:16
const DAILY_VERSES = [
  "John 3:16",       "Psalms 23:1",     "Jeremiah 29:11",  "Philippians 4:13",
  "Romans 8:28",     "Proverbs 3:5",    "Isaiah 40:31",    "Matthew 6:33",
  "Psalms 46:1",     "Romans 12:2",     "Galatians 5:22",  "Hebrews 11:1",
  "1 Corinthians 13:4", "Joshua 1:9",   "Psalms 121:1-2",  "John 14:6",
  "Proverbs 31:25",  "Lamentations 3:22-23", "2 Timothy 1:7", "Psalms 27:1",
  "Romans 5:8",      "Matthew 5:16",    "Colossians 3:23", "Philippians 4:6-7",
  "1 Peter 5:7",     "Psalms 37:4",     "Ephesians 2:10",  "John 15:13",
  "Proverbs 16:3",   "Isaiah 41:10",    "Deuteronomy 31:6","Romans 15:13",
  "Psalms 119:105",  "Matthew 11:28",   "Revelation 21:4", "John 10:10",
  "Micah 6:8",       "Psalms 34:18",    "Luke 1:37",       "Zephaniah 3:17",
  "Romans 8:38-39",  "Psalms 139:14",   "Colossians 3:2",  "John 16:33",
  "2 Corinthians 5:17", "Ephesians 3:20", "Psalms 91:1",   "Mark 11:24",
  "1 John 4:19",     "Proverbs 4:23",   "Isaiah 43:2",     "Matthew 28:20",
  "Psalms 51:10",    "Romans 12:12",    "1 Thessalonians 5:16-18",
  "Psalms 16:11",    "John 8:36",       "Hebrews 4:16",    "Acts 1:8",
  "Psalms 1:1-2",    "Proverbs 18:21",  "Matthew 5:9",     "Ephesians 6:10",
];

function getTodayVerse(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
}

// ── Quick action card ─────────────────────────────────────────────────────────
const QuickCard = ({
  icon, label, sub, href, color, badge, onClick,
}: {
  icon: React.ReactNode; label: string; sub: string;
  href: string; color: string; badge?: string | null; onClick: (href: string) => void;
}) => (
  <motion.button
    whileHover={{ scale: 1.02, y: -1 }}
    whileTap={{ scale: 0.97 }}
    onClick={() => onClick(href)}
    className="flex flex-col gap-2 p-4 rounded-2xl border border-white/8 bg-white/5
               hover:bg-white/8 hover:border-white/15 transition-all text-left relative overflow-hidden"
  >
    {badge && (
      <span className={`absolute top-2 right-2 text-[8px] font-black font-mono px-1.5 py-0.5 rounded-full border
                        ${badge === "LIVE" ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-white/8 border-white/15 text-white/30"}`}>
        {badge}
      </span>
    )}
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-white font-black text-sm">{label}</p>
      <p className="text-white/30 text-[10px] font-mono">{sub}</p>
    </div>
  </motion.button>
);

// ── Mini hero avatar row ───────────────────────────────────────────────────────
const MiniAvatar = ({ p, rank }: { p: DBPlayerProfile; rank: number }) => {
  const tier = getRankTier(p.total_xp);
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
      <span className="text-sm shrink-0">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</span>
      <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 shrink-0 relative">
        <img src={avatarUrl(p.display_name)} alt={p.display_name} className="w-full h-full object-cover bg-white/5" />
        <div className="absolute bottom-0 right-0 text-[7px] leading-none bg-black/30 rounded-tl px-0.5">
          {p.role === "king" ? "⚔️" : "👑"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-xs truncate">{p.display_name}</p>
        <p className="text-white/30 text-[9px] font-mono">{tier.icon} {tier.label}</p>
      </div>
      <div className="text-yellow-300 font-black text-xs font-mono shrink-0">
        {p.total_xp >= 1000 ? `${(p.total_xp / 1000).toFixed(1)}k` : p.total_xp}
        <span className="text-white/20 ml-0.5">xp</span>
      </div>
    </div>
  );
};

// ── Pair card (this week) ─────────────────────────────────────────────────────
const MyPairCard = ({
  pair, myName, agatambyi,
}: { pair: DBPair; myName: string; agatambyi: DBAgatambyi | null }) => {
  const partner = pair.member_a_name.toLowerCase() === myName.toLowerCase()
    ? { name: pair.member_b_name, role: pair.member_b_role }
    : { name: pair.member_a_name, role: pair.member_a_role };
  const myRole = pair.member_a_name.toLowerCase() === myName.toLowerCase()
    ? pair.member_a_role : pair.member_b_role;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, type: "spring" }}
      className="rounded-3xl border border-blue-400/30 bg-blue-500/8 p-5"
      style={{ boxShadow: "0 0 30px rgba(59,130,246,0.12)" }}
    >
      <p className="text-[10px] text-blue-400/60 font-mono tracking-widest uppercase mb-4">✦ Your Current Pair ✦</p>

      <div className="flex items-center justify-center gap-5">
        {/* Me */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-blue-400/40 relative">
            <img src={avatarUrl(myName)} alt={myName} className="w-full h-full object-cover bg-white/5" />
            <div className="absolute bottom-0.5 right-0.5 text-[10px] leading-none drop-shadow">
              {myRole === "king" ? "⚔️" : "👑"}
            </div>
          </div>
          <div className="text-center">
            <p className={`font-black text-sm ${myRole === "king" ? "text-yellow-300" : "text-rose-300"}`}>{myName}</p>
            <p className="text-[9px] text-blue-400/60 font-mono">You</p>
          </div>
        </div>

        {/* Connector */}
        <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
          className="text-2xl">
          {pair.pair_type === "king-queen" ? "❤️" : pair.pair_type === "king-king" ? "⚔️" : "👑"}
        </motion.div>

        {/* Partner */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 relative
                           ${partner.role === "king" ? "border-yellow-400/40" : "border-rose-400/40"}`}>
            <img src={avatarUrl(partner.name)} alt={partner.name} className="w-full h-full object-cover bg-white/5" />
            <div className="absolute bottom-0.5 right-0.5 text-[10px] leading-none drop-shadow">
              {partner.role === "king" ? "⚔️" : "👑"}
            </div>
          </div>
          <div className="text-center">
            <p className={`font-black text-sm ${partner.role === "king" ? "text-yellow-300" : "text-rose-300"}`}>{partner.name}</p>
            <p className="text-[9px] text-white/25 font-mono capitalize">{partner.role}</p>
          </div>
        </div>
      </div>

      {agatambyi && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-400/8 border border-yellow-400/20">
          <span className="text-base">⭐</span>
          <div>
            <p className="text-[9px] text-yellow-400/60 font-mono uppercase tracking-wider">Agatambyi</p>
            <p className="text-yellow-300 font-black text-xs">{agatambyi.name} stands alone royally</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ── Bible Verse Card ───────────────────────────────────────────────────────────
const VerseCard = () => {
  const [verse,   setVerse  ] = useState<{ text: string; reference: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState(false);
  const [ref,     setRef    ] = useState(getTodayVerse());

  const fetchVerse = useCallback(async (verseRef: string) => {
    setLoading(true);
    setError(false);
    try {
      // bible-api.com — completely free, no API key needed
      const encoded = encodeURIComponent(verseRef.replace(/ /g, "+"));
      const res  = await fetch(`https://bible-api.com/${encoded}?translation=kjv`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Clean up extra whitespace/newlines from KJV
      const text = (data.text as string).replace(/\s+/g, " ").trim();
      setVerse({ text, reference: data.reference });
    } catch {
      setError(true);
      // Fallback hardcoded verse if API fails
      setVerse({
        text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.",
        reference: "Jeremiah 29:11",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVerse(ref); }, [ref, fetchVerse]);

  // Pick a new random verse (different from current)
  const refreshVerse = () => {
    let next = DAILY_VERSES[Math.floor(Math.random() * DAILY_VERSES.length)];
    while (next === ref && DAILY_VERSES.length > 1) {
      next = DAILY_VERSES[Math.floor(Math.random() * DAILY_VERSES.length)];
    }
    setRef(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-6 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-950/30 to-yellow-950/10 overflow-hidden"
      style={{ boxShadow: "0 0 30px rgba(251,191,36,0.08)" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-amber-400/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-amber-300 font-black text-xs tracking-wide">Word of the Day</p>
            <p className="text-amber-400/40 text-[9px] font-mono">Daily Bible Verse</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.85, rotate: 180 }}
          onClick={refreshVerse}
          disabled={loading}
          className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center
                     hover:bg-amber-400/20 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 text-amber-400 ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </div>

      {/* Verse body */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[100, 85, 60].map((w, i) => (
              <motion.div key={i} animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                className="h-2.5 rounded-full bg-amber-400/15"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        ) : verse ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={verse.reference}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              {/* Opening quote mark */}
              <p className="text-amber-300/20 text-4xl font-black leading-none -mb-2 font-serif">"</p>

              <p className="text-white/80 text-sm leading-relaxed font-medium italic">
                {verse.text}
              </p>

              <div className="flex items-center justify-between mt-3">
                <p className="text-amber-400 font-black text-xs font-mono">— {verse.reference}</p>
                {error && (
                  <span className="text-[8px] text-white/20 font-mono">offline fallback</span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>

      {/* Footer — today's date */}
      <div className="px-5 pb-3">
        <p className="text-amber-400/25 text-[9px] font-mono">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router  = useRouter();
  const { profile } = useProfile();

  const [myName,      setMyName     ] = useState("");
  const [topPlayers,  setTopPlayers ] = useState<DBPlayerProfile[]>([]);
  const [myPair,      setMyPair     ] = useState<DBPair | null>(null);
  const [myAgatambyi, setMyAgatambyi] = useState<DBAgatambyi | null>(null);
  const [latestSess,  setLatestSess ] = useState<DBSession | null>(null);
  const [totalHeroes, setTotalHeroes] = useState(0);
  const [totalWeeks,  setTotalWeeks ] = useState(0);
  const [loading,     setLoading    ] = useState(true);
  const [hasOpenSess, setHasOpenSess] = useState(false);

  const load = useCallback(async () => {
    const name = localStorage.getItem("fow_my_name") ?? "";
    setMyName(name);

    const all = await getLeaderboard();
    setTopPlayers(all.slice(0, 3));
    setTotalHeroes(all.length);
    setTotalWeeks(Math.max(...all.map(p => p.last_seen_week), 0));

    const { data: sessions } = await supabase.from("sessions").select("*")
      .order("week_number", { ascending: false }).limit(5);

    const revealed = (sessions ?? []).find((s: DBSession) => s.status === "revealed");
    const open     = (sessions ?? []).find((s: DBSession) => s.status === "lobby");
    setLatestSess(revealed ?? null);
    setHasOpenSess(!!open);

    if (name && revealed) {
      const pairs = await getPairs(revealed.id);
      const mine  = pairs.find(p =>
        p.member_a_name.toLowerCase() === name.toLowerCase() ||
        p.member_b_name.toLowerCase() === name.toLowerCase()
      );
      setMyPair(mine ?? null);
      setMyAgatambyi(await getAgatambyi(revealed.id));
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const tier = profile ? getRankTier(profile.total_xp) : null;
  const goTo = (href: string) => router.push(href);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  // Display name: prefer profile display_name, fall back to localStorage name
  const displayName = profile?.display_name ?? myName;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="text-4xl">👑</motion.div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      {/* BG ambient */}
      <div className="fixed inset-0 pointer-events-none -z-0">
        <div className="absolute top-0 right-1/4 w-[400px] h-[350px] bg-red-900/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-yellow-900/8 rounded-full blur-[110px]" />
        <div className="absolute top-1/2 right-0 w-60 h-60 bg-violet-900/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-7 pb-16 max-w-lg">

        {/* ── GREETING HERO CARD — shown to EVERY user ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 rounded-3xl border border-white/10 bg-white/5 mb-6"
        >
          {/* Avatar — uses name if no profile yet */}
          <motion.div
            animate={{ boxShadow: displayName ? [
              `0 0 12px ${tier?.tier === "champion" ? "#facc1540" : "#ffffff12"}`,
              `0 0 28px ${tier?.tier === "champion" ? "#facc1568" : "#ffffff22"}`,
              `0 0 12px ${tier?.tier === "champion" ? "#facc1540" : "#ffffff12"}`,
            ] : [] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/15 shrink-0 relative"
          >
            {displayName ? (
              <>
                <img
                  src={avatarUrl(displayName)}
                  alt={displayName}
                  className="w-full h-full object-cover bg-white/5"
                />
                {profile && (
                  <div className="absolute bottom-0.5 right-0.5 text-[10px] leading-none drop-shadow">
                    {profile.role === "king" ? "⚔️" : "👑"}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5">
                <Crown className="w-7 h-7 text-white/20" />
              </div>
            )}
          </motion.div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            {displayName ? (
              <>
                <p className="text-white/40 text-[10px] font-mono">{greeting()},</p>
                <p className="text-white font-black text-lg truncate leading-tight">{displayName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {tier ? (
                    <span className={`text-[10px] font-bold font-mono
                      ${tier.tier === "champion" ? "text-yellow-300"
                        : tier.tier === "legend"   ? "text-slate-300"
                        : tier.tier === "elite"    ? "text-amber-500"
                        : tier.tier === "veteran"  ? "text-violet-300"
                        : tier.tier === "warrior"  ? "text-blue-300"
                        : "text-white/40"}`}>
                      {tier.icon} {tier.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/30 font-mono">🌱 Welcome</span>
                  )}
                  {profile?.current_streak && profile.current_streak >= 2 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-orange-400 font-mono">
                      <Flame className="w-2.5 h-2.5" />{profile.current_streak}wk streak
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-white/40 text-[10px] font-mono">{greeting()},</p>
                <p className="text-white font-black text-base leading-tight">Welcome, Hero!</p>
                <p className="text-white/30 text-[10px] font-mono mt-0.5">Set your name to get started</p>
              </>
            )}
          </div>

          {/* XP pill (if they have a profile) or Profile button (if they don't) */}
          {profile ? (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-yellow-400/15 border border-yellow-400/25">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-yellow-300 font-black text-sm">
                  {profile.total_xp >= 1000 ? `${(profile.total_xp / 1000).toFixed(1)}k` : profile.total_xp}
                </span>
              </div>
              {tier && tier.nextXP !== Infinity && (
                <p className="text-[8px] text-white/20 font-mono">
                  {tier.nextXP - profile.total_xp} to next
                </p>
              )}
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => goTo("/game/profile")}
              className="shrink-0 px-3 py-2 rounded-xl bg-white/8 border border-white/15 text-white/60
                         text-xs font-bold hover:bg-white/12 transition-colors"
            >
              Set up →
            </motion.button>
          )}
        </motion.div>

        {/* ── BIBLE VERSE OF THE DAY ── */}
        <VerseCard />

        {/* ── LIVE SESSION BANNER ── */}
        {hasOpenSess && (
          <motion.button
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => goTo("/game/live")}
            className="w-full mb-5 p-4 rounded-2xl border border-red-500/40 bg-red-500/10 flex items-center gap-3
                       hover:bg-red-500/15 transition-all"
            style={{ boxShadow: "0 0 24px rgba(239,68,68,0.15)" }}
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-red-400 shrink-0"
            />
            <div className="flex-1 text-left">
              <p className="text-red-300 font-black text-sm">Session is LIVE now!</p>
              <p className="text-red-400/60 text-[10px] font-mono">Tap to join and get paired</p>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400/60 shrink-0" />
          </motion.button>
        )}

        {/* ── NO NAME YET — join / setup prompt ── */}
        {!displayName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-5 p-4 rounded-2xl border border-white/10 bg-white/4 text-center"
          >
            <p className="text-white/40 text-sm mb-3">Join a session or set up your profile to get started.</p>
            <div className="flex gap-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => goTo("/game/live")}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl font-black text-sm
                           flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/20">
                <Radio className="w-4 h-4" />Join Session
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => goTo("/game/profile")}
                className="flex-1 py-2.5 bg-white/8 border border-white/15 rounded-xl font-black text-sm
                           text-white/70 flex items-center justify-center gap-1.5">
                <Crown className="w-4 h-4" />Profile
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── MY CURRENT PAIR ── */}
        {myPair && latestSess ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">
                Week {latestSess.week_number} Pair
              </p>
              <button onClick={() => goTo("/game/live")}
                className="text-[10px] text-white/30 hover:text-white/60 font-mono flex items-center gap-0.5 transition-colors">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <MyPairCard pair={myPair} myName={myName} agatambyi={myAgatambyi} />
          </div>
        ) : latestSess && myName ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-2xl border border-white/8 bg-white/4 text-center">
            <p className="text-white/40 text-sm mb-3">
              Week {latestSess.week_number} session happened — you weren't paired.
            </p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => goTo("/game/live")}
              className="px-5 py-2.5 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 font-bold text-sm">
              Join Next Session →
            </motion.button>
          </motion.div>
        ) : null}

        {/* ── STATS STRIP ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Heroes", val: totalHeroes,       icon: <Users className="w-4 h-4 text-blue-400"/>,   color: "text-blue-300"   },
            { label: "Weeks",  val: totalWeeks,         icon: <Star  className="w-4 h-4 text-yellow-400"/>, color: "text-yellow-300" },
            { label: "My XP",  val: profile?.total_xp ?? 0, icon: <Zap className="w-4 h-4 text-violet-400"/>, color: "text-violet-300" },
          ].map(s => (
            <motion.div key={s.label}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
              {s.icon}
              <span className={`text-xl font-black ${s.color}`}>
                {s.val >= 1000 ? `${(s.val / 1000).toFixed(1)}k` : s.val}
              </span>
              <span className="text-[9px] text-white/25 uppercase font-mono">{s.label}</span>
            </motion.div>
          ))}
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div className="mb-6">
          <p className="text-[10px] text-white/20 font-mono uppercase tracking-widest mb-3">Quick Access</p>
          <div className="grid grid-cols-2 gap-3">
            <QuickCard icon={<Radio className="w-4 h-4"/>}  label="Live Pair"     sub="Join this week's session"  href="/game/live"        color="bg-red-500/20 text-red-400"    badge={hasOpenSess ? "LIVE" : null} onClick={goTo}/>
            <QuickCard icon={<Target className="w-4 h-4"/>} label="Challenge"     sub="Earn bonus XP"             href="/game/challenge"   color="bg-violet-500/20 text-violet-400" badge={null}           onClick={goTo}/>
            <QuickCard icon={<Trophy className="w-4 h-4"/>} label="Leaderboard"  sub="See top heroes"            href="/game/leaderboard" color="bg-yellow-500/20 text-yellow-400" badge={null}           onClick={goTo}/>
            <QuickCard icon={<Brain className="w-4 h-4"/>}  label="Weekly Quiz"  sub="Answer questions, win XP"  href="/game/quiz"        color="bg-blue-500/20 text-blue-400"  badge={null}           onClick={goTo}/>
          </div>
        </div>

        {/* ── TOP HEROES PREVIEW ── */}
        {topPlayers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Top Heroes</p>
              <button onClick={() => goTo("/game/leaderboard")}
                className="text-[10px] text-white/30 hover:text-white/60 font-mono flex items-center gap-0.5 transition-colors">
                Full board <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Mini podium */}
            <div className="flex items-end justify-center gap-4 mb-4 py-3 px-4 rounded-2xl bg-white/3 border border-white/6">
              {[
                { p: topPlayers[1], rank: 2, h: "h-16" },
                { p: topPlayers[0], rank: 1, h: "h-24" },
                { p: topPlayers[2], rank: 3, h: "h-12" },
              ].filter(x => x.p).map(({ p, rank, h }) => {
                const glow  = rank === 1 ? "#facc15" : rank === 2 ? "#cbd5e1" : "#b45309";
                const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
                return (
                  <motion.div key={p.name}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: rank === 1 ? 0.1 : rank === 2 ? 0.15 : 0.2, type: "spring" }}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="text-base">{medal}</span>
                    <motion.div
                      animate={rank === 1 ? { boxShadow: [`0 0 8px ${glow}40`, `0 0 22px ${glow}70`, `0 0 8px ${glow}40`] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-12 h-12 rounded-xl overflow-hidden border-2 relative"
                      style={{ borderColor: `${glow}50` }}
                    >
                      <img src={avatarUrl(p.display_name)} alt={p.display_name}
                        className="w-full h-full object-cover bg-white/5" />
                      <div className="absolute bottom-0 right-0 text-[7px] leading-none bg-black/30 rounded-tl px-0.5">
                        {p.role === "king" ? "⚔️" : "👑"}
                      </div>
                    </motion.div>
                    <p className="text-white text-[10px] font-black max-w-[56px] truncate text-center">{p.display_name}</p>
                    <div className={`w-12 ${h} rounded-t-lg flex items-center justify-center`}
                      style={{
                        background: `linear-gradient(to top, ${glow}08, ${glow}20)`,
                        borderTop: `1px solid ${glow}30`,
                        boxShadow: `0 -2px 10px ${glow}15`,
                      }}>
                      <span className="text-[9px] font-black font-mono" style={{ color: glow }}>#{rank}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5">
              {topPlayers.map((p, i) => <MiniAvatar key={p.name} p={p} rank={i + 1} />)}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="mt-8 flex items-center justify-center gap-2 text-white/12">
          <Crown className="w-3 h-3" />
          <span className="text-[9px] font-mono tracking-widest uppercase">Friend of a Week</span>
          <Crown className="w-3 h-3" />
        </div>

      </div>
    </div>
  );
}