"use client";
// app/weekly/page.tsx — highlights the best of each completed week

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Zap, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { supabase, getPairs, getAgatambyi, getRankTier, type DBSession, type DBPair, type DBAgatambyi, type DBPlayerProfile } from "@/lib/supabase";

interface WeekSummary {
  session: DBSession;
  pairs: DBPair[];
  agatambyi: DBAgatambyi | null;
  mvp: DBPlayerProfile | null;    // most XP gained this week (from challenge answers)
  challengeWinner: { names: string[]; score: number } | null;
}

export default function WeeklyBestPage() {
  const [weeks,   setWeeks  ] = useState<WeekSummary[]>([]);
  const [open,    setOpen   ] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sessions } = await supabase.from("sessions").select("*")
        .eq("status","revealed").order("week_number", { ascending:false });

      if (!sessions) { setLoading(false); return; }

      const summaries: WeekSummary[] = await Promise.all(sessions.map(async (sess) => {
        const [pairs, ag] = await Promise.all([getPairs(sess.id), getAgatambyi(sess.id)]);

        // Find challenge winner for this session
        const { data: answers } = await supabase.from("challenge_answers").select("*")
          .eq("session_id", sess.id).not("score", "is", null).order("score", { ascending:false }).limit(1);
        const top = answers?.[0];
        const challengeWinner = top ? { names:[top.player_a_name, top.player_b_name], score: top.score ?? 0 } : null;

        // MVP = player with highest challenge XP this week (simplification: highest scorer in challenge)
        const mvpName = top?.player_a_name ?? null;
        let mvp: DBPlayerProfile | null = null;
        if (mvpName) {
          const { data } = await supabase.from("player_profiles").select("*")
            .eq("name", mvpName.toLowerCase()).maybeSingle();
          mvp = data;
        }

        return { session: sess, pairs, agatambyi: ag, mvp, challengeWinner };
      }));

      setWeeks(summaries);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }} className="text-3xl">⭐</motion.div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-5 h-5 text-purple-400"/>
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Weekly Best</span>
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">Week by </span>
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Week</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Highlights from every session.</p>
        </motion.div>

        {weeks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-white/30 text-sm font-mono">No completed weeks yet.</p>
          </div>
        ) : weeks.map((w, i) => {
          const isOpen = open === w.session.id;
          const kq = w.pairs.filter(p=>p.pair_type==="king-queen").length;
          return (
            <motion.div key={w.session.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:i*0.05 }} layout className="mb-3 rounded-2xl overflow-hidden">

              {/* Week header */}
              <motion.div whileHover={{ x:2 }} onClick={() => setOpen(isOpen ? null : w.session.id)}
                className={`flex items-center gap-4 p-4 cursor-pointer border transition-all
                            ${isOpen ? "bg-purple-500/12 border-purple-500/30" : "bg-white/5 border-white/8 hover:bg-white/8"}`}>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/20
                                border border-purple-500/25 flex items-center justify-center shrink-0">
                  <span className="text-xl font-black text-purple-300">{w.session.week_number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm">Week {w.session.week_number}</p>
                  <p className="text-[10px] text-white/30 font-mono mt-0.5">
                    {w.session.date} · {w.pairs.length} pairs · {kq} King×Queen
                  </p>
                </div>
                {w.agatambyi && (
                  <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/25">
                    <span className="text-[10px] text-yellow-400 font-mono">⭐ {w.agatambyi.name}</span>
                  </div>
                )}
                {isOpen ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0"/> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0"/>}
              </motion.div>

              {/* Expanded */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                    exit={{ opacity:0, height:0 }} transition={{ duration:0.22 }} className="overflow-hidden">
                    <div className="p-4 border-x border-b border-purple-500/20 bg-purple-500/5 flex flex-col gap-4">

                      {/* Challenge winner */}
                      {w.challengeWinner && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/15 border border-violet-500/25">
                          <span className="text-2xl">🏆</span>
                          <div>
                            <p className="text-[9px] text-violet-400/60 font-mono uppercase tracking-widest">Challenge Winners</p>
                            <p className="text-white font-bold text-sm">
                              {w.challengeWinner.names.join(" × ")}
                            </p>
                            <p className="text-[10px] text-violet-300 font-mono">Score: {w.challengeWinner.score}/100</p>
                          </div>
                        </div>
                      )}

                      {/* Agatambyi spotlight */}
                      {w.agatambyi && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                          <span className="text-2xl">⭐</span>
                          <div>
                            <p className="text-[9px] text-yellow-400/60 font-mono uppercase tracking-widest">Agatambyi</p>
                            <p className="text-yellow-300 font-bold text-sm">{w.agatambyi.name}</p>
                            <p className="text-[10px] text-white/30 font-mono capitalize">{w.agatambyi.role} · Royal Standalone</p>
                          </div>
                        </div>
                      )}

                      {/* All pairs mini list */}
                      <div>
                        <p className="text-[9px] text-white/25 font-mono uppercase tracking-widest mb-2">Pairs this week</p>
                        <div className="flex flex-col gap-1.5">
                          {w.pairs.map((pair, pi) => (
                            <div key={pair.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
                              <span className="text-[10px] text-white/25 font-mono w-4">{pi+1}</span>
                              <span className={`text-xs font-semibold ${pair.member_a_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                                {pair.member_a_name}
                              </span>
                              <span className="text-white/20 text-xs">
                                {pair.pair_type==="king-queen"?"❤️":pair.pair_type==="king-king"?"⚔️":"👑"}
                              </span>
                              <span className={`text-xs font-semibold ${pair.member_b_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                                {pair.member_b_name}
                              </span>
                              {pair.pair_type !== "king-queen" && (
                                <span className="ml-auto text-[8px] text-white/20 font-mono border border-white/10 px-1 rounded">fallback</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}