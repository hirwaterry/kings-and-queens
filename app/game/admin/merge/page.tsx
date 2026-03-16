"use client";
// app/game/admin/merge/page.tsx
// Merge duplicate player profiles into one canonical record

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitMerge, Search, Check, X, AlertTriangle, ChevronRight,
  Zap, Star, Flame, Users, ArrowRight, Trash2, RefreshCw,
} from "lucide-react";
import { supabase, getRankTier, type DBPlayerProfile } from "@/lib/supabase";
import { avatarUrl } from "@/app/game/layout";
import { isAdminAuthed } from "@/hooks/useAdmin";

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeName(n: string): string {
  // Strip emojis + special chars, lowercase, trim for fuzzy grouping
  return n
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "")
    .replace(/[^\w\s]/g, "")
    .toLowerCase()
    .trim();
}

function suggestGroups(profiles: DBPlayerProfile[]): DBPlayerProfile[][] {
  const groups: Map<string, DBPlayerProfile[]> = new Map();
  for (const p of profiles) {
    const key = normalizeName(p.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  // Only return groups with > 1 profile (actual duplicates)
  return Array.from(groups.values()).filter(g => g.length > 1);
}

// ── Stat chip ────────────────────────────────────────────────────────────────
const Chip = ({ label, val, color }: { label: string; val: string | number; color: string }) => (
  <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-white/5 border border-white/8 min-w-[46px]">
    <span className={`font-black text-xs ${color}`}>{val}</span>
    <span className="text-[8px] text-white/25 font-mono uppercase">{label}</span>
  </div>
);

// ── Player row inside merge panel ─────────────────────────────────────────────
const PlayerRow = ({
  p, isKeep, isDelete, onKeep, onDelete, keepCount,
}: {
  p: DBPlayerProfile;
  isKeep: boolean;
  isDelete: boolean;
  onKeep: () => void;
  onDelete: () => void;
  keepCount: number;
}) => {
  const tier = getRankTier(p.total_xp);
  return (
    <motion.div
      layout
      animate={{
        borderColor: isKeep ? "rgba(74,222,128,0.4)" : isDelete ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)",
        backgroundColor: isKeep ? "rgba(74,222,128,0.06)" : isDelete ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.03)",
      }}
      className="rounded-2xl border p-3 transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-xl overflow-hidden border-2 shrink-0 relative
                         ${isKeep ? "border-green-400/40" : isDelete ? "border-red-400/40" : "border-white/10"}`}>
          <img src={avatarUrl(p.display_name)} alt={p.display_name}
            className="w-full h-full object-cover bg-white/5" />
          <div className="absolute bottom-0 right-0 text-[8px] bg-black/40 rounded-tl px-0.5">
            {p.role === "king" ? "⚔️" : "👑"}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-black text-sm truncate ${isKeep ? "text-green-300" : isDelete ? "text-red-300 line-through opacity-60" : "text-white"}`}>
            {p.display_name}
          </p>
          <p className="text-[9px] text-white/25 font-mono truncate">
            key: <span className="text-white/40">{p.name}</span> · {tier.icon} {tier.label}
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-1 shrink-0">
          <Chip label="XP"  val={p.total_xp}    color="text-yellow-300" />
          <Chip label="Ap"  val={p.appearances}  color="text-blue-300"  />
          <Chip label="Str" val={p.current_streak} color="text-orange-300" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onKeep}
          disabled={isKeep}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all
                      ${isKeep
                        ? "bg-green-400/20 border border-green-400/40 text-green-300"
                        : "bg-white/5 border border-white/10 text-white/50 hover:bg-green-400/10 hover:border-green-400/30 hover:text-green-300"}`}
        >
          <Check className="w-3 h-3" />
          {isKeep ? "✓ Keeping this one" : "Keep this name"}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onDelete}
          disabled={isDelete}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all
                      ${isDelete
                        ? "bg-red-400/20 border border-red-400/40 text-red-300"
                        : "bg-white/5 border border-white/10 text-white/50 hover:bg-red-400/10 hover:border-red-400/30 hover:text-red-300"}`}
        >
          <Trash2 className="w-3 h-3" />
          {isDelete ? "✓ Will delete" : "Delete duplicate"}
        </motion.button>
      </div>
    </motion.div>
  );
};

// ── Merge group card ──────────────────────────────────────────────────────────
const MergeGroup = ({
  group, onMerged,
}: { group: DBPlayerProfile[]; onMerged: () => void }) => {
  const [keepName,    setKeepName   ] = useState<string | null>(null);
  const [deleteNames, setDeleteNames] = useState<Set<string>>(new Set());
  const [merging,     setMerging    ] = useState(false);
  const [done,        setDone       ] = useState(false);
  const [error,       setError      ] = useState<string | null>(null);
  const [log,         setLog        ] = useState<string[]>([]);

  // Auto-suggest: keep the one with most XP
  useEffect(() => {
    const best = [...group].sort((a, b) => b.total_xp - a.total_xp)[0];
    setKeepName(best.name);
    setDeleteNames(new Set(group.filter(p => p.name !== best.name).map(p => p.name)));
  }, [group]);

  const canMerge = keepName !== null && deleteNames.size > 0 &&
    (keepName !== null) && !merging && !done;

  const handleMerge = async () => {
    if (!keepName) return;
    setMerging(true);
    setError(null);
    setLog([]);
    const steps: string[] = [];

    try {
      const keeper  = group.find(p => p.name === keepName)!;
      const victims = group.filter(p => deleteNames.has(p.name));

      steps.push(`Keeping: "${keeper.display_name}" (${keeper.name})`);
      setLog([...steps]);

      for (const victim of victims) {
        steps.push(`Merging "${victim.display_name}" → "${keeper.display_name}"…`);
        setLog([...steps]);

        // 1. Update pairs — member_a
        const { error: e1 } = await supabase.from("pairs")
          .update({ member_a_name: keeper.name })
          .eq("member_a_name", victim.name);
        if (e1) throw new Error(`pairs member_a: ${e1.message}`);

        // 2. Update pairs — member_b
        const { error: e2 } = await supabase.from("pairs")
          .update({ member_b_name: keeper.name })
          .eq("member_b_name", victim.name);
        if (e2) throw new Error(`pairs member_b: ${e2.message}`);

        // 3. Update participants
        const { error: e3 } = await supabase.from("participants")
          .update({ name: keeper.name })
          .eq("name", victim.name);
        if (e3) throw new Error(`participants: ${e3.message}`);

        // 4. Update challenge_answers player_a
        await supabase.from("challenge_answers")
          .update({ player_a_name: keeper.name })
          .eq("player_a_name", victim.name);

        // 5. Update challenge_answers player_b
        await supabase.from("challenge_answers")
          .update({ player_b_name: keeper.name })
          .eq("player_b_name", victim.name);

        // 6. Update agatambyis
        await supabase.from("agatambyis")
          .update({ name: keeper.name })
          .eq("name", victim.name);

        // 7. Merge XP + stats into keeper profile
        const mergedXP        = keeper.total_xp + victim.total_xp;
        const mergedChalXP    = keeper.challenge_xp + victim.challenge_xp;
        const mergedApp       = keeper.appearances + victim.appearances;
        const mergedStreak    = Math.max(keeper.current_streak, victim.current_streak);
        const mergedLongest   = Math.max(keeper.longest_streak, victim.longest_streak);
        const mergedAgat      = keeper.agatambyi_count + victim.agatambyi_count;
        const mergedNewPairs  = keeper.new_pairings + victim.new_pairings;
        const mergedLastWeek  = Math.max(keeper.last_seen_week, victim.last_seen_week);
        const mergedPartners  = Array.from(new Set([
          ...keeper.pair_partners,
          ...victim.pair_partners,
          victim.name, // include victim's own name? no — include their partners
        ])).filter(n => n !== keeper.name && n !== victim.name);

        const { error: e7 } = await supabase.from("player_profiles")
          .update({
            total_xp:       mergedXP,
            challenge_xp:   mergedChalXP,
            appearances:    mergedApp,
            current_streak: mergedStreak,
            longest_streak: mergedLongest,
            agatambyi_count:mergedAgat,
            new_pairings:   mergedNewPairs,
            last_seen_week: mergedLastWeek,
            pair_partners:  mergedPartners,
          })
          .eq("name", keeper.name);
        if (e7) throw new Error(`update keeper: ${e7.message}`);

        // 8. Delete victim profile
        const { error: e8 } = await supabase.from("player_profiles")
          .delete()
          .eq("name", victim.name);
        if (e8) throw new Error(`delete victim: ${e8.message}`);

        steps.push(`✓ Merged & deleted "${victim.display_name}"`);
        setLog([...steps]);
      }

      steps.push("✅ All done! Profiles merged successfully.");
      setLog([...steps]);
      setDone(true);
      setTimeout(onMerged, 1200);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setMerging(false);
    }
  };

  if (done) return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-5 rounded-3xl border border-green-400/30 bg-green-500/8 text-center"
    >
      <div className="text-3xl mb-2">✅</div>
      <p className="text-green-300 font-black">Merged successfully!</p>
    </motion.div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/4 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-400/15 border border-orange-400/25 flex items-center justify-center">
            <GitMerge className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div>
            <p className="text-white font-black text-sm">
              {group.length} duplicates detected
            </p>
            <p className="text-white/25 text-[9px] font-mono">
              base name: <span className="text-white/40">{normalizeName(group[0].name)}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {group.map(p => (
            <div key={p.name} className="w-7 h-7 rounded-lg overflow-hidden border border-white/10">
              <img src={avatarUrl(p.display_name)} alt={p.display_name}
                className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Player rows */}
      <div className="p-4 flex flex-col gap-3">
        {group.map(p => (
          <PlayerRow
            key={p.name}
            p={p}
            isKeep={keepName === p.name}
            isDelete={deleteNames.has(p.name)}
            keepCount={keepName ? 1 : 0}
            onKeep={() => {
              setKeepName(p.name);
              setDeleteNames(prev => {
                const next = new Set(prev);
                next.delete(p.name);
                // Add old keepName to deletes
                if (keepName && keepName !== p.name) next.add(keepName);
                return next;
              });
            }}
            onDelete={() => {
              if (keepName === p.name) return; // Can't delete the keeper
              setDeleteNames(prev => {
                const next = new Set(prev);
                if (next.has(p.name)) next.delete(p.name);
                else next.add(p.name);
                return next;
              });
            }}
          />
        ))}

        {/* Merge preview */}
        {keepName && deleteNames.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-1 p-3 rounded-xl bg-blue-500/8 border border-blue-400/20"
          >
            <p className="text-[10px] text-blue-400/60 font-mono uppercase tracking-wider mb-2">Merge preview</p>
            <div className="flex items-center gap-2 flex-wrap">
              {group.filter(p => deleteNames.has(p.name)).map(p => (
                <span key={p.name} className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/20 text-red-300 font-mono line-through opacity-60">
                  {p.display_name}
                </span>
              ))}
              <ArrowRight className="w-3 h-3 text-white/20 shrink-0" />
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 border border-green-400/20 text-green-300 font-mono font-bold">
                {group.find(p => p.name === keepName)?.display_name}
              </span>
            </div>
            <p className="text-[9px] text-white/20 font-mono mt-2">
              XP will be combined · stats merged · history reassigned
            </p>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/25 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs font-mono">{error}</p>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            {log.map((line, i) => (
              <p key={i} className="text-[9px] font-mono text-white/40 leading-relaxed">{line}</p>
            ))}
          </div>
        )}

        {/* Merge button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleMerge}
          disabled={!canMerge}
          className={`w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all
                      ${canMerge
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:brightness-110"
                        : "bg-white/5 border border-white/8 text-white/20 cursor-not-allowed"}`}
        >
          {merging ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="w-4 h-4" />
              </motion.div>
              Merging…
            </>
          ) : (
            <>
              <GitMerge className="w-4 h-4" />
              Merge {deleteNames.size} duplicate{deleteNames.size !== 1 ? "s" : ""} into 1 profile
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

// ── Manual search merge ────────────────────────────────────────────────────────
const ManualMerge = ({
  allProfiles, onMerged,
}: { allProfiles: DBPlayerProfile[]; onMerged: () => void }) => {
  const [query,    setQuery   ] = useState("");
  const [selected, setSelected] = useState<DBPlayerProfile[]>([]);

  const results = query.length >= 2
    ? allProfiles.filter(p =>
        p.display_name.toLowerCase().includes(query.toLowerCase()) ||
        p.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const toggle = (p: DBPlayerProfile) => {
    setSelected(prev =>
      prev.find(x => x.name === p.name)
        ? prev.filter(x => x.name !== p.name)
        : [...prev, p]
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/4 overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-white/6">
        <p className="text-white font-black text-sm">Manual Merge</p>
        <p className="text-white/30 text-[10px] font-mono">Search and select any players to merge</p>
      </div>

      <div className="p-4">
        {/* Search box */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 mb-3">
          <Search className="w-3.5 h-3.5 text-white/25 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search player name…"
            className="flex-1 bg-transparent text-white text-sm font-mono placeholder:text-white/20 outline-none"
          />
        </div>

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="mb-3 flex flex-col gap-1">
              {results.map(p => {
                const isSel = !!selected.find(x => x.name === p.name);
                return (
                  <motion.button key={p.name} whileTap={{ scale: 0.98 }} onClick={() => toggle(p)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left
                                ${isSel ? "bg-blue-500/12 border-blue-400/30" : "bg-white/4 border-white/8 hover:bg-white/8"}`}>
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0">
                      <img src={avatarUrl(p.display_name)} alt={p.display_name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isSel ? "text-blue-300" : "text-white"}`}>{p.display_name}</p>
                      <p className="text-[9px] text-white/25 font-mono">{p.name} · {p.total_xp} XP</p>
                    </div>
                    {isSel && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="mb-3">
            <p className="text-[9px] text-white/25 font-mono uppercase mb-2">Selected to merge ({selected.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.map(p => (
                <button key={p.name} onClick={() => toggle(p)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/12 border border-blue-400/25 text-blue-300 text-[10px] font-mono hover:bg-red-500/12 hover:border-red-400/25 hover:text-red-300 transition-all">
                  {p.display_name}
                  <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {selected.length >= 2 && (
          <MergeGroup group={selected} onMerged={() => { setSelected([]); setQuery(""); onMerged(); }} />
        )}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MergePage() {
  const router = useRouter();
  const [profiles,    setProfiles   ] = useState<DBPlayerProfile[]>([]);
  const [dupGroups,   setDupGroups  ] = useState<DBPlayerProfile[][]>([]);
  const [loading,     setLoading    ] = useState(true);
  const [tab,         setTab        ] = useState<"auto" | "manual">("auto");

  useEffect(() => {
    if (!isAdminAuthed()) {
      router.replace("/game/admin/login");
      return;
    }
    load();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("player_profiles").select("*").order("name");
    const all = data ?? [];
    setProfiles(all);
    setDupGroups(suggestGroups(all));
    setLoading(false);
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="text-3xl">👑</motion.div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      {/* BG */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-80 bg-orange-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-violet-900/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.push("/game/admin")}
              className="text-white/30 hover:text-white/60 text-[10px] font-mono transition-colors">
              ← Admin
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-400/15 border border-orange-400/25 flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Merge Duplicates</h1>
              <p className="text-white/30 text-xs font-mono">
                {profiles.length} total profiles · {dupGroups.length} duplicate group{dupGroups.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={load}
              className="ml-auto w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-white/30" />
            </motion.button>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="mb-6 p-4 rounded-2xl bg-blue-500/8 border border-blue-400/20">
          <p className="text-blue-300 font-bold text-xs mb-1.5">How merging works</p>
          <p className="text-blue-400/60 text-[10px] font-mono leading-relaxed">
            When you merge, the duplicate's XP, appearances, streaks, and challenge history are added to the keeper.
            All pairs and participants records are reassigned to the keeper's name.
            The duplicate profile is then permanently deleted.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-white/5 border border-white/8 rounded-2xl mb-6">
          {[
            { id: "auto",   label: `Auto-detected (${dupGroups.length})`, icon: "🔍" },
            { id: "manual", label: "Manual search",                        icon: "✏️"  },
          ].map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.97 }} onClick={() => setTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all
                          ${tab === t.id ? "bg-white/15 text-white border border-white/20" : "text-white/40 hover:text-white/60"}`}>
              <span>{t.icon}</span><span>{t.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Auto tab */}
        {tab === "auto" && (
          <div>
            {dupGroups.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-white/50 font-bold">No duplicates detected!</p>
                <p className="text-white/25 text-xs font-mono mt-1">All player names look unique.</p>
                <p className="text-white/20 text-[10px] font-mono mt-3">
                  Use Manual search if you want to merge players with very different names.
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-400/8 border border-orange-400/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <p className="text-orange-300/80 text-[10px] font-mono">
                    Review each group carefully. Stats are combined, duplicates deleted — this cannot be undone.
                  </p>
                </div>
                <AnimatePresence>
                  {dupGroups.map((group, i) => (
                    <MergeGroup key={group.map(p => p.name).join("|")} group={group} onMerged={load} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Manual tab */}
        {tab === "manual" && (
          <ManualMerge allProfiles={profiles} onMerged={load} />
        )}

      </div>
    </div>
  );
}