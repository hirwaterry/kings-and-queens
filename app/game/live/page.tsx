"use client";
// app/game/live/page.tsx  — PLAYER VIEW ONLY
// Host controls have moved to app/game/admin/live/page.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sword, Users, Zap, Check, Star, Flame } from "lucide-react";
import {
  supabase, getSession, getParticipants, addParticipant,
  getPairs, getAgatambyi, addReaction, genId,
  type DBSession, type DBParticipant, type DBPair, type DBAgatambyi, type Role,
} from "@/lib/supabase";

// ── Role styles ───────────────────────────────────────────────────────────────
const KING_STYLE  = { border:"border-yellow-400/40", bg:"bg-yellow-400/10", text:"text-yellow-300", glow:"rgba(250,204,21,0.3)"  };
const QUEEN_STYLE = { border:"border-rose-400/40",   bg:"bg-rose-400/10",   text:"text-rose-300",   glow:"rgba(251,113,133,0.3)" };

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }: { msg:string; type:"ok"|"err"; onDone:()=>void }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return ()=>clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border text-sm font-semibold
                  backdrop-blur-sm flex items-center gap-2 shadow-2xl pointer-events-none
                  ${type==="ok"?"bg-green-500/20 border-green-500/40 text-green-300":"bg-red-500/20 border-red-500/40 text-red-300"}`}>
      {type==="ok"?<Check className="w-4 h-4"/>:<Zap className="w-4 h-4"/>}{msg}
    </motion.div>
  );
};

// ── Emoji float ───────────────────────────────────────────────────────────────
const EmojiFloat = ({ emoji, onDone }: { emoji:string; onDone:()=>void }) => {
  const [p] = useState(() => ({
    left: 15 + Math.random()*70, drift: (Math.random()-0.5)*80,
    size: 2.2+Math.random()*1.4, duration: 3.5+Math.random()*1.5,
  }));
  useEffect(() => { const t = setTimeout(onDone, (p.duration+0.3)*1000); return ()=>clearTimeout(t); }, [onDone, p.duration]);
  return (
    <motion.div
      initial={{ opacity:1, y:0, x:0, scale:0.6, rotate:0 }}
      animate={{ opacity:[1,1,1,0.6,0], y:-window.innerHeight*0.75,
        x:[0,p.drift*0.4,p.drift,p.drift*0.6,0], scale:[0.6,1.3,1.1,1.0,0.8], rotate:[0,-12,10,-6,0] }}
      transition={{ duration:p.duration, ease:"easeOut" }}
      className="fixed bottom-24 pointer-events-none z-50 select-none"
      style={{ left:`${p.left}vw`, fontSize:`${p.size}rem`, lineHeight:1 }}>
      {emoji}
    </motion.div>
  );
};

// ── Pair card ─────────────────────────────────────────────────────────────────
const PairCard = ({ pair, index, myName }: { pair:DBPair; index:number; myName:string }) => {
  const isMyPair = myName && (
    pair.member_a_name.toLowerCase()===myName.toLowerCase() ||
    pair.member_b_name.toLowerCase()===myName.toLowerCase()
  );
  const isKQ = pair.pair_type==="king-queen";
  return (
    <motion.div initial={{ opacity:0, y:20, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }}
      transition={{ delay:index*0.07, type:"spring" }}
      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all
                  ${isMyPair?"border-blue-400/50 bg-blue-400/10 shadow-lg shadow-blue-400/15":"border-white/10 bg-white/5"}`}>
      <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-[11px] font-mono text-white/30 shrink-0">
        {String(index+1).padStart(2,"0")}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${pair.member_a_role==="king"?"bg-yellow-400/15":"bg-rose-400/15"}`}>
          {pair.member_a_role==="king"?"⚔️":"👑"}
        </div>
        <p className={`font-bold text-sm truncate ${pair.member_a_role==="king"?"text-yellow-300":"text-rose-300"}`}>{pair.member_a_name}</p>
      </div>
      <motion.div animate={{ scale:[1,1.3,1] }} transition={{ duration:1.8, repeat:Infinity, delay:index*0.2 }} className="text-base shrink-0">
        {isKQ?"❤️":pair.pair_type==="king-king"?"⚔️":"👑"}
      </motion.div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <p className={`font-bold text-sm truncate text-right ${pair.member_b_role==="king"?"text-yellow-300":"text-rose-300"}`}>{pair.member_b_name}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${pair.member_b_role==="king"?"bg-yellow-400/15":"bg-rose-400/15"}`}>
          {pair.member_b_role==="king"?"⚔️":"👑"}
        </div>
      </div>
      {isMyPair && <div className="shrink-0 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-[9px] text-blue-300 font-black">YOU</div>}
    </motion.div>
  );
};

// ── Agatambyi card ────────────────────────────────────────────────────────────
const AgatambyiCard = ({ ag, myName }: { ag:DBAgatambyi; myName:string }) => {
  const isMe = myName && ag.name.toLowerCase()===myName.toLowerCase();
  return (
    <motion.div initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
      transition={{ type:"spring", bounce:0.4 }}
      className={`relative overflow-hidden rounded-3xl border-2 p-6 text-center
                  ${isMe?"border-yellow-300/60 shadow-xl shadow-yellow-400/20":"border-yellow-400/40"}
                  bg-gradient-to-br from-yellow-900/30 via-[#1a1208] to-amber-900/20`}
      style={{ boxShadow:isMe?"0 0 60px rgba(250,204,21,0.2)":"0 0 30px rgba(250,204,21,0.1)" }}>
      {["top-3 left-3","top-3 right-3","bottom-3 left-3","bottom-3 right-3"].map((pos,i)=>(
        <motion.div key={i} animate={{ opacity:[0.4,1,0.4],scale:[1,1.2,1] }}
          transition={{ duration:2,repeat:Infinity,delay:i*0.4 }}
          className={`absolute text-yellow-400 text-xs ${pos}`}>⭐</motion.div>
      ))}
      <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3,repeat:Infinity }} className="text-4xl mb-3">⭐</motion.div>
      <p className="text-[10px] font-mono text-yellow-400/60 tracking-[0.3em] uppercase mb-1">✦ Agatambyi ✦</p>
      <p className="text-yellow-300 font-black text-2xl tracking-tight mb-1">{ag.name}</p>
      <p className="text-white/30 text-xs font-mono">{ag.role==="king"?"⚔️ King":"👑 Queen"} · The Royal Standalone</p>
      {isMe && (
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:0.3,type:"spring" }}
          className="mt-3 py-2 px-4 rounded-xl bg-yellow-400/15 border border-yellow-400/30 inline-block">
          <p className="text-[11px] text-yellow-400 font-black">That's you! ⭐ You stand alone royally</p>
        </motion.div>
      )}
    </motion.div>
  );
};

// ── Forge messages ────────────────────────────────────────────────────────────
const FORGE_MSGS = [
  "The spirits are consulting the stars...", "Royal bonds are being forged...",
  "Destiny is shuffling the deck...", "The ancestors are deciding...",
  "Ancient wisdom is at work...", "The realm is aligning your fates...",
  "Sacred pairs are being chosen...",
];
const ForgeMessages = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(()=>setIdx(i=>(i+1)%FORGE_MSGS.length),2200); return()=>clearInterval(t); },[]);
  return (
    <AnimatePresence mode="wait">
      <motion.p key={idx} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }}
        transition={{ duration:0.4 }} className="text-white/50 text-sm font-mono text-center leading-relaxed">
        {FORGE_MSGS[idx]}
      </motion.p>
    </AnimatePresence>
  );
};

const REACTION_EMOJIS = ["❤️","🔥","👑","⚔️","🎉","😍"];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
type Screen = "join" | "lobby" | "revealing" | "results";

export default function LivePage() {
  const [screen,       setScreen      ] = useState<Screen>("join");
  const [session,      setSession     ] = useState<DBSession|null>(null);
  const [participants, setParticipants] = useState<DBParticipant[]>([]);
  const [pairs,        setPairs       ] = useState<DBPair[]>([]);
  const [agatambyi,    setAgatambyi   ] = useState<DBAgatambyi|null>(null);
  const [myName,       setMyName      ] = useState("");
  const [myRole,       setMyRole      ] = useState<Role>("king");
  const [nameInput,    setNameInput   ] = useState("");
  const [sessionCode,  setSessionCode ] = useState("");
  const [joining,      setJoining     ] = useState(false);
  const [revealStep,   setRevealStep  ] = useState(0);
  const [floats,       setFloats      ] = useState<{id:string;emoji:string}[]>([]);
  const [toast,        setToast       ] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const [copied,       setCopied      ] = useState(false);
  const subsRef = useRef<(()=>void)[]>([]);

  const notify = (msg:string, type:"ok"|"err"="ok") => setToast({msg,type});

  useEffect(() => () => { subsRef.current.forEach(u=>u()); }, []);

  // Pre-fill name from localStorage if returning player
  useEffect(() => {
    const saved = localStorage.getItem("fow_my_name");
    if (saved) setNameInput(saved);
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session");
    if (sid) setSessionCode(sid);
  }, []);

  const subscribeSession = useCallback((sid:string) => {
    const ch = supabase.channel(`session:${sid}`)
      .on("postgres_changes",{ event:"UPDATE",schema:"public",table:"sessions",filter:`id=eq.${sid}` },
        async (payload) => {
          const updated = payload.new as DBSession;
          setSession(updated);
          if (updated.status==="revealing") {
            setScreen("revealing");
            let step = 3; setRevealStep(step);
            const cd = setInterval(()=>{ step--; setRevealStep(step); if(step<=0) clearInterval(cd); }, 1000);
          }
          if (updated.status==="revealed") {
            const [p,ag] = await Promise.all([getPairs(sid), getAgatambyi(sid)]);
            setPairs(p); setAgatambyi(ag); setScreen("results");
          }
        }).subscribe();
    subsRef.current.push(()=>supabase.removeChannel(ch));
  }, []);

  const subscribeParticipants = useCallback((sid:string) => {
    const ch = supabase.channel(`participants:${sid}`)
      .on("postgres_changes",{ event:"*",schema:"public",table:"participants",filter:`session_id=eq.${sid}` },
        async () => { const p = await getParticipants(sid); setParticipants(p); }).subscribe();
    subsRef.current.push(()=>supabase.removeChannel(ch));
  }, []);

  const subscribeReactions = useCallback((sid:string) => {
    const ch = supabase.channel(`reactions:${sid}`)
      .on("postgres_changes",{ event:"INSERT",schema:"public",table:"reactions",filter:`session_id=eq.${sid}` },
        (payload) => { const emoji=(payload.new as any).emoji; setFloats(prev=>[...prev,{id:genId(),emoji}]); })
      .subscribe();
    subsRef.current.push(()=>supabase.removeChannel(ch));
  }, []);

  // ── JOIN ──────────────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (joining) return;
    if (!nameInput.trim()) { notify("Enter your name first","err"); return; }
    setJoining(true);
    try {
      let sess: DBSession|null = null;
      if (sessionCode.trim()) {
        sess = await getSession(sessionCode.trim());
        if (!sess) { notify("Session not found. Check the code.","err"); setJoining(false); return; }
      } else {
        const { data } = await supabase.from("sessions").select("*").eq("status","lobby")
          .order("created_at",{ ascending:false }).limit(1).single();
        sess = data;
        if (!sess) { notify("No open session right now. Ask the host to create one.","err"); setJoining(false); return; }
      }

      const { participant, error } = await addParticipant(sess.id, nameInput.trim(), myRole);
      if (error) { notify(error,"err"); setJoining(false); return; }

      localStorage.setItem("fow_my_name", nameInput.trim());
      setSession(sess); setMyName(nameInput.trim()); setScreen("lobby");
      subscribeSession(sess.id); subscribeParticipants(sess.id); subscribeReactions(sess.id);
      const current = await getParticipants(sess.id);
      setParticipants(current);
      notify(`Welcome to the realm, ${nameInput.trim()}! 👑`);
    } catch(e:any) { notify(e.message,"err"); }
    setJoining(false);
  };

  const handleReact = (emoji:string) => {
    if (!session) return;
    addReaction(session.id, emoji);
    setFloats(prev=>[...prev,{id:genId(),emoji}]);
  };

  // ─── SCREENS ──────────────────────────────────────────────────────────────────

  // ── JOIN SCREEN ───────────────────────────────────────────────────────────────
  if (screen==="join") return (
    <Shell>
      <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} className="flex flex-col gap-5 pt-8">
        <div className="text-center mb-2">
          <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3,repeat:Infinity }}
            className="text-5xl mb-4 block">👑</motion.div>
          <h1 className="text-3xl font-black">
            <span className="text-white">Enter the </span>
            <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Realm</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Join this week's pairing session</p>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">Your Name</label>
          <input type="text" value={nameInput} onChange={e=>setNameInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleJoin()} placeholder="e.g. Mugisha, Uwera..."
            autoFocus maxLength={30}
            className="w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-3.5 text-white text-base font-medium
                       placeholder-white/20 focus:outline-none focus:border-red-500/50 transition-all"/>
        </div>

        {/* Role */}
        <div>
          <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">Your Role</label>
          <div className="flex gap-3">
            {(["king","queen"] as Role[]).map(r=>(
              <motion.button key={r} whileTap={{ scale:0.97 }} onClick={()=>setMyRole(r)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 transition-all
                            ${myRole===r
                              ? r==="king"?"border-yellow-400 bg-yellow-400/12 text-yellow-300 shadow-lg shadow-yellow-400/15"
                                         :"border-rose-400 bg-rose-400/12 text-rose-300 shadow-lg shadow-rose-400/15"
                              : "border-white/10 bg-white/5 text-white/40"}`}>
                <span className="text-xl">{r==="king"?"⚔️":"👑"}</span>
                <span className="font-black text-sm capitalize">{r}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Optional session code */}
        <div>
          <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">
            Session Code <span className="text-white/15">(optional — leave blank to join latest)</span>
          </label>
          <input type="text" value={sessionCode} onChange={e=>setSessionCode(e.target.value)}
            placeholder="Paste code or leave empty"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white
                       placeholder-white/15 text-sm font-mono focus:outline-none focus:border-white/30 transition-all"/>
        </div>

        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
          onClick={handleJoin} disabled={joining||!nameInput.trim()}
          className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl font-black text-base
                     shadow-xl shadow-red-500/25 flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
          {joining
            ? <><motion.div animate={{ rotate:360 }} transition={{ duration:1,repeat:Infinity,ease:"linear" }}><Crown className="w-5 h-5"/></motion.div>Entering the realm...</>
            : <><Crown className="w-5 h-5"/>Enter the Realm</>}
        </motion.button>
      </motion.div>
      <TL toast={toast} onDone={()=>setToast(null)}/>
    </Shell>
  );

  // ── LOBBY (waiting for pairs) ─────────────────────────────────────────────────
  if (screen==="lobby" && session) return (
    <Shell>
      <div className="flex flex-col items-center gap-6 pt-10">
        <motion.div animate={{ scale:[1,1.08,1],opacity:[0.8,1,0.8] }} transition={{ duration:2.5,repeat:Infinity }}
          className="text-6xl">👑</motion.div>

        <div className="text-center">
          <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase mb-1">Week {session.week_number} · You're in!</p>
          <h2 className="text-2xl font-black text-white">
            Welcome, <span className={myRole==="king"?"text-yellow-300":"text-rose-300"}>{myName}</span>!
          </h2>
          <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border text-xs font-bold
                           ${myRole==="king"?"bg-yellow-400/10 border-yellow-400/30 text-yellow-300":"bg-rose-400/10 border-rose-400/30 text-rose-300"}`}>
            <span>{myRole==="king"?"⚔️":"👑"}</span>
            <span className="capitalize">{myRole}</span>
          </div>
        </div>

        {/* Participant counter */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">Heroes in lobby</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-[10px] text-green-400 font-mono">{participants.length} joined</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {participants.map(p=>(
                <motion.div key={p.id} initial={{ opacity:0,scale:0.7 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold
                              ${p.name.toLowerCase()===myName.toLowerCase()
                                ?"bg-blue-400/15 border-blue-400/40 text-blue-300"
                                :p.role==="king"?"bg-yellow-400/10 border-yellow-400/25 text-yellow-300":"bg-rose-400/10 border-rose-400/25 text-rose-300"}`}>
                  <span>{p.role==="king"?"⚔️":"👑"}</span>
                  <span>{p.name}{p.name.toLowerCase()===myName.toLowerCase()?" (you)":""}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Waiting dots */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {[0,1,2].map(i=>(
              <motion.div key={i} animate={{ opacity:[0.3,1,0.3],scale:[0.8,1.1,0.8] }}
                transition={{ duration:1.2,repeat:Infinity,delay:i*0.2 }}
                className="w-2 h-2 rounded-full bg-red-400"/>
            ))}
          </div>
          <p className="text-white/25 text-xs font-mono">Waiting for host to generate pairs...</p>
        </div>
      </div>
      <TL toast={toast} onDone={()=>setToast(null)}/>
    </Shell>
  );

  // ── REVEALING ─────────────────────────────────────────────────────────────────
  if (screen==="revealing") return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
        <AnimatePresence mode="wait">
          {revealStep>0 ? (
            <motion.div key={`count-${revealStep}`}
              initial={{ scale:0.2,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ scale:2.5,opacity:0 }}
              transition={{ type:"spring",bounce:0.45,duration:0.45 }}
              className="flex flex-col items-center gap-4">
              <div className="text-[130px] font-black leading-none text-center"
                style={{ textShadow:"0 0 100px rgba(239,68,68,0.7),0 0 40px rgba(239,68,68,0.4)" }}>
                {revealStep}
              </div>
              <p className="text-white/40 font-mono text-sm tracking-widest uppercase">Revealing in {revealStep}...</p>
            </motion.div>
          ) : (
            <motion.div key="waiting" initial={{ opacity:0,scale:0.9 }} animate={{ opacity:1,scale:1 }}
              className="flex flex-col items-center gap-8 w-full max-w-xs">
              <div className="relative flex items-center justify-center">
                {[0,1,2].map(i=>(
                  <motion.div key={i} animate={{ scale:[1,1.6+i*0.3,1],opacity:[0.4,0,0.4] }}
                    transition={{ duration:2,repeat:Infinity,delay:i*0.6,ease:"easeOut" }}
                    className="absolute rounded-full border border-yellow-400/30"
                    style={{ width:80+i*40,height:80+i*40 }}/>
                ))}
                <motion.div animate={{ scale:[1,1.12,1],rotate:[0,5,-5,0] }} transition={{ duration:2.5,repeat:Infinity }}
                  className="w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow-400/20 to-amber-600/20 border border-yellow-400/30
                             flex items-center justify-center text-5xl relative z-10"
                  style={{ boxShadow:"0 0 40px rgba(250,204,21,0.25)" }}>👑</motion.div>
              </div>
              <ForgeMessages/>
              <div className="flex gap-2">
                {[0,1,2,3,4].map(i=>(
                  <motion.div key={i} animate={{ opacity:[0.2,1,0.2],scale:[0.8,1.3,0.8] }}
                    transition={{ duration:1.5,repeat:Infinity,delay:i*0.25 }}
                    className="w-2 h-2 rounded-full bg-yellow-400"/>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  );

  // ── RESULTS ───────────────────────────────────────────────────────────────────
  if (screen==="results" && session) return (
    <Shell>
      <AnimatePresence>
        {floats.map(f=>(
          <EmojiFloat key={f.id} emoji={f.emoji} onDone={()=>setFloats(prev=>prev.filter(x=>x.id!==f.id))}/>
        ))}
      </AnimatePresence>

      <div className="flex flex-col gap-5 pt-6 pb-24">
        <motion.div initial={{ opacity:0,y:-20 }} animate={{ opacity:1,y:0 }} className="text-center">
          <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3,repeat:Infinity }} className="text-4xl mb-2">👑</motion.div>
          <h2 className="text-3xl font-black">
            <span className="text-white">Week </span>
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">{session.week_number}</span>
            <span className="text-white"> Pairs</span>
          </h2>
          <p className="text-white/30 text-sm mt-1">{pairs.length} pair{pairs.length!==1?"s":""} · {session.date}</p>
        </motion.div>

        {/* My pair hero */}
        {myName && (() => {
          const myPair = pairs.find(p=>p.member_a_name.toLowerCase()===myName.toLowerCase()||p.member_b_name.toLowerCase()===myName.toLowerCase());
          if (!myPair) return null;
          const partner = myPair.member_a_name.toLowerCase()===myName.toLowerCase()
            ? { name:myPair.member_b_name, role:myPair.member_b_role }
            : { name:myPair.member_a_name, role:myPair.member_a_role };
          return (
            <motion.div initial={{ opacity:0,scale:0.9 }} animate={{ opacity:1,scale:1 }} transition={{ delay:0.2,type:"spring" }}
              className="bg-blue-500/10 border-2 border-blue-400/40 rounded-3xl p-5 text-center"
              style={{ boxShadow:"0 0 40px rgba(59,130,246,0.15)" }}>
              <p className="text-[10px] text-blue-400/60 font-mono tracking-widest uppercase mb-3">✦ Your Royal Pair ✦</p>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl
                                   ${myRole==="king"?"bg-yellow-400/15 border-yellow-400/30":"bg-rose-400/15 border-rose-400/30"}`}>
                    {myRole==="king"?"⚔️":"👑"}
                  </div>
                  <p className={`font-black text-sm ${myRole==="king"?"text-yellow-300":"text-rose-300"}`}>{myName}</p>
                  <p className="text-[9px] text-blue-400/60 font-mono">You</p>
                </div>
                <motion.div animate={{ scale:[1,1.3,1] }} transition={{ duration:1.5,repeat:Infinity }} className="text-2xl">❤️</motion.div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl
                                   ${partner.role==="king"?"bg-yellow-400/15 border-yellow-400/30":"bg-rose-400/15 border-rose-400/30"}`}>
                    {partner.role==="king"?"⚔️":"👑"}
                  </div>
                  <p className={`font-black text-sm ${partner.role==="king"?"text-yellow-300":"text-rose-300"}`}>{partner.name}</p>
                  <p className="text-[9px] text-white/25 font-mono capitalize">{partner.role}</p>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {agatambyi && <AgatambyiCard ag={agatambyi} myName={myName}/>}

        <div>
          <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
            <Star className="w-3 h-3"/>All Royal Pairs
          </p>
          <div className="flex flex-col gap-2">
            {pairs.map((pair,i)=><PairCard key={pair.id} pair={pair} index={i} myName={myName}/>)}
          </div>
        </div>
      </div>

      {/* Reaction bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pb-4">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-[#1a1a22]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3
                          flex items-center justify-center gap-2">
            {REACTION_EMOJIS.map(emoji=>(
              <motion.button key={emoji} whileHover={{ scale:1.3 }} whileTap={{ scale:0.85 }}
                onClick={()=>handleReact(emoji)} className="text-2xl p-1 rounded-xl hover:bg-white/10 transition-colors">
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
      <TL toast={toast} onDone={()=>setToast(null)}/>
    </Shell>
  );

  return null;
}

function Shell({ children }: { children:React.ReactNode }) {
  return (
    <div className="min-h-screen text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-red-900/10 rounded-full blur-[140px]"/>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-900/8 rounded-full blur-[120px]"/>
      </div>
      <div className="relative z-10 container mx-auto px-4 pt-6 pb-8 max-w-lg">{children}</div>
    </div>
  );
}

function TL({ toast, onDone }: { toast:{msg:string;type:"ok"|"err"}|null; onDone:()=>void }) {
  return <AnimatePresence>{toast&&<Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={onDone}/>}</AnimatePresence>;
}