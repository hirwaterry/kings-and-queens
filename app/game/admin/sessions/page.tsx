"use client";
// app/admin/sessions/page.tsx — Full session manager for admin

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Trash2, ChevronDown, ChevronUp, Check,
  Zap, RefreshCw, Users, Crown, LogOut,
} from "lucide-react";
import {
  supabase, getPairs, getParticipants, getAgatambyi,
  type DBSession, type DBPair, type DBParticipant, type DBAgatambyi,
} from "@/lib/supabase";
import { isAdminAuthed, adminLogout } from "@/hooks/useAdmin";

const Toast = ({ msg, type, onDone }: { msg:string; type:"ok"|"err"; onDone:()=>void }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return ()=>clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border
                  text-sm font-semibold backdrop-blur-sm flex items-center gap-2 shadow-2xl pointer-events-none
                  ${type==="ok"?"bg-green-500/20 border-green-500/40 text-green-300":"bg-red-500/20 border-red-500/40 text-red-300"}`}>
      {type==="ok"?<Check className="w-4 h-4"/>:<Zap className="w-4 h-4"/>}{msg}
    </motion.div>
  );
};

// ── Confirm delete modal ──────────────────────────────────────────────────────
const ConfirmModal = ({
  title, body, onConfirm, onCancel,
}: { title:string; body:string; onConfirm:()=>void; onCancel:()=>void }) => (
  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
    onClick={onCancel}>
    <motion.div initial={{ scale:0.9, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.9 }}
      onClick={e=>e.stopPropagation()}
      className="w-full max-w-xs bg-[#1a1a22] border border-white/10 rounded-3xl p-6 text-white">
      <div className="text-3xl text-center mb-3">⚠️</div>
      <h3 className="text-base font-black text-center mb-1">{title}</h3>
      <p className="text-white/40 text-sm text-center mb-5">{body}</p>
      <div className="flex gap-3">
        <motion.button whileTap={{ scale:0.97 }} onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/50 text-sm font-bold hover:border-white/30 transition-all">
          Cancel
        </motion.button>
        <motion.button whileTap={{ scale:0.97 }} onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-all">
          Delete
        </motion.button>
      </div>
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const router = useRouter();
  const [sessions,     setSessions    ] = useState<DBSession[]>([]);
  const [expanded,     setExpanded    ] = useState<string|null>(null);
  const [details,      setDetails     ] = useState<Record<string,(DBParticipant|DBPair|DBAgatambyi|any)[]>>({});
  const [loading,      setLoading     ] = useState(true);
  const [toast,        setToast       ] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const [confirmDel,   setConfirmDel  ] = useState<{type:"session"|"participant"|"pair"; id:string; label:string}|null>(null);

  const notify = (msg:string,type:"ok"|"err"="ok") => setToast({msg,type});

  // Guard — must be admin
  useEffect(() => {
    if (!isAdminAuthed()) router.replace("/admin/login");
  }, [router]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("sessions").select("*")
      .order("week_number", { ascending:false });
    setSessions(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadDetails = async (sid:string) => {
    const [parts, pairs, ag] = await Promise.all([
      getParticipants(sid), getPairs(sid), getAgatambyi(sid),
    ]);
    const { data: challenges } = await supabase.from("weekly_challenges")
      .select("id,question,status,max_xp,week_number")
      .eq("session_id", sid);
    setDetails(prev => ({
      ...prev,
      [`${sid}_parts`]: parts,
      [`${sid}_pairs`]: pairs,
      [`${sid}_ag`]:    ag ? [ag] : [],
      [`${sid}_challenges`]: challenges ?? [],
    }));
  };

  const handleExpand = (sid:string) => {
    if (expanded===sid) { setExpanded(null); return; }
    setExpanded(sid);
    loadDetails(sid);
  };

  // ── Delete session (cascades to everything) ───────────────────────────────
  const deleteSession = async (sid:string) => {
    await supabase.from("sessions").delete().eq("id",sid);
    setSessions(prev=>prev.filter(s=>s.id!==sid));
    setExpanded(null);
    notify("Session deleted permanently");
  };

  // ── Remove participant ────────────────────────────────────────────────────
  const removeParticipant = async (id:string, sid:string) => {
    await supabase.from("participants").delete().eq("id",id);
    await loadDetails(sid);
    notify("Participant removed");
  };

  // ── Remove pair ───────────────────────────────────────────────────────────
  const removePair = async (id:string, sid:string) => {
    await supabase.from("pairs").delete().eq("id",id);
    await loadDetails(sid);
    notify("Pair removed");
  };

  // ── Delete challenge ──────────────────────────────────────────────────────
  const deleteChallenge = async (id:string, sid:string) => {
    await supabase.from("weekly_challenges").delete().eq("id",id);
    await loadDetails(sid);
    notify("Challenge deleted");
  };

  // ── Change session status ─────────────────────────────────────────────────
  const setStatus = async (sid:string, status:string) => {
    await supabase.from("sessions").update({ status }).eq("id",sid);
    setSessions(prev=>prev.map(s=>s.id===sid?{...s,status:status as any}:s));
    notify(`Status → ${status}`);
  };

  const statusColors: Record<string,string> = {
    lobby:     "text-green-400 border-green-500/25 bg-green-500/8",
    revealing: "text-yellow-400 border-yellow-500/25 bg-yellow-500/8",
    revealed:  "text-blue-400 border-blue-500/25 bg-blue-500/8",
  };

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-slate-400"/>
            <span className="text-[10px] font-mono text-white/25 tracking-widest uppercase">Admin · Sessions</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-mono">ADMIN</span>
              <motion.button whileTap={{ scale:0.9 }}
                onClick={()=>{ adminLogout(); router.push("/admin/login"); }}
                className="text-[10px] text-white/25 hover:text-red-400 font-mono flex items-center gap-1 transition-colors">
                <LogOut className="w-3 h-3"/>Out
              </motion.button>
            </div>
          </div>
          <h1 className="text-2xl font-black">
            <span className="text-white">Session </span>
            <span className="bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">Manager</span>
          </h1>
          <p className="text-white/25 text-sm mt-1">Delete sessions, remove participants, manage pairs & challenges.</p>
        </motion.div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label:"Total Sessions", val:sessions.length,                icon:"📅" },
            { label:"Active Lobby",   val:sessions.filter(s=>s.status==="lobby").length,   icon:"🟢" },
            { label:"Completed",      val:sessions.filter(s=>s.status==="revealed").length, icon:"✅" },
          ].map(s=>(
            <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
              <span className="text-xl">{s.icon}</span>
              <span className="text-xl font-black text-white">{s.val}</span>
              <span className="text-[8px] text-white/20 font-mono uppercase text-center leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }}
              className="text-3xl">⚙️</motion.div>
          </div>
        ) : sessions.length===0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-white/30 text-sm font-mono">No sessions yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((sess, i) => {
              const isOpen = expanded===sess.id;
              const parts: DBParticipant[] = (details[`${sess.id}_parts`] ?? []) as DBParticipant[];
              const pairs: DBPair[]        = (details[`${sess.id}_pairs`] ?? []) as DBPair[];
              const ag: DBAgatambyi[]      = (details[`${sess.id}_ag`]   ?? []) as DBAgatambyi[];
              const chs: any[]             = details[`${sess.id}_challenges`] ?? [];

              return (
                <motion.div key={sess.id} layout initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay:i*0.04 }} className="rounded-2xl overflow-hidden">

                  {/* Session row header */}
                  <div className={`flex items-center gap-3 p-4 border transition-all
                                   ${isOpen?"bg-white/8 border-white/15":"bg-white/5 border-white/8"}`}>
                    <div className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-sm">W{sess.week_number}</span>
                    </div>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>handleExpand(sess.id)}>
                      <p className="text-white font-bold text-sm">Week {sess.week_number}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-white/25 font-mono">{sess.date}</span>
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border ${statusColors[sess.status]??""}`}>
                          {sess.status}
                        </span>
                      </div>
                    </div>

                    {/* Status change + delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Status selector */}
                      <select value={sess.status}
                        onChange={e=>{ e.stopPropagation(); setStatus(sess.id, e.target.value); }}
                        onClick={e=>e.stopPropagation()}
                        className="bg-white/8 border border-white/12 rounded-lg px-2 py-1 text-white/60
                                   text-[10px] font-mono focus:outline-none cursor-pointer">
                        <option value="lobby" className="bg-[#1a1a22]">lobby</option>
                        <option value="revealing" className="bg-[#1a1a22]">revealing</option>
                        <option value="revealed" className="bg-[#1a1a22]">revealed</option>
                      </select>

                      <motion.button whileTap={{ scale:0.85 }}
                        onClick={()=>setConfirmDel({ type:"session", id:sess.id, label:`Week ${sess.week_number}` })}
                        className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 hover:bg-red-500/15 hover:border-red-500/25
                                   flex items-center justify-center transition-all">
                        <Trash2 className="w-3.5 h-3.5 text-white/30 hover:text-red-400"/>
                      </motion.button>

                      <motion.button whileTap={{ scale:0.85 }} onClick={()=>handleExpand(sess.id)}>
                        {isOpen?<ChevronUp className="w-4 h-4 text-white/30"/>:<ChevronDown className="w-4 h-4 text-white/30"/>}
                      </motion.button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                        exit={{ opacity:0, height:0 }} transition={{ duration:0.22 }} className="overflow-hidden">
                        <div className="border-x border-b border-white/8 bg-white/3 px-4 py-4 flex flex-col gap-4">

                          {/* Participants */}
                          <div>
                            <p className="text-[9px] text-white/20 font-mono uppercase tracking-wider mb-2">
                              👥 Participants · {parts.length}
                            </p>
                            {parts.length===0 ? (
                              <p className="text-white/15 text-xs font-mono">None yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {parts.map(p=>(
                                  <div key={p.id}
                                    className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border text-xs font-semibold
                                                ${p.role==="king"?"border-yellow-400/20 bg-yellow-400/8 text-yellow-300":"border-rose-400/20 bg-rose-400/8 text-rose-300"}`}>
                                    <span>{p.role==="king"?"⚔️":"👑"}</span>
                                    <span>{p.name}</span>
                                    <motion.button whileTap={{ scale:0.8 }}
                                      onClick={()=>setConfirmDel({ type:"participant", id:p.id, label:p.name })}
                                      className="w-4 h-4 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center transition-colors ml-0.5">
                                      <Trash2 className="w-2 h-2 text-white/40"/>
                                    </motion.button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Agatambyi */}
                          {ag.length>0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-400/8 border border-yellow-400/20">
                              <span className="text-yellow-400">⭐</span>
                              <span className="text-[10px] text-yellow-300 font-mono uppercase tracking-widest">Agatambyi:</span>
                              <span className="text-yellow-300 font-bold text-sm">{ag[0].name}</span>
                            </div>
                          )}

                          {/* Pairs */}
                          <div>
                            <p className="text-[9px] text-white/20 font-mono uppercase tracking-wider mb-2">
                              ❤️ Pairs · {pairs.length}
                            </p>
                            {pairs.length===0 ? (
                              <p className="text-white/15 text-xs font-mono">No pairs yet.</p>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {pairs.map((pair,pi)=>(
                                  <div key={pair.id}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/6">
                                    <span className="text-[9px] text-white/20 font-mono w-4">{pi+1}</span>
                                    <span className={`text-xs font-semibold ${pair.member_a_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                                      {pair.member_a_name}
                                    </span>
                                    <span className="text-white/20 text-[10px]">
                                      {pair.pair_type==="king-queen"?"❤️":pair.pair_type==="king-king"?"⚔️":"👑"}
                                    </span>
                                    <span className={`text-xs font-semibold flex-1 ${pair.member_b_role==="king"?"text-yellow-300":"text-rose-300"}`}>
                                      {pair.member_b_name}
                                    </span>
                                    <motion.button whileTap={{ scale:0.85 }}
                                      onClick={()=>setConfirmDel({ type:"pair", id:pair.id, label:`${pair.member_a_name} × ${pair.member_b_name}` })}
                                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/15 flex items-center justify-center transition-colors shrink-0">
                                      <Trash2 className="w-3 h-3 text-white/20 hover:text-red-400"/>
                                    </motion.button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Challenges */}
                          {chs.length>0 && (
                            <div>
                              <p className="text-[9px] text-white/20 font-mono uppercase tracking-wider mb-2">
                                🎯 Challenges · {chs.length}
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {chs.map((ch:any)=>(
                                  <div key={ch.id}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/5 border border-violet-500/15">
                                    <p className="text-xs text-white/60 flex-1 truncate">{ch.question}</p>
                                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border shrink-0
                                                      ${ch.status==="open"?"text-green-400 border-green-500/20 bg-green-500/8"
                                                        :ch.status==="closed"?"text-white/25 border-white/8 bg-white/4"
                                                        :"text-yellow-400 border-yellow-500/20 bg-yellow-500/8"}`}>
                                      {ch.status}
                                    </span>
                                    <span className="text-[9px] text-violet-400 font-mono shrink-0">{ch.max_xp}xp</span>
                                    <motion.button whileTap={{ scale:0.85 }}
                                      onClick={()=>deleteChallenge(ch.id, sess.id)}
                                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/15 flex items-center justify-center transition-colors shrink-0">
                                      <Trash2 className="w-3 h-3 text-white/20 hover:text-red-400"/>
                                    </motion.button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Refresh */}
                          <motion.button whileTap={{ scale:0.97 }} onClick={()=>loadDetails(sess.id)}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/8
                                       text-white/25 hover:text-white/50 text-xs transition-all">
                            <RefreshCw className="w-3 h-3"/> Refresh
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Refresh all */}
        <motion.button whileTap={{ scale:0.97 }} onClick={loadSessions}
          className="mt-6 w-full py-3 rounded-xl border border-white/8 text-white/25
                     hover:text-white/50 text-sm flex items-center justify-center gap-2 transition-all">
          <RefreshCw className="w-4 h-4"/> Refresh All Sessions
        </motion.button>
      </div>

      {/* Confirm delete modal */}
      <AnimatePresence>
        {confirmDel && (
          <ConfirmModal
            title={`Delete ${confirmDel.type}?`}
            body={`"${confirmDel.label}" will be permanently deleted. This cannot be undone.`}
            onCancel={()=>setConfirmDel(null)}
            onConfirm={async ()=>{
              const { type, id } = confirmDel;
              if (type==="session")     await deleteSession(id);
              if (type==="participant") { const sess = sessions.find(s=>s.id===expanded); await removeParticipant(id, sess?.id??""); }
              if (type==="pair")        { const sess = sessions.find(s=>s.id===expanded); await removePair(id, sess?.id??""); }
              setConfirmDel(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </AnimatePresence>
    </div>
  );
}