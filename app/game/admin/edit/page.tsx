"use client";

// app/admin/edit-pairs/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Host tool for editing pairs AFTER generation:
//  • Add a late joiner → auto-pair them with the current Agatambyi
//  • Manually create a pair from any two unpaired participants
//  • Remove a pair (both members become unpaired / Agatambyi candidates)
//  • Add a brand new participant to the session at any time
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, RefreshCw, Users, Crown, Zap } from "lucide-react";
import {
  supabase, genId, addParticipant, getPairs, getAgatambyi,
  getAllSessions, updateSessionStatus,
  type DBSession, type DBPair, type DBAgatambyi, type DBParticipant, type Role,
} from "@/lib/supabase";
import { isAdminAuthed } from "@/hooks/useAdmin";

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }: { msg:string; type:"ok"|"err"; onDone:()=>void }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return ()=>clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border text-sm
                  font-semibold backdrop-blur-sm flex items-center gap-2 shadow-2xl pointer-events-none
                  ${type==="ok"?"bg-green-500/20 border-green-500/40 text-green-300":"bg-red-500/20 border-red-500/40 text-red-300"}`}>
      {type==="ok"?<Check className="w-4 h-4"/>:<Zap className="w-4 h-4"/>}{msg}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function EditPairsPage() {
  const router = useRouter();
  const [sessions,      setSessions     ] = useState<DBSession[]>([]);
  const [selectedSid,   setSelectedSid  ] = useState<string>("");
  const [participants,  setParticipants ] = useState<DBParticipant[]>([]);
  const [pairs,         setPairs        ] = useState<DBPair[]>([]);
  const [agatambyi,     setAgatambyi    ] = useState<DBAgatambyi | null>(null);
  const [loading,       setLoading      ] = useState(false);
  const [toast,         setToast        ] = useState<{msg:string;type:"ok"|"err"}|null>(null);

  // Add late joiner form
  const [newName,       setNewName      ] = useState("");
  const [newRole,       setNewRole      ] = useState<Role>("king");
  const [addingLate,    setAddingLate   ] = useState(false);

  // Manual pair selection
  const [pickA,         setPickA        ] = useState<string>("");
  const [pickB,         setPickB        ] = useState<string>("");
  const [manualPairing, setManualPairing] = useState(false);

  const notify = (msg:string, type:"ok"|"err"="ok") => setToast({msg,type});

  // ── Admin auth guard ──────────────────────────────────────────────────────
  useEffect(() => { if (!isAdminAuthed()) router.replace("/admin/login"); }, [router]);

  // ── Load sessions ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // All sessions (lobby + revealed)
      const { data } = await supabase.from("sessions").select("*")
        .order("week_number", { ascending:false });
      setSessions(data ?? []);
      if (data?.[0]) setSelectedSid(data[0].id);
    })();
  }, []);

  // ── Load session data ────────────────────────────────────────────────────────
  const loadSession = useCallback(async (sid: string) => {
    if (!sid) return;
    setLoading(true);
    const [{ data: parts }, pairsData, agData] = await Promise.all([
      supabase.from("participants").select("*").eq("session_id", sid).order("joined_at"),
      getPairs(sid),
      getAgatambyi(sid),
    ]);
    setParticipants(parts ?? []);
    setPairs(pairsData);
    setAgatambyi(agData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedSid) loadSession(selectedSid);
  }, [selectedSid, loadSession]);

  // ── Compute who is unpaired in current session ───────────────────────────────
  const pairedIds = new Set<string>();
  for (const pair of pairs) {
    // Match by name since IDs differ between sessions
    const a = participants.find(p => p.name.toLowerCase() === pair.member_a_name.toLowerCase());
    const b = participants.find(p => p.name.toLowerCase() === pair.member_b_name.toLowerCase());
    if (a) pairedIds.add(a.id);
    if (b) pairedIds.add(b.id);
  }
  const agId = participants.find(p => p.name.toLowerCase() === agatambyi?.name.toLowerCase())?.id;
  if (agId) pairedIds.add(agId);

  const unpaired = participants.filter(p => !pairedIds.has(p.id));

  // ── Add late joiner ──────────────────────────────────────────────────────────
  const handleAddLate = async () => {
    if (!newName.trim() || !selectedSid) return;
    setAddingLate(true);

    try {
      // Add participant to session
      const { participant, error } = await addParticipant(selectedSid, newName.trim(), newRole);
      if (error) { notify(error, "err"); setAddingLate(false); return; }

      // If there's an Agatambyi → pair them together
      if (agatambyi && participant) {
        // Find Agatambyi participant object
        const agPart = participants.find(p => p.name.toLowerCase() === agatambyi.name.toLowerCase());
        if (agPart) {
          // Create the pair
          const pairType = agPart.role === participant.role
            ? (agPart.role === "king" ? "king-king" : "queen-queen")
            : "king-queen";
          const newPairRow = {
            id: genId(),
            session_id: selectedSid,
            member_a_name: agPart.role === "king" ? agPart.name : participant!.name,
            member_a_role: agPart.role === "king" ? agPart.role : participant!.role,
            member_b_name: agPart.role === "king" ? participant!.name : agPart.name,
            member_b_role: agPart.role === "king" ? participant!.role : agPart.role,
            pair_type: pairType,
          };
          await supabase.from("pairs").insert(newPairRow);

          // Remove Agatambyi record
          await supabase.from("agatambyi").delete().eq("session_id", selectedSid);
          setAgatambyi(null);

          notify(`${newName.trim()} joined and paired with ${agatambyi.name}! ✅`);
        }
      } else {
        notify(`${newName.trim()} added as unpaired. Select them below to manually pair.`);
      }

      setNewName("");
      await loadSession(selectedSid);
    } catch (e: any) {
      notify(e.message, "err");
    }
    setAddingLate(false);
  };

  // ── Manual pair two people ───────────────────────────────────────────────────
  const handleManualPair = async () => {
    if (!pickA || !pickB || pickA === pickB) {
      notify("Select two different people", "err"); return;
    }
    setManualPairing(true);

    const partA = participants.find(p => p.id === pickA)!;
    const partB = participants.find(p => p.id === pickB)!;

    const pairType = partA.role !== partB.role
      ? "king-queen"
      : partA.role === "king" ? "king-king" : "queen-queen";

    const newPair = {
      id: genId(), session_id: selectedSid,
      member_a_name: partA.role === "king" || pairType !== "king-queen" ? partA.name : partB.name,
      member_a_role: partA.role === "king" || pairType !== "king-queen" ? partA.role : partB.role,
      member_b_name: partA.role === "king" || pairType !== "king-queen" ? partB.name : partA.name,
      member_b_role: partA.role === "king" || pairType !== "king-queen" ? partB.role : partA.role,
      pair_type: pairType,
    };

    await supabase.from("pairs").insert(newPair);

    // If either was Agatambyi, clear that record
    if (agatambyi) {
      const isAg = [partA.name, partB.name].some(n => n.toLowerCase() === agatambyi.name.toLowerCase());
      if (isAg) await supabase.from("agatambyi").delete().eq("session_id", selectedSid);
    }

    setPickA(""); setPickB("");
    await loadSession(selectedSid);
    notify(`${partA.name} × ${partB.name} paired! 👑`);
    setManualPairing(false);
  };

  // ── Remove a pair ─────────────────────────────────────────────────────────────
  const handleRemovePair = async (pairId: string) => {
    await supabase.from("pairs").delete().eq("id", pairId);
    await loadSession(selectedSid);
    notify("Pair removed. Both members are now unpaired.", "ok");
  };

  // ── Set someone as Agatambyi manually ────────────────────────────────────────
  const handleSetAgatambyi = async (participantId: string) => {
    const part = participants.find(p => p.id === participantId);
    if (!part) return;

    // Clear existing Agatambyi
    await supabase.from("agatambyi").delete().eq("session_id", selectedSid);

    // Set new one
    await supabase.from("agatambyi").insert({
      id: genId(), session_id: selectedSid,
      name: part.name, role: part.role,
    });

    await loadSession(selectedSid);
    notify(`${part.name} set as Agatambyi ⭐`);
  };

  const sess = sessions.find(s => s.id === selectedSid);

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-orange-400"/>
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Admin · Edit Pairs</span>
          </div>
          <h1 className="text-2xl font-black">
            <span className="text-white">Manual </span>
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Pair Editor</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Add late joiners, fix pairs, manage Agatambyi.</p>
        </motion.div>

        {/* Session selector */}
        <div className="mb-6">
          <label className="text-[10px] text-white/25 font-mono uppercase tracking-widest block mb-2">Session</label>
          <select value={selectedSid} onChange={e => setSelectedSid(e.target.value)}
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm
                       focus:outline-none focus:border-orange-400/50 transition-all">
            {sessions.map(s => (
              <option key={s.id} value={s.id} className="bg-[#1a1a22]">
                Week {s.week_number} · {s.date} · {s.status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }}
              className="text-3xl">⚙️</motion.div>
          </div>
        ) : (
          <>
            {/* ── Session summary ── */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label:"Participants", val:participants.length, icon:"👥" },
                { label:"Pairs",        val:pairs.length,         icon:"❤️" },
                { label:"Unpaired",     val:unpaired.length,      icon:"⚠️" },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-xl font-black text-white">{s.val}</span>
                  <span className="text-[9px] text-white/25 font-mono uppercase">{s.label}</span>
                </div>
              ))}
            </div>

            {/* ── Current Agatambyi ── */}
            {agatambyi && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                className="mb-5 p-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/8 flex items-center gap-3">
                <span className="text-2xl">⭐</span>
                <div className="flex-1">
                  <p className="text-[9px] text-yellow-400/60 font-mono uppercase tracking-widest">Current Agatambyi</p>
                  <p className="text-yellow-300 font-black">{agatambyi.name}</p>
                </div>
                <p className="text-[10px] text-white/30 font-mono capitalize">{agatambyi.role}</p>
              </motion.div>
            )}

            {/* ── Add late joiner ── */}
            <div className="mb-6 p-5 rounded-2xl border border-white/10 bg-white/5">
              <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-4">
                ✦ Add Late Joiner
                {agatambyi && <span className="text-yellow-400 ml-2">→ will be paired with Agatambyi</span>}
              </p>

              <div className="flex gap-2 mb-3">
                {(["king","queen"] as Role[]).map(r => (
                  <motion.button key={r} whileTap={{ scale:0.95 }} onClick={() => setNewRole(r)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border transition-all text-sm font-bold
                                ${newRole===r
                                  ? r==="king" ? "border-yellow-400/60 bg-yellow-400/12 text-yellow-300" : "border-rose-400/60 bg-rose-400/12 text-rose-300"
                                  : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"}`}>
                    <span>{r==="king"?"⚔️":"👑"}</span>
                    <span className="capitalize">{r}</span>
                  </motion.button>
                ))}
              </div>

              <div className="flex gap-2">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleAddLate()}
                  placeholder="Late joiner's name..."
                  className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white
                             placeholder-white/20 text-sm focus:outline-none focus:border-orange-400/50 transition-all"/>
                <motion.button whileTap={{ scale:0.9 }} onClick={handleAddLate}
                  disabled={addingLate || !newName.trim()}
                  className="px-4 py-3 rounded-xl bg-orange-500/20 border border-orange-500/30
                             text-orange-400 hover:bg-orange-500/30 transition-all disabled:opacity-40
                             flex items-center gap-1.5 font-bold text-sm">
                  {addingLate ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                  Add
                </motion.button>
              </div>
            </div>

            {/* ── Manual pair selector (for unpaired people) ── */}
            {unpaired.length >= 2 && (
              <div className="mb-6 p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
                <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-4">
                  ✦ Manually Pair Two People
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { val:pickA, set:setPickA, label:"Person A" },
                    { val:pickB, set:setPickB, label:"Person B" },
                  ].map(({ val, set, label }) => (
                    <div key={label}>
                      <p className="text-[9px] text-white/25 font-mono mb-1.5">{label}</p>
                      <select value={val} onChange={e => set(e.target.value)}
                        className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5
                                   text-white text-sm focus:outline-none focus:border-blue-400/50 transition-all">
                        <option value="" className="bg-[#1a1a22]">Select...</option>
                        {unpaired.map(p => (
                          <option key={p.id} value={p.id} className="bg-[#1a1a22]">
                            {p.name} ({p.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <motion.button whileTap={{ scale:0.97 }} onClick={handleManualPair}
                  disabled={manualPairing || !pickA || !pickB || pickA===pickB}
                  className="w-full py-3 bg-blue-500/20 border border-blue-500/30 rounded-xl
                             text-blue-300 font-bold text-sm flex items-center justify-center gap-2
                             hover:bg-blue-500/30 transition-all disabled:opacity-40">
                  {manualPairing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Crown className="w-4 h-4"/>}
                  Create Pair
                </motion.button>
              </div>
            )}

            {/* ── Unpaired people ── */}
            {unpaired.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3">
                  ⚠️ Unpaired people · {unpaired.length}
                </p>
                <div className="flex flex-col gap-2">
                  {unpaired.map(p => (
                    <div key={p.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500/8 border border-orange-500/20">
                      <span>{p.role==="king"?"⚔️":"👑"}</span>
                      <span className={`font-semibold text-sm flex-1 ${p.role==="king"?"text-yellow-300":"text-rose-300"}`}>
                        {p.name}
                      </span>
                      <motion.button whileTap={{ scale:0.9 }}
                        onClick={() => handleSetAgatambyi(p.id)}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-yellow-400/12 border border-yellow-400/25
                                   text-yellow-400 font-mono hover:bg-yellow-400/20 transition-all">
                        Set Agatambyi ⭐
                      </motion.button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Current pairs list ── */}
            <div>
              <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3">
                Current Pairs · {pairs.length}
              </p>
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {pairs.map((pair, i) => (
                    <motion.div key={pair.id} layout
                      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, scale:0.95 }}
                      transition={{ delay:i*0.03 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                      <span className="text-[10px] text-white/20 font-mono w-4">{i+1}</span>
                      <span className={`text-sm font-semibold truncate ${pair.member_a_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                        {pair.member_a_name}
                      </span>
                      <span className="text-white/25 text-xs shrink-0">
                        {pair.pair_type==="king-queen"?"❤️":pair.pair_type==="king-king"?"⚔️":"👑"}
                      </span>
                      <span className={`text-sm font-semibold truncate flex-1 ${pair.member_b_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                        {pair.member_b_name}
                      </span>
                      {pair.pair_type !== "king-queen" && (
                        <span className="text-[8px] text-white/20 font-mono border border-white/10 px-1 rounded shrink-0">alt</span>
                      )}
                      <motion.button whileTap={{ scale:0.85 }}
                        onClick={() => handleRemovePair(pair.id)}
                        className="w-7 h-7 rounded-lg bg-red-500/12 border border-red-500/20
                                   flex items-center justify-center hover:bg-red-500/25 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5 text-red-400"/>
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Refresh button ── */}
            <motion.button whileTap={{ scale:0.97 }} onClick={() => loadSession(selectedSid)}
              className="mt-6 w-full py-3 rounded-xl border border-white/10 text-white/30
                         hover:text-white/60 hover:border-white/20 text-sm flex items-center justify-center gap-2 transition-all">
              <RefreshCw className="w-4 h-4"/>Refresh
            </motion.button>
          </>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </AnimatePresence>
    </div>
  );
}