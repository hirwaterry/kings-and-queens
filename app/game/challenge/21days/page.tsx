"use client";
// app/game/challenge21/page.tsx  —  21-Day Bible & Gospel Challenge

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Music, Flame, Check, ChevronDown, ChevronUp,
  RefreshCw, Share2, Gift, Star, Trophy, Lock,
  AlertCircle, Sparkles, Clock, RotateCcw, X,
  ChevronRight, Play, Heart, Shield,
  Bell, BellOff, Volume2, ExternalLink, Users,
  Pause, SkipForward, Radio,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { avatarUrl } from "@/app/game/layout";

// ── Types ─────────────────────────────────────────────────────────────────────
type ChallengeType = "bible" | "gospel" | "both";
type DayStatus     = "pending" | "completed" | "missed" | "recovered";

interface Enrollment {
  id: string;
  player_name: string;
  challenge_type: ChallengeType;
  started_at: string;
  completed_at: string | null;
  is_active: boolean;
}

interface ChallengeDay {
  id: string;
  enrollment_id: string;
  player_name: string;
  day_number: number;
  status: DayStatus;
  bible_book: string | null;
  bible_chapter: number | null;
  bible_verse: string | null;
  bible_note: string | null;
  gospel_song: string | null;
  gospel_artist: string | null;
  gospel_note: string | null;
  logged_at: string | null;
  due_date: string | null;
  recovered_at: string | null;
  surprise_opened: boolean;
  surprise_type: string | null;
  surprise_content: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STREAK_COLOR = (day: number) => {
  if (day >= 21) return { from: "#f59e0b", to: "#fbbf24", text: "text-yellow-300", label: "Gold", glow: "#f59e0b" };
  if (day >= 15) return { from: "#8b5cf6", to: "#a78bfa", text: "text-purple-300", label: "Purple", glow: "#8b5cf6" };
  if (day >= 8)  return { from: "#10b981", to: "#34d399", text: "text-emerald-300", label: "Green", glow: "#10b981" };
  return { from: "#3b82f6", to: "#60a5fa", text: "text-blue-300", label: "Blue", glow: "#3b82f6" };
};

const MILESTONES = [1, 3, 7, 14, 21];
const MILESTONE_LABEL: Record<number, string> = {
  1: "First Step 🌱", 3: "Finding Rhythm 🔥", 7: "One Week Strong ⚡",
  14: "Halfway Hero 🛡️", 21: "Champion 👑",
};

const SURPRISE_POOL = [
  { type: "message",     content: "God sees every step you take in faith. Keep going! 🙏" },
  { type: "message",     content: "\"I can do all things through Christ who strengthens me.\" — Phil 4:13 💪" },
  { type: "prompt",      content: "Reflection: What is one thing God has been teaching you this week?" },
  { type: "prompt",      content: "Reflection: How has today's reading or song changed your perspective?" },
  { type: "shield",      content: "🛡️ Streak Shield! Your streak is protected for 1 missed day." },
  { type: "encouragement", content: "You're doing better than you think. Every day matters! ✨" },
  { type: "message",     content: "\"Be still and know that I am God.\" — Psalm 46:10 🕊️" },
  { type: "prompt",      content: "Reflection: Write down one prayer request for this week." },
  { type: "encouragement", content: "The enemy wants you to quit today. That's exactly why you won't. 🔥" },
  { type: "message",     content: "\"His mercies are new every morning.\" — Lam 3:23 🌅" },
  { type: "shield",      content: "🛡️ Grace Day! You can mark one missed day as recovered, no questions asked." },
  { type: "prompt",      content: "Reflection: Share one verse that spoke to you recently with a friend." },
];

const SONG_SUGGESTIONS = [
  { song: "Way Maker",          artist: "Sinach"              ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Jireh",              artist: "Elevation Worship"   ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Goodness of God",    artist: "CeCe Winans"         ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Yes and Amen",       artist: "Housefires"          ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "This Is Me Trying",  artist: "Maverick City Music" ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Fear Is Not My Future", artist: "Kirk Franklin"    ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "God Really Loves Us",artist: "Crowder"             ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Battle Belongs",     artist: "Phil Wickham"        ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Promises",           artist: "Maverick City Music" ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Firm Foundation",    artist: "Cody Carnes"         ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Holy Forever",       artist: "Brian Johnson"       ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Canvas and Clay",    artist: "Pat Barrett"         ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Build My Life",      artist: "Housefires"          ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Another One",        artist: "Bethel Music"        ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Great Are You Lord", artist: "All Sons & Daughters",   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Raise a Hallelujah", artist: "Bethel Music"        ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Graves Into Gardens","artist": "Elevation Worship" ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "King of Kings",      artist: "Hillsong Worship"    ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Living Hope",        artist: "Phil Wickham"        ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "What a Beautiful Name", artist: "Hillsong Worship" ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
  { song: "Same God",           artist: "Elevation Worship"   ,   url: "https://youtu.be/hORfMfddEnY?list=RDhORfMfddEnY"},
];

function todaySuggestion() {
  const day = Math.floor(Date.now() / 86400000);
  return SONG_SUGGESTIONS[day % SONG_SUGGESTIONS.length];
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDayNumber(enrollment: Enrollment): number {
  const started = new Date(enrollment.started_at);
  const today   = new Date();
  return Math.min(21, daysBetween(started, today) + 1);
}

function getCompletedCount(days: ChallengeDay[]): number {
  return days.filter(d => d.status === "completed" || d.status === "recovered").length;
}

function getMissedCount(days: ChallengeDay[]): number {
  return days.filter(d => d.status === "missed").length;
}

function getStreak(days: ChallengeDay[]): number {
  const sorted  = [...days].sort((a, b) => b.day_number - a.day_number);
  let streak = 0;
  for (const d of sorted) {
    if (d.status === "completed" || d.status === "recovered") streak++;
    else break;
  }
  return streak;
}

function isSurpriseDay(dayNum: number): boolean {
  // Surprise appears on days 3, 7, 10, 14, 17, 21 (plus random ~30% chance)
  const fixed = [3, 7, 10, 14, 17, 21];
  return fixed.includes(dayNum);
}

function pickSurprise() {
  return SURPRISE_POOL[Math.floor(Math.random() * SURPRISE_POOL.length)];
}


// ─────────────────────────────────────────────────────────────────────────────
// YOUTUBE MINI PLAYER
// Embeds YouTube IFrame API directly — no external links needed
// ─────────────────────────────────────────────────────────────────────────────
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  getPlayerState: () => number;
}
declare global { interface Window { YT: any; onYouTubeIframeAPIReady: () => void; } }

const YoutubePlayer = ({ song, artist, url }: { song: string; artist: string; url?: string }) => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const playerRef     = useRef<YTPlayer | null>(null);
  const [isPlaying,   setIsPlaying  ] = useState(false);
  const [isLoading,   setIsLoading  ] = useState(false);
  const [videoId,     setVideoId    ] = useState<string | null>(null);
  const [error,       setError      ] = useState(false);
  const [searchDone,  setSearchDone ] = useState(false);

  // Extract video ID from YouTube URL
  const extractVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Get video ID from URL or fallback to search
  const getVideoId = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      if (url) {
        const extractedId = extractVideoId(url);
        if (extractedId) {
          setVideoId(extractedId);
          setSearchDone(true);
          setIsLoading(false);
          return;
        }
      }
      // Fallback to search if no URL provided
      setVideoId(`${song} ${artist}`);
      setSearchDone(true);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [song, artist, url]);

  useEffect(() => { getVideoId(); }, [getVideoId]);

  const searchUrl = videoId
    ? url && extractVideoId(url)
      ? `https://www.youtube-nocookie.com/embed/${extractVideoId(url)}?autoplay=0&rel=0&modestbranding=1&color=white`
      : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(videoId)}&autoplay=0&rel=0&modestbranding=1&color=white`
    : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-purple-400/25 bg-black">
      {/* Player header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-purple-900/20 border-b border-purple-400/15">
        <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
          <Radio className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-xs truncate">{song}</p>
          <p className="text-white/40 text-[9px] font-mono truncate">{artist}</p>
        </div>
        <a
          href={url || `https://www.youtube.com/results?search_query=${encodeURIComponent(song + " " + artist)}`}
          target="_blank" rel="noopener noreferrer"
          className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors"
          title="Open in YouTube"
        >
          <ExternalLink className="w-3 h-3 text-white/40" />
        </a>
      </div>

      {/* IFrame embed */}
      {searchUrl && (
        <div className="relative" style={{ paddingTop: "56.25%" }}>
          <iframe
            src={searchUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`${song} by ${artist}`}
          />
        </div>
      )}

      {isLoading && (
        <div className="h-32 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE LEADERBOARD
// Shows all active participants ranked by streak, with avatars
// ─────────────────────────────────────────────────────────────────────────────
interface LeaderEntry {
  player_name: string;
  display_name: string;
  challenge_type: string;
  streak: number;
  completed: number;
  enrollment_id: string;
}

const ChallengeLeaderboard = ({ myName }: { myName: string }) => {
  const [entries,  setEntries ] = useState<LeaderEntry[]>([]);
  const [loading,  setLoading ] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Get all active enrollments
      const { data: enrollments } = await supabase
        .from("challenge_enrollments")
        .select("id, player_name, challenge_type")
        .eq("is_active", true);

      if (!enrollments?.length) { setLoading(false); return; }

      // Get all days for these enrollments
      const ids = enrollments.map(e => e.id);
      const { data: allDays } = await supabase
        .from("challenge_days")
        .select("enrollment_id, status, day_number")
        .in("enrollment_id", ids);

      // Get display names from player_profiles
      const names = enrollments.map(e => e.player_name);
      const { data: profiles } = await supabase
        .from("player_profiles")
        .select("name, display_name")
        .in("name", names);
      const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.name, p.display_name]));

      // Calculate streak per enrollment
      const result: LeaderEntry[] = enrollments.map(enr => {
        const days = (allDays ?? []).filter(d => d.enrollment_id === enr.id);
        const completed = days.filter(d => d.status === "completed" || d.status === "recovered").length;
        // Streak = consecutive completed from highest day_number down
        const sorted = [...days].sort((a, b) => b.day_number - a.day_number);
        let streak = 0;
        for (const d of sorted) {
          if (d.status === "completed" || d.status === "recovered") streak++;
          else break;
        }
        return {
          player_name:     enr.player_name,
          display_name:    nameMap[enr.player_name] ?? enr.player_name,
          challenge_type:  enr.challenge_type,
          streak,
          completed,
          enrollment_id:   enr.id,
        };
      });

      // Sort by streak desc, then completed desc
      result.sort((a, b) => b.streak - a.streak || b.completed - a.completed);
      setEntries(result);
      setLoading(false);
    };
    load();
  }, []);

  const visible = expanded ? entries : entries.slice(0, 5);
  const myRank  = entries.findIndex(e => e.player_name === myName.toLowerCase()) + 1;

  if (loading) return (
    <div className="p-4 rounded-2xl border border-white/8 bg-white/3 flex items-center justify-center">
      <RefreshCw className="w-4 h-4 text-white/20 animate-spin" />
    </div>
  );
  if (!entries.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <p className="text-white font-black text-sm">Faith Hall of Fame</p>
            <p className="text-white/25 text-[9px] font-mono">{entries.length} on the challenge · ranked by streak</p>
          </div>
        </div>
        {myRank > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25">
            <span className="text-[9px] text-violet-300 font-mono font-bold">You #{myRank}</span>
          </div>
        )}
      </div>

      {/* Podium — top 3 */}
      {entries.length >= 3 && (
        <div className="flex items-end justify-center gap-3 px-4 py-4 border-b border-white/6">
          {[
            { entry: entries[1], rank: 2 },
            { entry: entries[0], rank: 1 },
            { entry: entries[2], rank: 3 },
          ].map(({ entry, rank }) => {
            const isMe = entry.player_name === myName.toLowerCase();
            const glow = rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : "#b45309";
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
            const h = rank === 1 ? "h-10" : rank === 2 ? "h-7" : "h-5";
            const avatarSize = rank === 1 ? "w-14 h-14" : "w-11 h-11";
            const c = { from: rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : "#b45309",
                        text: rank === 1 ? "text-yellow-300" : rank === 2 ? "text-slate-300" : "text-amber-600" };
            return (
              <div key={entry.player_name}
                className={`flex flex-col items-center gap-1.5 ${rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3"}`}>
                <span className="text-base">{medal}</span>
                <motion.div
                  animate={rank === 1 ? { boxShadow: [`0 0 10px ${glow}40`, `0 0 28px ${glow}70`, `0 0 10px ${glow}40`] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`${avatarSize} rounded-xl overflow-hidden border-2 relative`}
                  style={{ borderColor: isMe ? "#ffffff80" : `${glow}50` }}
                >
                  <img src={avatarUrl(entry.display_name)} alt={entry.display_name}
                    className="w-full h-full object-cover bg-white/5" />
                </motion.div>
                <p className="text-white text-[10px] font-black max-w-[60px] truncate text-center">
                  {isMe ? "You" : entry.display_name}
                </p>
                <div className="flex items-center gap-0.5">
                  <Flame className="w-3 h-3" style={{ color: glow }} />
                  <span className="text-[10px] font-black" style={{ color: glow }}>{entry.streak}</span>
                </div>
                <div className={`w-14 ${h} rounded-t-lg flex items-center justify-center`}
                  style={{ background: `linear-gradient(to top, ${glow}12, ${glow}25)`,
                           borderTop: `1px solid ${glow}35` }}>
                  <span className="text-[9px] font-black font-mono" style={{ color: glow }}>#{rank}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="px-3 py-2 flex flex-col gap-1">
        {visible.map((entry, i) => {
          const rank   = i + 1;
          const isMe   = entry.player_name === myName.toLowerCase();
          const sc     = STREAK_COLOR(entry.streak);
          return (
            <motion.div key={entry.player_name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all
                          ${isMe ? "bg-blue-500/10 border-blue-400/30" : "bg-white/3 border-white/6"}`}>
              {/* Rank */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0
                               ${rank === 1 ? "bg-yellow-400/20 text-yellow-300"
                                 : rank === 2 ? "bg-slate-400/15 text-slate-300"
                                 : rank === 3 ? "bg-amber-700/15 text-amber-500"
                                 : "bg-white/5 text-white/30"}`}>
                {rank}
              </div>
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-xl overflow-hidden border shrink-0 ${isMe ? "border-blue-400/40" : "border-white/10"}`}>
                <img src={avatarUrl(entry.display_name)} alt={entry.display_name}
                  className="w-full h-full object-cover bg-white/5" />
              </div>
              {/* Name + progress bar */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${isMe ? "text-blue-300" : "text-white"}`}>
                  {isMe ? `${entry.display_name} (you)` : entry.display_name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(entry.completed / 21) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.04 }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${sc.from}, ${sc.to})` }}
                    />
                  </div>
                  <span className="text-[8px] text-white/25 font-mono shrink-0">{entry.completed}/21</span>
                </div>
              </div>
              {/* Streak */}
              <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg"
                style={{ background: `${sc.from}15`, border: `1px solid ${sc.from}30` }}>
                <Flame className="w-3 h-3" style={{ color: sc.from }} />
                <span className="text-[10px] font-black" style={{ color: sc.from }}>{entry.streak}</span>
              </div>
              {/* Challenge type icons */}
              <div className="flex shrink-0">
                {(entry.challenge_type === "bible" || entry.challenge_type === "both") &&
                  <BookOpen className="w-3 h-3 text-amber-400/50" />}
                {(entry.challenge_type === "gospel" || entry.challenge_type === "both") &&
                  <Music className="w-3 h-3 text-purple-400/50 ml-0.5" />}
              </div>
            </motion.div>
          );
        })}
      </div>

      {entries.length > 5 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-[10px] text-white/25 hover:text-white/50 font-mono transition-colors
                     border-t border-white/6 flex items-center justify-center gap-1">
          {expanded ? <><ChevronDown className="w-3 h-3 rotate-180" />Show less</>
                    : <><ChevronDown className="w-3 h-3" />Show {entries.length - 5} more</>}
        </button>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PROMPT — simple, one-tap, non-intimidating
// ─────────────────────────────────────────────────────────────────────────────
const NotificationManager = ({
  playerName, currentDay, streak,
}: { playerName: string; currentDay: number; streak: number }) => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [time,       setTime      ] = useState("20:00");
  const [expanded,   setExpanded  ] = useState(false);
  const [sent,       setSent      ] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    const saved = localStorage.getItem("fow_reminder_time");
    if (saved) setTime(saved);
  }, []);

  const allow = async () => {
    if (!("Notification" in window)) return;
    const res = await Notification.requestPermission();
    setPermission(res);
    if (res === "granted") {
      localStorage.setItem("fow_reminder_time", time);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      // Welcome notification
      new Notification("🔥 Reminders ON, " + playerName + "!", {
        body: `You'll be nudged at ${time} every day. Day ${currentDay} of 21 — keep going!`,
        icon: "/icons/web-app-manifest-192x192.png",
        badge: "/icons/favicon-96x96.png",
        tag: "fow-welcome",
      });
    }
  };

  const saveTime = () => {
    localStorage.setItem("fow_reminder_time", time);
    setExpanded(false);
    // Test notification
    if (Notification.permission === "granted") {
      new Notification("⏰ Reminder updated!", {
        body: `You'll get your daily nudge at ${time}.`,
        icon: "/icons/web-app-manifest-192x192.png",
        tag: "fow-time-update",
      });
    }
  };

  const isOn     = permission === "granted";
  const isDenied = permission === "denied";

  if (isOn) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="rounded-2xl border border-green-400/20 bg-green-500/6 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3">
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity }}
          className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-green-400" />
        </motion.div>
        <div className="flex-1 text-left">
          <p className="text-green-300 font-bold text-sm">Daily reminders on</p>
          <p className="text-green-400/50 text-[10px] font-mono">Nudge at {time} every day · tap to change</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-green-400/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 pb-4">
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="flex-1 bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm
                           focus:outline-none focus:border-green-500/50 transition-all" />
              <motion.button whileTap={{ scale: 0.95 }} onClick={saveTime}
                className="px-5 py-2.5 rounded-xl bg-green-500/25 border border-green-500/35 text-green-300 text-sm font-bold
                           hover:bg-green-500/35 transition-all whitespace-nowrap">
                Save time
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (isDenied) return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-red-400/15 bg-red-500/5">
      <BellOff className="w-4 h-4 text-red-400/50 shrink-0" />
      <div>
        <p className="text-red-300/70 text-xs font-bold">Notifications blocked</p>
        <p className="text-red-400/40 text-[10px] font-mono">Browser settings → Notifications → Allow for this site</p>
      </div>
    </div>
  );

  // Default — simple one-tap prompt
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      onClick={allow}
      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-violet-400/30 bg-violet-500/10
                 hover:bg-violet-500/15 transition-all text-left"
      style={{ boxShadow: "0 0 20px rgba(139,92,246,0.12)" }}
    >
      <motion.div
        animate={{ rotate: [0, 12, -12, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30
                   flex items-center justify-center shrink-0"
      >
        <Bell className="w-6 h-6 text-violet-400" />
      </motion.div>
      <div className="flex-1">
        <p className="text-white font-black text-sm">Get daily reminders</p>
        <p className="text-white/35 text-[10px] font-mono">One tap → never forget your challenge again</p>
      </div>
      <div className="shrink-0 px-3 py-1.5 rounded-xl bg-violet-500/25 border border-violet-500/35">
        <span className="text-violet-300 text-xs font-bold">Allow</span>
      </div>
    </motion.button>
  );
};



// Flame streak badge
const StreakBadge = ({ streak }: { streak: number }) => {
  const c = STREAK_COLOR(streak);
  return (
    <motion.div
      animate={{ scale: streak > 0 ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 2, repeat: Infinity }}
      className="flex items-center gap-2 px-4 py-2 rounded-2xl border"
      style={{
        background: `linear-gradient(135deg, ${c.from}18, ${c.to}10)`,
        borderColor: `${c.from}40`,
        boxShadow: streak > 0 ? `0 0 20px ${c.glow}25` : "none",
      }}
    >
      <motion.div
        animate={streak > 0 ? { rotate: [-5, 5, -5] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Flame className="w-5 h-5" style={{ color: c.from }} />
      </motion.div>
      <div>
        <p className="font-black text-xl leading-none" style={{ color: c.from }}>
          {streak}
        </p>
        <p className="text-[9px] font-mono" style={{ color: `${c.from}80` }}>
          day streak · {c.label}
        </p>
      </div>
    </motion.div>
  );
};

// Progress ring
const ProgressRing = ({
  completed, total, streak,
}: { completed: number; total: number; streak: number }) => {
  const c    = STREAK_COLOR(streak);
  const pct  = total > 0 ? completed / total : 0;
  const r    = 42;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="56" cy="56" r={r}
          fill="none"
          stroke={`url(#ring-grad)`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c.from} />
            <stop offset="100%" stopColor={c.to} />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        <p className="text-2xl font-black text-white">{completed}</p>
        <p className="text-[9px] text-white/30 font-mono">of {total}</p>
      </div>
    </div>
  );
};

// Milestone row
const MilestoneBar = ({ completed, streak }: { completed: number; streak: number }) => {
  const c = STREAK_COLOR(streak);
  return (
    <div className="flex items-center justify-between gap-1 px-1">
      {MILESTONES.map((m) => {
        const reached  = completed >= m;
        const isCurrent = completed < m && (MILESTONES[MILESTONES.indexOf(m) - 1] ?? 0) <= completed;
        return (
          <div key={m} className="flex flex-col items-center gap-1.5">
            <motion.div
              animate={reached ? { scale: [1, 1.2, 1], rotate: [0, 10, 0] } : {}}
              transition={{ duration: 0.5 }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all
                          ${reached
                            ? "border-transparent shadow-lg"
                            : isCurrent
                              ? "border-white/25 bg-white/5"
                              : "border-white/8 bg-white/3 opacity-40"}`}
              style={reached ? {
                background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
                boxShadow: `0 0 14px ${c.glow}50`,
              } : {}}
            >
              {reached
                ? <Star className="w-4 h-4 text-white fill-white" />
                : isCurrent
                ? <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                : <span className="w-1.5 h-1.5 rounded-full bg-white/20 block" />}
            </motion.div>
            <p className={`text-[8px] font-mono font-bold ${reached ? c.text : "text-white/20"}`}>
              D{m}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// Day dot grid
const DayGrid = ({
  days, currentDay, onDayClick,
}: {
  days: ChallengeDay[];
  currentDay: number;
  onDayClick: (day: ChallengeDay | null, dayNum: number) => void;
}) => {
  const streak = getStreak(days);
  const c      = STREAK_COLOR(streak);
  const dayMap = Object.fromEntries(days.map(d => [d.day_number, d]));

  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 21 }, (_, i) => i + 1).map(num => {
        const d      = dayMap[num];
        const isFuture = num > currentDay;
        const status: DayStatus =
          d?.status ?? (num < currentDay ? "missed" : "pending");
        const isToday = num === currentDay;

        const bg =
          status === "completed"  ? `linear-gradient(135deg, ${c.from}, ${c.to})`  :
          status === "recovered"  ? "linear-gradient(135deg, #10b981, #34d399)"    :
          status === "missed"     ? "linear-gradient(135deg, #ef444480, #f87171a0)":
          isToday                 ? "rgba(255,255,255,0.12)"                        :
          "rgba(255,255,255,0.04)";

        const border =
          status === "completed"  ? `${c.from}60`    :
          status === "recovered"  ? "#10b98160"      :
          status === "missed"     ? "#ef444460"      :
          isToday                 ? "rgba(255,255,255,0.3)" :
          "rgba(255,255,255,0.08)";

        return (
          <motion.button
            key={num}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.08 }}
            onClick={() => onDayClick(d ?? null, num)}
            disabled={isFuture}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-xl border transition-all disabled:cursor-not-allowed"
            style={{ background: bg, borderColor: border,
                     boxShadow: (status === "completed" || status === "recovered") ? `0 0 10px ${c.glow}30` : "none" }}
          >
            <span className="text-[10px] font-black text-white/80 leading-none">{num}</span>
            <span className="flex items-center justify-center h-3">
              {status === "completed"  ? <Check      className="w-2.5 h-2.5 text-white/90" />            :
               status === "recovered"  ? <RotateCcw  className="w-2.5 h-2.5 text-white/90" />            :
               status === "missed"     ? <AlertCircle className="w-2.5 h-2.5 text-white/90" />            :
               isToday                 ? <ChevronRight className="w-2.5 h-2.5 text-white/70" />           :
               <span className="w-1 h-1 rounded-full bg-white/20 block" />}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

// Surprise box
const SurpriseBox = ({
  day, onOpen,
}: { day: ChallengeDay; onOpen: (id: string) => void }) => {
  const [opened, setOpened] = useState(day.surprise_opened);

  if (!isSurpriseDay(day.day_number)) return null;

  const handleOpen = async () => {
    const s = pickSurprise();
    await supabase.from("challenge_days").update({
      surprise_opened: true, surprise_type: s.type, surprise_content: s.content,
    }).eq("id", day.id);
    setOpened(true);
    onOpen(day.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-4 rounded-2xl border ${opened
        ? "bg-yellow-400/8 border-yellow-400/25"
        : "bg-gradient-to-br from-yellow-400/15 to-amber-400/8 border-yellow-400/35"}`}
    >
      {!opened ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleOpen}
          className="w-full flex items-center gap-3"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-12 h-12 rounded-2xl bg-yellow-400/20 border border-yellow-400/30
                       flex items-center justify-center shrink-0"
          >
            <Gift className="w-6 h-6 text-yellow-400" />
          </motion.div>
          <div className="text-left flex-1">
            <p className="text-yellow-300 font-black text-sm">Surprise Box!</p>
            <p className="text-yellow-400/50 text-[10px] font-mono">Tap to open your Day {day.day_number} surprise</p>
          </div>
          <Sparkles className="w-4 h-4 text-yellow-400 ml-auto" />
        </motion.button>
      ) : (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: day.surprise_type === "shield" ? "rgba(139,92,246,0.15)"
                : day.surprise_type === "prompt" ? "rgba(59,130,246,0.15)"
                : day.surprise_type === "encouragement" ? "rgba(239,68,68,0.15)"
                : "rgba(250,204,21,0.15)",
              borderColor: day.surprise_type === "shield" ? "rgba(139,92,246,0.3)"
                : day.surprise_type === "prompt" ? "rgba(59,130,246,0.3)"
                : day.surprise_type === "encouragement" ? "rgba(239,68,68,0.3)"
                : "rgba(250,204,21,0.3)",
            }}>
            {day.surprise_type === "shield"
              ? <Shield    className="w-5 h-5 text-purple-400" />
              : day.surprise_type === "prompt"
              ? <BookOpen  className="w-5 h-5 text-blue-400"   />
              : day.surprise_type === "encouragement"
              ? <Heart     className="w-5 h-5 text-red-400"    />
              : <Sparkles  className="w-5 h-5 text-yellow-400" />}
          </div>
          <div>
            <p className="text-[9px] text-yellow-400/50 font-mono uppercase tracking-wider mb-1">
              {day.surprise_type === "shield" ? "Grace Gift"
                : day.surprise_type === "prompt" ? "Reflection"
                : day.surprise_type === "encouragement" ? "Encouragement"
                : "Word of Inspiration"}
            </p>
            <p className="text-yellow-200/80 text-sm leading-relaxed">{day.surprise_content}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ── Log day modal ─────────────────────────────────────────────────────────────
const LogDayModal = ({
  dayNum, enrollment, existingDay, onClose, onSaved,
}: {
  dayNum: number;
  enrollment: Enrollment;
  existingDay: ChallengeDay | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const isBible  = enrollment.challenge_type === "bible" || enrollment.challenge_type === "both";
  const isGospel = enrollment.challenge_type === "gospel" || enrollment.challenge_type === "both";
  const suggestion = todaySuggestion();

  const [bibleBook,    setBibleBook   ] = useState(existingDay?.bible_book    ?? "");
  const [bibleChapter, setBibleChapter] = useState(String(existingDay?.bible_chapter ?? ""));
  const [bibleVerse,   setBibleVerse  ] = useState(existingDay?.bible_verse   ?? "");
  const [bibleNote,    setBibleNote   ] = useState(existingDay?.bible_note    ?? "");
  const [gospelSong,   setGospelSong  ] = useState(existingDay?.gospel_song   ?? "");
  const [gospelArtist, setGospelArtist] = useState(existingDay?.gospel_artist ?? "");
  const [gospelNote,   setGospelNote  ] = useState(existingDay?.gospel_note   ?? "");
  const [saving, setSaving] = useState(false);

  const useSuggestion = () => {
    setGospelSong(suggestion.song);
    setGospelArtist(suggestion.artist);
  };

  const isRecovery = existingDay?.status === "missed";

  const canSave =
    (!isBible  || bibleBook.trim())  &&
    (!isGospel || gospelSong.trim());

  const handleSave = async () => {
    setSaving(true);
    const now  = new Date().toISOString();
    const data: Partial<ChallengeDay> = {
      status:        isRecovery ? "recovered" : "completed",
      logged_at:     now,
      recovered_at:  isRecovery ? now : null,
      bible_book:    isBible  ? bibleBook.trim()  || null : null,
      bible_chapter: isBible  ? parseInt(bibleChapter) || null : null,
      bible_verse:   isBible  ? bibleVerse.trim() || null : null,
      bible_note:    isBible  ? bibleNote.trim()  || null : null,
      gospel_song:   isGospel ? gospelSong.trim() || null : null,
      gospel_artist: isGospel ? gospelArtist.trim() || null : null,
      gospel_note:   isGospel ? gospelNote.trim()  || null : null,
    };

    if (existingDay) {
      await supabase.from("challenge_days").update(data).eq("id", existingDay.id);
    } else {
      const row = {
        id:            genId(),
        enrollment_id: enrollment.id,
        player_name:   enrollment.player_name,
        day_number:    dayNum,
        due_date:      todayDate(),
        surprise_opened: false,
        ...data,
      };
      await supabase.from("challenge_days").insert(row);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 60, scale: 0.97 }}
        className="w-full max-w-sm rounded-3xl border border-white/15 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #1a1a24 0%, #13131a 100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="text-white font-black text-lg">
              {isRecovery ? "⏮️ Recover" : "✍️ Log"} Day {dayNum}
            </p>
            <p className="text-white/30 text-[10px] font-mono">
              {isRecovery ? "Recovering a missed day" : "Mark today's progress"}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors">
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>

          {/* ── GOSPEL ── */}
          {isGospel && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Music className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <p className="text-white font-black text-sm">Gospel Song</p>
              </div>

              {/* Song suggestion — play link + pre-fill */}
              <div className="flex gap-2">
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(suggestion.song + " " + suggestion.artist)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-purple-400/25 bg-purple-400/8 text-left hover:bg-purple-400/15 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                    <Play className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-purple-300 font-bold text-xs">Today's suggestion</p>
                    <p className="text-white/60 text-xs truncate">{suggestion.song} — {suggestion.artist}</p>
                  </div>
                </a>
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={useSuggestion}
                  title="Use this song"
                  className="w-10 shrink-0 flex items-center justify-center rounded-xl border border-purple-400/25 bg-purple-400/8 hover:bg-purple-400/20 transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                </motion.button>
              </div>

              <input
                value={gospelSong}
                onChange={e => setGospelSong(e.target.value)}
                placeholder="Song name *"
                className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white text-sm
                           placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-all"
              />
              <input
                value={gospelArtist}
                onChange={e => setGospelArtist(e.target.value)}
                placeholder="Artist (optional)"
                className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white text-sm
                           placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-all"
              />
              <textarea
                value={gospelNote}
                onChange={e => setGospelNote(e.target.value)}
                placeholder="What moved you? (optional)"
                rows={2}
                className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white text-sm
                           placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
              />
            </div>
          )}

          {/* Divider */}
          {isBible && isGospel && <div className="h-px bg-white/8" />}

          {/* ── BIBLE ── */}
          {isBible && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-white font-black text-sm">Bible Reading</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={bibleBook}
                  onChange={e => setBibleBook(e.target.value)}
                  placeholder="Book *"
                  className="col-span-3 bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white text-sm
                             placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-all"
                />
                <input
                  value={bibleChapter}
                  onChange={e => setBibleChapter(e.target.value)}
                  placeholder="Ch."
                  type="number"
                  className="bg-white/8 border border-white/12 rounded-xl px-3 py-3 text-white text-sm
                             placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-all"
                />
                <input
                  value={bibleVerse}
                  onChange={e => setBibleVerse(e.target.value)}
                  placeholder="Verse(s)"
                  className="col-span-2 bg-white/8 border border-white/12 rounded-xl px-3 py-3 text-white text-sm
                             placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-all"
                />
              </div>
              <textarea
                value={bibleNote}
                onChange={e => setBibleNote(e.target.value)}
                placeholder="What did you learn? (optional)"
                rows={2}
                className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white text-sm
                           placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
              />
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="px-5 pb-5 pt-2 border-t border-white/8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all
                        ${canSave
                          ? isRecovery
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                            : "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25"
                          : "bg-white/5 border border-white/8 text-white/25 cursor-not-allowed"}`}
          >
            {saving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</>
            ) : isRecovery ? (
              <><RotateCcw className="w-4 h-4" />Recover Day {dayNum}</>
            ) : (
              <><Check className="w-4 h-4" />Mark Day {dayNum} Complete</>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Day detail sheet ──────────────────────────────────────────────────────────
const DaySheet = ({
  dayNum, day, enrollment, currentDay, onClose, onLog, onRecover,
}: {
  dayNum: number; day: ChallengeDay | null; enrollment: Enrollment;
  currentDay: number; onClose: () => void;
  onLog: () => void; onRecover: () => void;
}) => {
  const isFuture   = dayNum > currentDay;
  const isToday    = dayNum === currentDay;
  const isMissed   = day?.status === "missed" || (!day && dayNum < currentDay);
  const isDone     = day?.status === "completed" || day?.status === "recovered";
  const isGospel   = enrollment.challenge_type === "gospel" || enrollment.challenge_type === "both";
  const isBible    = enrollment.challenge_type === "bible"  || enrollment.challenge_type === "both";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        className="w-full max-w-sm rounded-t-3xl border-t border-x border-white/12 p-5 pb-8"
        style={{ background: "linear-gradient(180deg, #1a1a24 0%, #13131a 100%)" }}
      >
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-black text-lg">Day {dayNum}</p>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border
            ${isDone     ? "bg-green-500/12 text-green-400 border-green-500/25"  :
              isMissed   ? "bg-red-500/12 text-red-400 border-red-500/25"       :
              isToday    ? "bg-blue-500/12 text-blue-400 border-blue-500/25"    :
              "bg-white/5 text-white/30 border-white/10"}`}>
            {isDone ? (day?.status === "recovered" ? "recovered" : "done") : isMissed ? "missed" : isToday ? "today" : "upcoming"}
          </span>
        </div>

        {/* Done — show logged data */}
        {isDone && day && (
          <div className="flex flex-col gap-3 mb-4">
            {isGospel && day.gospel_song && (
              <div className="p-3 rounded-xl bg-purple-500/8 border border-purple-500/20">
                <p className="text-[9px] text-purple-400/60 font-mono uppercase mb-1">Gospel</p>
                <p className="text-white font-bold text-sm">{day.gospel_song}</p>
                {day.gospel_artist && <p className="text-white/40 text-xs">{day.gospel_artist}</p>}
                {day.gospel_note && <p className="text-white/55 text-xs mt-1.5 italic">"{day.gospel_note}"</p>}
              </div>
            )}
            {isBible && day.bible_book && (
              <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <p className="text-[9px] text-amber-400/60 font-mono uppercase mb-1">Bible</p>
                <p className="text-white font-bold text-sm">
                  {day.bible_book} {day.bible_chapter}{day.bible_verse ? `:${day.bible_verse}` : ""}
                </p>
                {day.bible_note && <p className="text-white/55 text-xs mt-1.5 italic">"{day.bible_note}"</p>}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {!isFuture && !isDone && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={isMissed ? onRecover : onLog}
            className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2
                        ${isMissed
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                          : "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/20"}`}
          >
            {isMissed ? <><RotateCcw className="w-4 h-4" />Recover this day</> : <><Check className="w-4 h-4" />Log today</>}
          </motion.button>
        )}
        {isFuture && (
          <div className="flex items-center gap-2 text-white/25 text-sm py-2">
            <Lock className="w-4 h-4" /><span className="font-mono">Unlocks on day {dayNum}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ── Enrollment screen ─────────────────────────────────────────────────────────
const EnrollScreen = ({ playerName, onEnrolled }: { playerName: string; onEnrolled: () => void }) => {
  const [type,     setType    ] = useState<ChallengeType>("both");
  const [loading,  setLoading ] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    const id = genId();
    await supabase.from("challenge_enrollments").insert({
      id, player_name: playerName.toLowerCase(),
      challenge_type: type, started_at: new Date().toISOString(), is_active: true,
    });
    onEnrolled();
    setLoading(false);
  };

  const options: { id: ChallengeType; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: "both",   icon: <div className="flex gap-0.5"><BookOpen className="w-5 h-5 text-violet-300" /><Music className="w-5 h-5 text-purple-300" /></div>,
                    label: "Bible + Gospel",    desc: "Read & listen every day"    },
    { id: "bible",  icon: <BookOpen className="w-6 h-6 text-amber-300" />,
                    label: "Bible Only",        desc: "Daily scripture reading"    },
    { id: "gospel", icon: <Music className="w-6 h-6 text-purple-300" />,
                    label: "Gospel Only",       desc: "Daily worship music"        },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6">

      {/* Hero */}
      <div className="text-center py-6">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-24 h-24 rounded-3xl mx-auto mb-5 flex items-center justify-center border border-violet-400/30"
          style={{ background: "linear-gradient(135deg, #7c3aed20, #a855f715)" }}
        >
          <Flame className="w-12 h-12 text-violet-400" />
        </motion.div>
        <h2 className="text-3xl font-black text-white mb-2">21-Day Challenge</h2>
        <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
          21 days of intentional faith. Read the Word. Worship daily. Stay consistent.
        </p>
      </div>

      {/* Type selector */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">Choose your challenge</p>
        {options.map(opt => (
          <motion.button key={opt.id} whileTap={{ scale: 0.98 }}
            onClick={() => setType(opt.id)}
            className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all
                        ${type === opt.id
                          ? "border-violet-400/50 bg-violet-400/12"
                          : "border-white/8 bg-white/4 hover:border-white/18"}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                            bg-white/8 border border-white/12">
              {opt.icon}
            </div>
            <div className="flex-1">
              <p className={`font-black text-sm ${type === opt.id ? "text-white" : "text-white/70"}`}>{opt.label}</p>
              <p className="text-white/30 text-[10px] font-mono">{opt.desc}</p>
            </div>
            {type === opt.id && <Check className="w-4 h-4 text-violet-400 shrink-0" />}
          </motion.button>
        ))}
      </div>

      {/* Rules */}
      <div className="p-4 rounded-2xl bg-blue-500/8 border border-blue-400/20">
        <p className="text-blue-300 font-bold text-xs mb-2">How it works</p>
        <div className="flex flex-col gap-1.5">
          {[
            "Log each day to keep your streak alive",
            "Miss a day? Recover it later — no penalty",
            "Complete all 21 days to earn the Champion badge",
            "Surprise boxes appear at key milestones",
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-blue-400 text-xs mt-0.5">✦</span>
              <p className="text-blue-400/70 text-[11px] font-mono">{r}</p>
            </div>
          ))}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleStart}
        disabled={loading}
        className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2
                   bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500
                   text-white shadow-xl shadow-violet-500/30 disabled:opacity-50"
      >
        {loading
          ? <><RefreshCw className="w-4 h-4 animate-spin" />Starting…</>
          : <><Flame className="w-5 h-5" />Begin the Journey</>}
      </motion.button>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function Challenge21Page() {
  const router = useRouter();

  const [myName,      setMyName    ] = useState("");
  const [enrollment,  setEnrollment] = useState<Enrollment | null>(null);
  const [days,        setDays      ] = useState<ChallengeDay[]>([]);
  const [loading,     setLoading   ] = useState(true);

  // Modal state
  const [logModal,    setLogModal  ] = useState<{ dayNum: number; day: ChallengeDay | null } | null>(null);
  const [sheetDay,    setSheetDay  ] = useState<{ dayNum: number; day: ChallengeDay | null } | null>(null);
  const [abandonModal,setAbandonModal] = useState(false);

  // ── Load ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const name = localStorage.getItem("fow_my_name") ?? "";
    setMyName(name);
    if (!name) { setLoading(false); return; }

    const { data: enr } = await supabase.from("challenge_enrollments")
      .select("*").eq("player_name", name.toLowerCase()).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    setEnrollment(enr ?? null);

    if (enr) {
      const { data: dayRows } = await supabase.from("challenge_days")
        .select("*").eq("enrollment_id", enr.id).order("day_number");
      setDays(dayRows ?? []);

      // Auto-mark missed days
      await autoMarkMissed(enr, dayRows ?? []);
    }
    setLoading(false);
  }, []);

  // Auto-mark past days as missed if not logged
  const autoMarkMissed = async (enr: Enrollment, existingDays: ChallengeDay[]) => {
    const currentDay = getDayNumber(enr);
    const dayMap = Object.fromEntries(existingDays.map(d => [d.day_number, d]));
    const toInsert: any[] = [];

    for (let d = 1; d < currentDay; d++) {
      if (!dayMap[d]) {
        const due = new Date(enr.started_at);
        due.setDate(due.getDate() + d - 1);
        toInsert.push({
          id: genId(),
          enrollment_id: enr.id,
          player_name: enr.player_name,
          day_number: d,
          status: "missed",
          due_date: due.toISOString().split("T")[0],
          surprise_opened: false,
        });
      }
    }

    if (toInsert.length > 0) {
      await supabase.from("challenge_days").upsert(toInsert, { onConflict: "enrollment_id,day_number" });
    }
  };

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────
  const currentDay = enrollment ? getDayNumber(enrollment) : 1;
  const completed  = getCompletedCount(days);
  const missed     = getMissedCount(days);
  const streak     = getStreak(days);
  const c          = STREAK_COLOR(streak);
  const isComplete = enrollment ? (completed === 21) : false;
  const todayDay   = days.find(d => d.day_number === currentDay);
  const todayDone  = todayDay?.status === "completed" || todayDay?.status === "recovered";

  // ── Daily notification scheduler ──────────────────────────────
  // Fires a notification if it's past reminder time and user hasn't logged today
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!enrollment) return;

    const reminderTime = localStorage.getItem("fow_reminder_time") || "20:00";
    const [rHour, rMin] = reminderTime.split(":").map(Number);
    const now  = new Date();
    const hNow = now.getHours();
    const mNow = now.getMinutes();

    const lastNotif = localStorage.getItem("fow_last_notif_date");
    const today     = new Date().toDateString();
    if (lastNotif === today) return; // already sent today

    const isPastReminder = hNow > rHour || (hNow === rHour && mNow >= rMin);
    if (!isPastReminder) return;

    const todayLogged = days.find(d => d.day_number === currentDay &&
      (d.status === "completed" || d.status === "recovered"));
    if (todayLogged) return; // already done

    localStorage.setItem("fow_last_notif_date", today);

    const messages = streak >= 7
      ? { title: `🔥 ${streak}-Day Streak at Risk!`, body: `${myName}, don't break your ${streak}-day streak! Complete Day ${currentDay} now.`, type: "streak_warning" }
      : missed > 0
      ? { title: `⏮️ ${missed} Day${missed > 1 ? "s" : ""} to Recover`, body: `You have missed days to recover. Don't let them pile up!`, type: "challenge_reminder" }
      : { title: `📖 Day ${currentDay} Challenge Awaits`, body: `${myName}, your daily faith challenge is waiting. Just 5 minutes!`, type: "challenge_reminder" };

    // Slight delay so it doesn't fire immediately on page load
    setTimeout(() => {
      const options: NotificationOptions = {
        body: messages.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-96x96.png",
        tag: "fow-daily-check",
        requireInteraction: messages.type === "streak_warning",
      };
      (options as any).vibrate = messages.type === "streak_warning" ? [300, 100, 300] : [200];
      new Notification(messages.title, options);
    }, 3000);
  }, [enrollment, days, currentDay, streak, missed, myName]);

  // ── Share card — generates a branded image + sends to WhatsApp ──
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);
  const [shareModal, setShareModal] = useState(false);
  const [shareImg,   setShareImg  ] = useState<string | null>(null);

  const generateShareCard = useCallback(async () => {
    const canvas = document.createElement("canvas");
    canvas.width  = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    const sc  = STREAK_COLOR(streak);

    // ── Background ──────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, "#0d0d10");
    bgGrad.addColorStop(1, "#130813");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Ambient glow blob
    const glowGrad = ctx.createRadialGradient(540, 400, 0, 540, 400, 600);
    glowGrad.addColorStop(0, `${sc.from}22`);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // ── Outer card border ───────────────────────────────────────
    ctx.strokeStyle = `${sc.from}50`;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    roundRect(ctx, 40, 40, 1000, 1000, 48);
    ctx.stroke();

    // Inner border
    ctx.strokeStyle = `${sc.from}20`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    roundRect(ctx, 56, 56, 968, 968, 40);
    ctx.stroke();

    // ── Header label ────────────────────────────────────────────
    ctx.font         = "bold 28px system-ui, sans-serif";
    ctx.fillStyle    = `${sc.from}90`;
    ctx.textAlign    = "center";
    ctx.letterSpacing = "6px";
    ctx.fillText("21-DAY FAITH CHALLENGE", 540, 130);
    ctx.letterSpacing = "0px";

    // ── Avatar (using DiceBear) ──────────────────────────────────
    try {
      const avatarSrc = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(myName)}&size=180&backgroundColor=0f0f12&radius=12`;
      const img = await loadImage(avatarSrc);
      // Avatar circle clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(540, 310, 100, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 440, 210, 200, 200);
      ctx.restore();
      // Avatar ring
      ctx.strokeStyle = sc.from;
      ctx.lineWidth   = 5;
      ctx.beginPath();
      ctx.arc(540, 310, 102, 0, Math.PI * 2);
      ctx.stroke();
    } catch {}

    // ── Player name ──────────────────────────────────────────────
    ctx.font      = "900 64px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(myName, 540, 490);

    // ── Day badge ────────────────────────────────────────────────
    const dayGrad = ctx.createLinearGradient(340, 530, 740, 530);
    dayGrad.addColorStop(0, sc.from);
    dayGrad.addColorStop(1, sc.to);
    ctx.fillStyle = dayGrad;
    ctx.beginPath();
    roundRect(ctx, 340, 530, 400, 100, 50);
    ctx.fill();

    ctx.font      = "900 52px system-ui, sans-serif";
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.fillText(`DAY ${currentDay} OF 21`, 540, 596);

    // ── Stats row ────────────────────────────────────────────────
    const stats = [
      { label: "COMPLETED", val: `${completed}/21` },
      { label: "STREAK",    val: `${streak} days`  },
      { label: "PROGRESS",  val: `${Math.round((completed / 21) * 100)}%` },
    ];

    stats.forEach((s, i) => {
      const x = 200 + i * 340;
      // Box
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      roundRect(ctx, x - 110, 665, 220, 130, 20);
      ctx.fill();
      ctx.strokeStyle = `${sc.from}30`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      roundRect(ctx, x - 110, 665, 220, 130, 20);
      ctx.stroke();
      // Value
      ctx.font      = "900 42px system-ui, sans-serif";
      ctx.fillStyle = sc.from;
      ctx.textAlign = "center";
      ctx.fillText(s.val, x, 720);
      // Label
      ctx.font      = "600 20px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(s.label, x, 768);
    });

    // ── Progress bar ─────────────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    roundRect(ctx, 120, 838, 840, 20, 10);
    ctx.fill();

    const progGrad = ctx.createLinearGradient(120, 0, 960, 0);
    progGrad.addColorStop(0, sc.from);
    progGrad.addColorStop(1, sc.to);
    ctx.fillStyle = progGrad;
    ctx.beginPath();
    roundRect(ctx, 120, 838, 840 * (completed / 21), 20, 10);
    ctx.fill();

    // ── Bible verse ───────────────────────────────────────────────
    ctx.font      = "italic 26px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "center";
    wrapText(ctx, '"I can do all things through Christ who strengthens me."', 540, 900, 800, 36);

    ctx.font      = "bold 22px system-ui, sans-serif";
    ctx.fillStyle = `${sc.from}80`;
    ctx.fillText("— Philippians 4:13", 540, 950);

    // ── Branding footer ───────────────────────────────────────────
    ctx.font      = "bold 24px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillText("Friend of a Week  ·  #21DayChallenge", 540, 1008);

    const dataUrl = canvas.toDataURL("image/png");
    setShareImg(dataUrl);
    setShareModal(true);
  }, [myName, currentDay, completed, streak, enrollment]);

  // Helpers for canvas
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src     = src;
    });
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
    const words = text.split(" ");
    let line = "";
    let cy = y;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > maxW && line !== "") {
        ctx.fillText(line.trim(), x, cy);
        line = word + " ";
        cy += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, cy);
  }

  // Send the generated card to WhatsApp
  const handleShareToWhatsApp = () => {
    const text = `🔥 I'm on Day ${currentDay} of my 21-Day Faith Challenge!\n`
      + `✅ ${completed}/21 days · ${streak}-day streak\n`
      + `"I can do all things through Christ who strengthens me." — Phil 4:13 💪\n`
      + `#21DayChallenge #FriendOfAWeek`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  // ── Surprise box update ───────────────────────────────────────
  const handleSurpriseOpen = async (dayId: string) => {
    const { data } = await supabase.from("challenge_days").select("*").eq("id", dayId).single();
    if (data) setDays(prev => prev.map(d => d.id === dayId ? data : d));
  };

  // ── Render ────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ rotate: { duration: 1.5, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }}
        className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center"
      >
        <Flame className="w-8 h-8 text-violet-400" />
      </motion.div>
    </div>
  );

  // No name
  if (!myName) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-violet-400" />
        </div>
        <p className="text-white font-black text-xl mb-2">Set your name first</p>
        <p className="text-white/30 text-sm mb-5">You need a name to track your challenge.</p>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => router.push("/game/profile")}
          className="px-6 py-3 bg-violet-500/20 border border-violet-500/30 rounded-2xl text-violet-300 font-bold">
          Go to Profile →
        </motion.button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      {/* BG */}
      <div className="fixed inset-0 pointer-events-none -z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-900/12 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/3 left-0 w-72 h-72 bg-amber-900/8 rounded-full blur-[110px]" />
        <div className="absolute top-1/2 left-1/3 w-60 h-60 bg-emerald-900/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-7 pb-20 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/25">
              <Flame className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] font-mono text-violet-400 tracking-widest uppercase">21-Day Challenge</span>
            </div>
            {enrollment && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={generateShareCard}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/15 border border-green-500/25 hover:bg-green-500/25 transition-colors">
                <Share2 className="w-3 h-3 text-green-400" />
                <span className="text-[10px] text-green-400 font-bold">Share</span>
              </motion.button>
            )}
          </div>
          <h1 className="text-3xl font-black leading-tight">
            <span className="text-white">Faith </span>
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Journey</span>
          </h1>
        </motion.div>

        {/* ── ENROLL or DASHBOARD ── */}
        {!enrollment ? (
          <EnrollScreen playerName={myName} onEnrolled={load} />
        ) : (
          <div className="flex flex-col gap-5">

            {/* ── COMPLETION BANNER ── */}
            {isComplete && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-6 rounded-3xl text-center"
                style={{ background: "linear-gradient(135deg, #f59e0b20, #fbbf2415)", border: "1px solid #f59e0b40",
                         boxShadow: "0 0 40px #f59e0b25" }}
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 rounded-3xl mx-auto mb-3 flex items-center justify-center border-2 border-yellow-400/40"
                  style={{ background: "linear-gradient(135deg, #f59e0b30, #fbbf2420)" }}
                >
                  <Trophy className="w-10 h-10 text-yellow-400" />
                </motion.div>
                <p className="text-yellow-300 font-black text-xl mb-1">Challenge Complete!</p>
                <p className="text-yellow-400/60 text-sm">You finished all 21 days. Champion badge earned!</p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  {[Star, Shield, Trophy, Shield, Star].map((Icon, i) => (
                    <motion.div key={i} animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}>
                      <Icon className="w-5 h-5 text-yellow-400 fill-yellow-400/30" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── STATS CARD ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-3xl border border-white/10 bg-white/4"
              style={{ boxShadow: streak > 0 ? `0 0 30px ${c.glow}12` : "none" }}
            >
              <div className="flex items-center gap-4">
                <ProgressRing completed={completed} total={21} streak={streak} />

                <div className="flex-1 flex flex-col gap-2.5">
                  <StreakBadge streak={streak} />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col items-center py-2 rounded-xl bg-white/5 border border-white/8">
                      <span className="text-white font-black text-lg">{completed}</span>
                      <span className="text-[8px] text-white/25 font-mono uppercase">Done</span>
                    </div>
                    <div className="flex flex-col items-center py-2 rounded-xl bg-red-400/8 border border-red-400/20">
                      <span className="text-red-300 font-black text-lg">{missed}</span>
                      <span className="text-[8px] text-red-400/40 font-mono uppercase">Recover</span>
                    </div>
                  </div>

                  <p className="text-[9px] text-white/20 font-mono">
                    Day {currentDay} of 21 ·{" "}
                    {enrollment.challenge_type === "both"   ? "Bible + Gospel"
                      : enrollment.challenge_type === "bible" ? "Bible"
                      : "Gospel"}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-2 bg-white/6 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(completed / 21) * 100}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${c.from}, ${c.to})` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-white/15 font-mono">0</span>
                <span className={`text-[8px] font-mono font-bold ${c.text}`}>{Math.round((completed / 21) * 100)}%</span>
                <span className="text-[8px] text-white/15 font-mono">21</span>
              </div>
            </motion.div>

            {/* ── MILESTONES ── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="p-4 rounded-2xl border border-white/8 bg-white/3">
              <p className="text-[9px] text-white/20 font-mono uppercase tracking-widest mb-3">✦ Milestones</p>
              <MilestoneBar completed={completed} streak={streak} />
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {MILESTONES.filter(m => completed >= m).map(m => (
                  <span key={m} className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-400/12 border border-yellow-400/25 text-yellow-300 font-mono">
                    {MILESTONE_LABEL[m]}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* ── TODAY'S CTA ── */}
            {!todayDone && !isComplete && (
              <motion.button
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setLogModal({ dayNum: currentDay, day: todayDay ?? null })}
                className="w-full p-5 rounded-3xl flex items-center gap-4 text-left"
                style={{
                  background: `linear-gradient(135deg, ${c.from}20, ${c.to}10)`,
                  border: `1px solid ${c.from}35`,
                  boxShadow: `0 0 24px ${c.glow}15`,
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `${c.from}20`, border: `1px solid ${c.from}30` }}
                >
                  {enrollment.challenge_type === "gospel"
                    ? <Music    className="w-7 h-7" style={{ color: c.from }} />
                    : enrollment.challenge_type === "bible"
                    ? <BookOpen className="w-7 h-7" style={{ color: c.from }} />
                    : <div className="flex gap-1">
                        <BookOpen className="w-4 h-4" style={{ color: c.from }} />
                        <Music    className="w-4 h-4" style={{ color: c.to   }} />
                      </div>}
                </motion.div>
                <div className="flex-1">
                  <p className="text-white font-black text-base">Day {currentDay} awaits!</p>
                  <p className="text-white/40 text-xs font-mono">Tap to log today's progress</p>
                </div>
                <ChevronRight className="w-5 h-5" style={{ color: c.from }} />
              </motion.button>
            )}

            {todayDone && !isComplete && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-4 rounded-2xl border border-green-500/25 bg-green-500/8 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-green-300 font-black text-sm">Day {currentDay} complete!</p>
                  <p className="text-green-400/50 text-[10px] font-mono">Come back tomorrow for Day {Math.min(currentDay + 1, 21)}</p>
                </div>
              </motion.div>
            )}

            {/* ── MUSIC PLAYER ── only for gospel/both */}
            {(enrollment.challenge_type === "gospel" || enrollment.challenge_type === "both") && (() => {
              const suggestion = todaySuggestion();
              return (
                <div>
                  <p className="text-[9px] text-white/20 font-mono uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Music className="w-3 h-3" />Today's Song
                  </p>
                  <YoutubePlayer song={suggestion.song} artist={suggestion.artist} />
                </div>
              );
            })()}

            {/* ── NOTIFICATION MANAGER ── */}
            <NotificationManager
              playerName={myName}
              currentDay={currentDay}
              streak={streak}
            />

            {/* ── MISSED DAYS RECOVERY ── */}
            {missed > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                  <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">
                    {missed} day{missed > 1 ? "s" : ""} to recover
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {days.filter(d => d.status === "missed").map(d => (
                    <motion.button
                      key={d.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setLogModal({ dayNum: d.day_number, day: d })}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-red-400/25 bg-red-400/8
                                 hover:bg-red-400/15 transition-all text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-400/15 border border-red-400/25 flex items-center justify-center font-black text-red-300 text-sm shrink-0">
                        {d.day_number}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">Day {d.day_number}</p>
                        <p className="text-red-400/50 text-[9px] font-mono">
                          {d.due_date ? `Originally due ${d.due_date}` : "Missed"} · tap to recover
                        </p>
                      </div>
                      <RotateCcw className="w-4 h-4 text-red-400/50 shrink-0" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* ── SURPRISE BOXES ── */}
            {days.filter(d => isSurpriseDay(d.day_number) && (d.status === "completed" || d.status === "recovered")).map(d => (
              <SurpriseBox key={d.id} day={d} onOpen={handleSurpriseOpen} />
            ))}

            {/* ── 21-DAY GRID ── */}
            <div>
              <p className="text-[9px] text-white/20 font-mono uppercase tracking-widest mb-3">✦ Your 21-Day Journey</p>
              <DayGrid
                days={days}
                currentDay={currentDay}
                onDayClick={(day, dayNum) => setSheetDay({ dayNum, day })}
              />
              <div className="flex items-center gap-4 mt-3 justify-center">
                {[
                  { color: `${c.from}`, label: "Done" },
                  { color: "#10b981",   label: "Recovered" },
                  { color: "#ef4444",   label: "Missed" },
                  { color: "rgba(255,255,255,0.25)", label: "Today" },
                ].map(leg => (
                  <div key={leg.label} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: leg.color }} />
                    <span className="text-[8px] text-white/25 font-mono">{leg.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CHALLENGE LEADERBOARD ── */}
            <ChallengeLeaderboard myName={myName} />

            {/* ── RESTART / ABANDON ── */}
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setAbandonModal(true)}
                className="text-[10px] text-white/20 hover:text-red-400 font-mono transition-colors"
              >
                Abandon &amp; restart challenge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SHARE CARD MODAL ── */}
      <AnimatePresence>
        {shareModal && shareImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
            onClick={e => { if (e.target === e.currentTarget) setShareModal(false); }}
          >
            <motion.div
              initial={{ y: 60, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 60, scale: 0.95 }}
              transition={{ type: "spring", bounce: 0.25 }}
              className="w-full max-w-sm rounded-3xl border border-white/15 overflow-hidden"
              style={{ background: "linear-gradient(180deg, #1a1a24 0%, #13131a 100%)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <p className="text-white font-black text-base">Your Progress Card</p>
                <button onClick={() => setShareModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors">
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>

              {/* Card preview */}
              <div className="px-5 pb-4">
                <img src={shareImg} alt="Progress card"
                  className="w-full rounded-2xl border border-white/10" />
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-6 flex flex-col gap-3">
                {/* Download */}
                <a
                  href={shareImg}
                  download={`fow-day${currentDay}-challenge.png`}
                  className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2
                             bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  Save image to device
                </a>

                {/* WhatsApp */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleShareToWhatsApp}
                  className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-white"
                  style={{ background: "linear-gradient(135deg, #25d366, #128c7e)", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}
                >
                  {/* WhatsApp icon */}
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Share to WhatsApp
                </motion.button>

                <p className="text-center text-[10px] text-white/20 font-mono">
                  Save the image first, then share it in WhatsApp with the message
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOG DAY MODAL ── */}
      <AnimatePresence>
        {logModal && enrollment && (
          <LogDayModal
            dayNum={logModal.dayNum}
            enrollment={enrollment}
            existingDay={logModal.day}
            onClose={() => setLogModal(null)}
            onSaved={load}
          />
        )}
      </AnimatePresence>

      {/* ── DAY SHEET ── */}
      <AnimatePresence>
        {sheetDay && enrollment && (
          <DaySheet
            dayNum={sheetDay.dayNum}
            day={sheetDay.day}
            enrollment={enrollment}
            currentDay={currentDay}
            onClose={() => setSheetDay(null)}
            onLog={() => { setSheetDay(null); setLogModal({ dayNum: sheetDay.dayNum, day: sheetDay.day }); }}
            onRecover={() => { setSheetDay(null); setLogModal({ dayNum: sheetDay.dayNum, day: sheetDay.day }); }}
          />
        )}
      </AnimatePresence>

      {/* ── ABANDON CONFIRM MODAL ── */}
      <AnimatePresence>
        {abandonModal && enrollment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
            onClick={e => { if (e.target === e.currentTarget) setAbandonModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 20, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className="w-full max-w-xs rounded-3xl border border-red-500/30 overflow-hidden"
              style={{ background: "linear-gradient(160deg, #1e1015 0%, #130d10 100%)" }}
            >
              {/* Icon header */}
              <div className="flex flex-col items-center pt-7 pb-4 px-6">
                <motion.div
                  animate={{ rotate: [-4, 4, -4], scale: [1, 1.06, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30
                             flex items-center justify-center mb-4"
                >
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </motion.div>
                <p className="text-white font-black text-lg text-center mb-1">Abandon Challenge?</p>
                <p className="text-white/40 text-sm text-center leading-relaxed">
                  All your progress — {completed} days, {streak}-day streak — will be lost. This cannot be undone.
                </p>
              </div>

              {/* Stats preview */}
              <div className="mx-5 mb-5 grid grid-cols-3 gap-2">
                {[
                  { icon: <Check className="w-3.5 h-3.5 text-emerald-400" />, val: completed, label: "Days done" },
                  { icon: <Flame className="w-3.5 h-3.5 text-orange-400" />,  val: streak,    label: "Streak"    },
                  { icon: <RotateCcw className="w-3.5 h-3.5 text-red-400" />, val: missed,    label: "To recover"},
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center py-2.5 rounded-xl bg-white/5 border border-white/8">
                    {s.icon}
                    <span className="text-white font-black text-base mt-0.5">{s.val}</span>
                    <span className="text-[8px] text-white/25 font-mono">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 px-5 pb-6">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setAbandonModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-white/12 bg-white/6
                             text-white font-bold text-sm hover:bg-white/10 transition-all"
                >
                  Keep going
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={async () => {
                    await supabase.from("challenge_enrollments")
                      .update({ is_active: false }).eq("id", enrollment.id);
                    setAbandonModal(false);
                    setEnrollment(null);
                    setDays([]);
                    load();
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/35
                             text-red-300 font-bold text-sm hover:bg-red-500/30 transition-all"
                >
                  Yes, abandon
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}