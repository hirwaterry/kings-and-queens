"use client";
// app/game/admin/live/page.tsx  — HOST CONTROLS (admin only)

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sword, Users, Zap, QrCode, RefreshCw, Copy, Check, Star, Plus, Trash2 } from "lucide-react";
import {
  supabase, createSession, getSession, getParticipants,
  addParticipant, removeParticipant, generateAndSavePairs,
  updateSessionStatus, getPairs, getAgatambyi,
  genId,
  type DBSession, type DBParticipant, type DBPair, type DBAgatambyi, type Role,
} from "@/lib/supabase";
import { isAdminAuthed } from "@/hooks/useAdmin";

const QRCode = ({ value, size=160 }: { value:string; size?:number }) => (
  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=131318&color=ffffff&qzone=1`}
    alt="QR" width={size} height={size} className="rounded-2xl"/>
);

const Toast = ({ msg, type, onDone }: { msg:string; type:"ok"|"err"; onDone:()=>void }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return()=>clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity:0,y:30 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border text-sm font-semibold
                  backdrop-blur-sm flex items-center gap-2 shadow-2xl pointer-events-none
                  ${type==="ok"?"bg-green-500/20 border-green-500/40 text-green-300":"bg-red-500/20 border-red-500/40 text-red-300"}`}>
      {type==="ok"?<Check className="w-4 h-4"/>:<Zap className="w-4 h-4"/>}{msg}
    </motion.div>
  );
};

type Screen = "start" | "lobby" | "generating" | "done";

export default function AdminLivePage() {
  const router = useRouter();

  const [screen,       setScreen      ] = useState<Screen>("start");
  const [session,      setSession     ] = useState<DBSession|null>(null);
  const [participants, setParticipants] = useState<DBParticipant[]>([]);
  const [pairs,        setPairs       ] = useState<DBPair[]>([]);
  const [agatambyi,    setAgatambyi   ] = useState<DBAgatambyi|null>(null);
  const [generating,   setGenerating  ] = useState(false);
  const [copied,       setCopied      ] = useState(false);
  const [toast,        setToast       ] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const [quickName,    setQuickName   ] = useState("");
  const [quickRole,    setQuickRole   ] = useState<Role>("king");
  const [addingManual, setAddingManual] = useState(false);
  const subsRef = useRef<(()=>void)[]>([]);

  const notify = (msg:string, type:"ok"|"err"="ok") => setToast({msg,type});

  // Auth guard
  useEffect(() => {
    if (!isAdminAuthed()) router.replace("/game/admin/login");
  }, [router]);

  useEffect(() => () => { subsRef.current.forEach(u=>u()); }, []);

  const subscribeParticipants = useCallback((sid:string) => {
    const ch = supabase.channel(`admin-participants:${sid}`)
      .on("postgres_changes",{ event:"*",schema:"public",table:"participants",filter:`session_id=eq.${sid}` },
        async () => { const p = await getParticipants(sid); setParticipants(p); }).subscribe();
    subsRef.current.push(()=>supabase.removeChannel(ch));
  }, []);

  // ── Create session ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      const sess = await createSession();
      setSession(sess); setScreen("lobby");
      subscribeParticipants(sess.id);
      notify(`Week ${sess.week_number} session created! 👑`);
    } catch(e:any) { notify(e.message,"err"); }
  };

  // ── Quick-add participant from admin side ─────────────────────────────────────
  const handleQuickAdd = async () => {
    if (!session||!quickName.trim()) return;
    const { participant, error } = await addParticipant(session.id, quickName.trim(), quickRole);
    if (error) { notify(error,"err"); return; }
    setQuickName("");
    notify(`${quickName.trim()} added ✓`);
  };

  // ── Remove participant ────────────────────────────────────────────────────────
  const handleRemove = async (id:string, name:string) => {
    await removeParticipant(id);
    setParticipants(prev=>prev.filter(p=>p.id!==id));
    notify(`${name} removed`);
  };

  // ── Copy share link ───────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!session) return;
    const url = `${window.location.origin}/game/live?session=${session.id}`;
    navigator.clipboard.writeText(url).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  // ── Generate pairs ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!session) return;
    if (participants.length < 2) { notify("Need at least 2 heroes!","err"); return; }
    setGenerating(true); setScreen("generating");
    try {
      await updateSessionStatus(session.id, "revealing");
      const { pairs:newPairs, agatambyi:ag, error } = await generateAndSavePairs(session.id);
      if (error) { notify(error,"err"); setGenerating(false); setScreen("lobby"); return; }
      await new Promise<void>(resolve=>setTimeout(resolve,3500));
      setPairs(newPairs); setAgatambyi(ag);
      await updateSessionStatus(session.id,"revealed");
      setScreen("done");
      notify("Pairs revealed! 🎉");
    } catch(e:any) { notify(e.message,"err"); setScreen("lobby"); }
    setGenerating(false);
  };

  const shareUrl = session
    ? `${typeof window!=="undefined"?window.location.origin:""}/game/live?session=${session.id}`
    : "";

  // ── START SCREEN ──────────────────────────────────────────────────────────────
  if (screen==="start") return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-16 pb-16 max-w-sm">
        <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}
          className="flex flex-col items-center gap-8">
          <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3,repeat:Infinity }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500 to-rose-700
                       flex items-center justify-center text-5xl shadow-2xl shadow-red-500/30">
            👑
          </motion.div>
          <div className="text-center">
            <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase mb-1">Admin · Host Mode</p>
            <h1 className="text-3xl font-black mb-2">
              <span className="text-white">Host a </span>
              <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Session</span>
            </h1>
            <p className="text-white/35 text-sm leading-relaxed">
              Create a new weekly pairing session. Players join with the link or QR code. You generate pairs.
            </p>
          </div>

          <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
            onClick={handleCreate}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-500 rounded-2xl font-black text-base
                       shadow-xl shadow-red-500/25 flex items-center justify-center gap-2">
            <Crown className="w-5 h-5"/>Start New Session
          </motion.button>

          <p className="text-white/15 text-[10px] font-mono text-center">
            This creates a new week. Players will join via /game/live
          </p>
        </motion.div>
      </div>
      <AnimatePresence>{toast&&<Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}</AnimatePresence>
    </div>
  );

  // ── LOBBY ─────────────────────────────────────────────────────────────────────
  if ((screen==="lobby"||screen==="generating"||screen==="done") && session) return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-6 pb-16 max-w-lg">
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex flex-col gap-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Crown className="w-4 h-4 text-red-400"/>
                <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Host · Week {session.week_number}</span>
              </div>
              <h2 className="text-2xl font-black">
                {screen==="done"?"Pairs Revealed! 🎉":screen==="generating"?"Generating...":"Waiting Lobby"}
              </h2>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-[11px] text-green-400 font-mono">LIVE</span>
            </div>
          </div>

          {/* QR + link */}
          {screen!=="generating" && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col items-center gap-4">
              <p className="text-[10px] text-white/25 font-mono tracking-widest uppercase">
                Share with players → they join at /game/live
              </p>
              <QRCode value={shareUrl} size={160}/>
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 bg-white/8 rounded-xl px-3 py-2 font-mono text-xs text-white/50 truncate">
                  /game/live?session={session.id}
                </div>
                <motion.button whileTap={{ scale:0.9 }} onClick={handleCopy}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all
                              ${copied?"bg-green-500/20 border-green-500/40":"bg-white/10 border-white/15 hover:bg-white/15"}`}>
                  {copied?<Check className="w-4 h-4 text-green-400"/>:<Copy className="w-4 h-4 text-white/50"/>}
                </motion.button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:"Total",  value:participants.length,                             icon:"🧙", color:"text-white"      },
              { label:"Kings",  value:participants.filter(p=>p.role==="king").length,  icon:"⚔️", color:"text-yellow-300" },
              { label:"Queens", value:participants.filter(p=>p.role==="queen").length, icon:"👑", color:"text-rose-300"   },
            ].map(s=>(
              <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/5 border border-white/8">
                <span className="text-lg">{s.icon}</span>
                <motion.span key={s.value} initial={{ scale:1.4 }} animate={{ scale:1 }}
                  className={`text-2xl font-black ${s.color}`}>{s.value}</motion.span>
                <span className="text-[9px] text-white/25 uppercase font-mono">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Participant list */}
          {participants.length>0 && screen!=="generating" && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3">
                Heroes in lobby
              </p>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {participants.map(p=>(
                    <motion.div key={p.id} initial={{ opacity:0,scale:0.7 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0 }}
                      className={`flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-full border text-xs font-semibold
                                  ${p.role==="king"?"bg-yellow-400/10 border-yellow-400/25 text-yellow-300":"bg-rose-400/10 border-rose-400/25 text-rose-300"}`}>
                      <span>{p.role==="king"?"⚔️":"👑"}</span>
                      <span>{p.name}</span>
                      {screen==="lobby" && (
                        <motion.button whileTap={{ scale:0.8 }} onClick={()=>handleRemove(p.id,p.name)}
                          className="w-4 h-4 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-[9px] ml-0.5 transition-colors">
                          ×
                        </motion.button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Manual add form */}
          {screen==="lobby" && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <button onClick={()=>setAddingManual(!addingManual)}
                className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs font-mono transition-colors">
                <Plus className="w-3.5 h-3.5"/>{addingManual?"Cancel":"Add participant manually"}
              </button>
              <AnimatePresence>
                {addingManual && (
                  <motion.div initial={{ opacity:0,height:0 }} animate={{ opacity:1,height:"auto" }} exit={{ opacity:0,height:0 }}
                    className="overflow-hidden mt-3 flex flex-col gap-2">
                    <input type="text" value={quickName} onChange={e=>setQuickName(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handleQuickAdd()} placeholder="Name..."
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm
                                 placeholder-white/20 focus:outline-none focus:border-white/30"/>
                    <div className="flex gap-2">
                      {(["king","queen"] as Role[]).map(r=>(
                        <motion.button key={r} whileTap={{ scale:0.95 }} onClick={()=>setQuickRole(r)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all
                                      ${quickRole===r
                                        ? r==="king"?"border-yellow-400/50 bg-yellow-400/10 text-yellow-300":"border-rose-400/50 bg-rose-400/10 text-rose-300"
                                        : "border-white/10 text-white/40"}`}>
                          {r==="king"?"⚔️ King":"👑 Queen"}
                        </motion.button>
                      ))}
                    </div>
                    <motion.button whileTap={{ scale:0.97 }} onClick={handleQuickAdd} disabled={!quickName.trim()}
                      className="w-full py-2.5 bg-white/10 border border-white/15 rounded-xl text-white text-sm font-bold
                                 disabled:opacity-40 hover:bg-white/15 transition-all">
                      Add {quickName||"participant"}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Generate button */}
          {screen==="lobby" && (
            <>
              <motion.button
                whileHover={{ scale:participants.length>=2?1.02:1 }}
                whileTap={{ scale:participants.length>=2?0.97:1 }}
                onClick={handleGenerate} disabled={participants.length<2||generating}
                className={`w-full py-4 rounded-2xl font-black text-base relative overflow-hidden
                             flex items-center justify-center gap-2 transition-all
                             ${participants.length>=2
                               ?"bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 text-gray-900 shadow-xl shadow-yellow-500/30"
                               :"bg-white/8 text-white/25 cursor-not-allowed"}`}>
                <motion.div animate={{ x:["-100%","200%"] }} transition={{ duration:2,repeat:Infinity }}
                  className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 pointer-events-none"/>
                <Crown className="w-5 h-5 relative z-10"/>
                <span className="relative z-10">Generate Royal Pairs</span>
                <Sword className="w-5 h-5 relative z-10"/>
              </motion.button>
              {participants.length<2 && (
                <p className="text-center text-white/20 text-xs font-mono -mt-2">
                  {participants.length===0?"Waiting for heroes to join...":"Need at least 2 heroes"}
                </p>
              )}
            </>
          )}

          {/* Generating spinner */}
          {screen==="generating" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <motion.div animate={{ rotate:360 }} transition={{ duration:1.5,repeat:Infinity,ease:"linear" }}
                className="text-5xl">👑</motion.div>
              <p className="text-white/50 text-sm font-mono">Forging royal bonds...</p>
              <p className="text-white/25 text-xs font-mono">Players are seeing the countdown</p>
            </div>
          )}

          {/* Done — pairs summary */}
          {screen==="done" && (
            <div className="flex flex-col gap-3">
              {agatambyi && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-yellow-400/10 border border-yellow-400/25">
                  <span className="text-xl">⭐</span>
                  <div>
                    <p className="text-[9px] text-yellow-400/60 font-mono uppercase tracking-widest">Agatambyi</p>
                    <p className="text-yellow-300 font-black">{agatambyi.name}</p>
                  </div>
                </div>
              )}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3">
                  {pairs.length} pairs generated
                </p>
                <div className="flex flex-col gap-1.5">
                  {pairs.map((pair,i)=>(
                    <div key={pair.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/6 text-sm">
                      <span className="text-white/20 font-mono text-xs w-5">{i+1}.</span>
                      <span className={`font-semibold ${pair.member_a_role==="king"?"text-yellow-300":"text-rose-300"}`}>{pair.member_a_name}</span>
                      <span className="text-white/20">{pair.pair_type==="king-queen"?"❤️":pair.pair_type==="king-king"?"⚔️":"👑"}</span>
                      <span className={`font-semibold ${pair.member_b_role==="king"?"text-yellow-300":"text-rose-300"}`}>{pair.member_b_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick links after pairing */}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale:0.97 }} onClick={()=>router.push("/game/challenge")}
                  className="flex-1 py-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-sm font-bold">
                  🎯 Post Challenge
                </motion.button>
                <motion.button whileTap={{ scale:0.97 }} onClick={()=>router.push("/game/admin/edit-pairs")}
                  className="flex-1 py-3 rounded-xl bg-white/8 border border-white/15 text-white/60 text-sm font-bold">
                  ✏️ Edit Pairs
                </motion.button>
              </div>
              <motion.button whileTap={{ scale:0.97 }} onClick={()=>setScreen("start")}
                className="w-full py-3 rounded-xl border border-white/8 text-white/30 text-sm hover:text-white/50 transition-colors">
                Start another session
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
      <AnimatePresence>{toast&&<Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}</AnimatePresence>
    </div>
  );

  return null;
}