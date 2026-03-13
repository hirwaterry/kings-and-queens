"use client";
// app/pairs/page.tsx — full pair history across all sessions

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search } from "lucide-react";
import { supabase, type DBPair, type DBSession } from "@/lib/supabase";

interface SessionWithPairs { session: DBSession; pairs: DBPair[]; agatambyiName: string | null; }

export default function AllPairsPage() {
  const [data,    setData   ] = useState<SessionWithPairs[]>([]);
  const [search,  setSearch ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sessions } = await supabase.from("sessions").select("*")
        .eq("status","revealed").order("week_number",{ascending:false});
      if (!sessions) { setLoading(false); return; }

      const results: SessionWithPairs[] = await Promise.all(sessions.map(async s => {
        const { data: pairs }  = await supabase.from("pairs").select("*").eq("session_id", s.id);
        const { data: ag }     = await supabase.from("agatambyi").select("name").eq("session_id", s.id).maybeSingle();
        return { session: s, pairs: pairs ?? [], agatambyiName: ag?.name ?? null };
      }));

      setData(results);
      setLoading(false);
    })();
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = data.map(d => ({
    ...d,
    pairs: q ? d.pairs.filter(p =>
      p.member_a_name.toLowerCase().includes(q) || p.member_b_name.toLowerCase().includes(q)
    ) : d.pairs,
  })).filter(d => d.pairs.length > 0 || !q);

  const totalPairs = data.reduce((s,d) => s+d.pairs.length, 0);

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-blue-400"/>
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">All Pairs</span>
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">Pair </span>
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">History</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">{totalPairs} total pairs across {data.length} weeks</p>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25"/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white
                       placeholder-white/20 text-sm focus:outline-none focus:border-white/30 transition-all"/>
        </div>

        {loading ? (
          <div className="text-center py-20 text-white/25 font-mono">Loading history...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-white/30 text-sm font-mono">{q ? `No pairs found for "${search}"` : "No sessions yet."}</p>
          </div>
        ) : filtered.map((d, i) => (
          <motion.div key={d.session.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:i*0.05 }} className="mb-6">
            {/* Week header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-blue-400/60 font-mono uppercase tracking-widest">
                  Week {d.session.week_number}
                </span>
                <span className="text-[9px] text-white/20 font-mono">· {d.session.date}</span>
              </div>
              {d.agatambyiName && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 font-mono ml-auto">
                  ⭐ {d.agatambyiName}
                </span>
              )}
              <div className="flex-1 h-px bg-white/8 ml-2" />
            </div>

            {/* Pairs */}
            <div className="flex flex-col gap-1.5">
              {d.pairs.map((pair, pi) => {
                const highlight = q && (
                  pair.member_a_name.toLowerCase().includes(q) ||
                  pair.member_b_name.toLowerCase().includes(q)
                );
                return (
                  <motion.div key={pair.id} layout
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                                ${highlight ? "bg-blue-500/12 border-blue-500/25" : "bg-white/4 border-white/6"}`}>
                    <span className="text-[10px] text-white/20 font-mono w-4 shrink-0">{pi+1}</span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0
                                     ${pair.member_a_role==="king"?"bg-yellow-400/15":"bg-rose-400/15"}`}>
                      {pair.member_a_role==="king"?"⚔️":"👑"}
                    </div>
                    <span className={`text-sm font-semibold truncate ${
                      highlight && pair.member_a_name.toLowerCase().includes(q) ? "text-blue-300" :
                      pair.member_a_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                      {pair.member_a_name}
                    </span>
                    <span className="text-white/20 shrink-0 text-xs">
                      {pair.pair_type==="king-queen"?"❤️":pair.pair_type==="king-king"?"⚔️":"👑"}
                    </span>
                    <span className={`text-sm font-semibold truncate ${
                      highlight && pair.member_b_name.toLowerCase().includes(q) ? "text-blue-300" :
                      pair.member_b_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                      {pair.member_b_name}
                    </span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ml-auto
                                     ${pair.member_b_role==="king"?"bg-yellow-400/15":"bg-rose-400/15"}`}>
                      {pair.member_b_role==="king"?"⚔️":"👑"}
                    </div>
                    {pair.pair_type !== "king-queen" && (
                      <span className="text-[8px] text-white/20 font-mono border border-white/10 px-1 rounded shrink-0">alt</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}