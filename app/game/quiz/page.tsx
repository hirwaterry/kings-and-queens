"use client";
// app/game/quiz/page.tsx
// Admin: create quiz, add questions, open it, advance question by question, close + award XP
// Players: see live question, pick answer in time limit, see results per question, final leaderboard

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, Trash2, Check, ChevronRight, Lock,
  RefreshCw, Trophy, Users, Clock, Star,
} from "lucide-react";
import { supabase, getPairs, genId, type DBSession, type DBPair } from "@/lib/supabase";
import { isAdminAuthed } from "@/hooks/useAdmin";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DBQuiz {
  id: string; session_id: string|null; week_number: number;
  title: string; status: "draft"|"open"|"active"|"closed";
  current_q_index: number; xp_per_correct: number; xp_pair_bonus: number;
  created_at: string;
}
interface DBQuizQuestion {
  id: string; quiz_id: string; sort_order: number;
  question: string; option_a: string; option_b: string;
  option_c: string; option_d: string; correct: "a"|"b"|"c"|"d";
  time_limit: number; created_at: string;
}
interface DBQuizAnswer {
  id: string; quiz_id: string; question_id: string;
  player_name: string; chosen: "a"|"b"|"c"|"d";
  is_correct: boolean; answered_at: string;
}

const OPTION_LABELS: Record<string, string> = { a:"A", b:"B", c:"C", d:"D" };
const OPTION_COLORS: Record<string, string> = {
  a: "border-blue-400/40 bg-blue-400/10 text-blue-300",
  b: "border-green-400/40 bg-green-400/10 text-green-300",
  c: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
  d: "border-rose-400/40 bg-rose-400/10 text-rose-300",
};
const OPTION_CORRECT = "border-green-400 bg-green-400/20 text-green-300 shadow-lg shadow-green-400/20";
const OPTION_WRONG   = "border-red-400/40 bg-red-400/8 text-red-300/60 opacity-50";

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }: { msg:string; type:"ok"|"err"; onDone:()=>void }) => {
  useEffect(() => { const t = setTimeout(onDone,2500); return()=>clearTimeout(t); },[onDone]);
  return (
    <motion.div initial={{ opacity:0,y:30 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border text-sm font-semibold
                  backdrop-blur-sm flex items-center gap-2 shadow-2xl pointer-events-none
                  ${type==="ok"?"bg-green-500/20 border-green-500/40 text-green-300":"bg-red-500/20 border-red-500/40 text-red-300"}`}>
      {type==="ok"?<Check className="w-4 h-4"/>:<Zap className="w-4 h-4"/>}{msg}
    </motion.div>
  );
};

// ── Countdown ring ────────────────────────────────────────────────────────────
const CountdownRing = ({ seconds, total }: { seconds:number; total:number }) => {
  const pct = seconds / total;
  const r = 28; const circ = 2*Math.PI*r;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
        <motion.circle cx="32" cy="32" r={r} fill="none"
          stroke={pct>0.5?"#34d399":pct>0.25?"#facc15":"#ef4444"}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
          transition={{ duration:0.9, ease:"linear" }}/>
      </svg>
      <span className={`font-black text-xl ${seconds<=5?"text-red-400":seconds<=10?"text-yellow-400":"text-white"}`}>
        {seconds}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function QuizPage() {
  const router = useRouter();

  const [isAdmin,    setIsAdmin   ] = useState(false);
  const [myName,     setMyName    ] = useState("");
  const [myPairs,    setMyPairs   ] = useState<DBPair[]>([]);
  const [quizzes,    setQuizzes   ] = useState<DBQuiz[]>([]);
  const [sessions,   setSessions  ] = useState<DBSession[]>([]);
  const [loading,    setLoading   ] = useState(true);
  const [toast,      setToast     ] = useState<{msg:string;type:"ok"|"err"}|null>(null);

  // Admin: create quiz form
  const [newTitle,   setNewTitle  ] = useState("");
  const [newSid,     setNewSid    ] = useState("");
  const [newXp,      setNewXp     ] = useState(50);
  const [newBonus,   setNewBonus  ] = useState(30);
  const [creating,   setCreating  ] = useState(false);

  // Admin: edit quiz questions
  const [editingQid, setEditingQid] = useState<string|null>(null);
  const [questions,  setQuestions ] = useState<DBQuizQuestion[]>([]);
  const [editQuiz,   setEditQuiz  ] = useState<DBQuiz|null>(null);
  const [qAnswers,   setQAnswers  ] = useState<DBQuizAnswer[]>([]);

  // New question form
  const [nq, setNq] = useState({ q:"",a:"",b:"",c:"",d:"",correct:"a" as "a"|"b"|"c"|"d",time:20 });

  // Player: active quiz view
  const [playerQuiz,    setPlayerQuiz   ] = useState<DBQuiz|null>(null);
  const [playerQs,      setPlayerQs     ] = useState<DBQuizQuestion[]>([]);
  const [myAnswers,     setMyAnswers     ] = useState<Record<string,string>>({});
  const [countdown,     setCountdown     ] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout|null>(null);

  const notify = (msg:string,type:"ok"|"err"="ok") => setToast({msg,type});

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const name  = localStorage.getItem("fow_my_name")??"";
    const admin = isAdminAuthed();
    setMyName(name); setIsAdmin(admin);

    const { data:qzs } = await supabase.from("quizzes").select("*").order("created_at",{ ascending:false });
    setQuizzes(qzs??[]);

    const { data:sess } = await supabase.from("sessions").select("*").order("week_number",{ ascending:false });
    setSessions(sess??[]);
    if (sess&&sess.length>0&&!newSid) setNewSid(sess[0].id);

    // Find open quiz for player
    const openQ = (qzs??[]).find((q:DBQuiz)=>q.status==="open"||q.status==="active");
    if (openQ && !admin) {
      setPlayerQuiz(openQ);
      const { data:pqs } = await supabase.from("quiz_questions").select("*")
        .eq("quiz_id",openQ.id).order("sort_order");
      setPlayerQs(pqs??[]);
      // Load my previous answers
      if (name) {
        const { data:myAns } = await supabase.from("quiz_answers").select("*")
          .eq("quiz_id",openQ.id).eq("player_name",name.toLowerCase());
        const map: Record<string,string> = {};
        (myAns??[]).forEach((a:DBQuizAnswer) => { map[a.question_id]=a.chosen; });
        setMyAnswers(map);
      }
      // Load all pairs for player
      if (name) {
        const revealed = (sess??[]).filter((s:DBSession)=>s.status==="revealed");
        const allPairs = (await Promise.all(revealed.map((s:DBSession)=>getPairs(s.id)))).flat();
        setMyPairs(allPairs.filter(p=>
          p.member_a_name.toLowerCase()===name.toLowerCase()||
          p.member_b_name.toLowerCase()===name.toLowerCase()
        ));
      }
      // Start countdown if active
      if (openQ.status==="active") startCountdown(openQ, pqs??[]);
    }
    setLoading(false);
  }, [newSid]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // ── Realtime: quiz status changes ─────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel("quiz-realtime")
      .on("postgres_changes",{ event:"*",schema:"public",table:"quizzes" }, load)
      .on("postgres_changes",{ event:"*",schema:"public",table:"quiz_answers" }, () => {
        if (editingQid) loadAnswers(editingQid);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, editingQid]); // eslint-disable-line

  const startCountdown = (quiz:DBQuiz, qs:DBQuizQuestion[]) => {
    const q = qs[quiz.current_q_index];
    if (!q) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(q.time_limit);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev<=1) { clearInterval(countdownRef.current!); return 0; }
        return prev-1;
      });
    },1000);
  };

  useEffect(() => () => { if(countdownRef.current) clearInterval(countdownRef.current); }, []);

  // ── Load questions for editing ─────────────────────────────────────────────
  const loadQuestions = async (quizId:string) => {
    const { data } = await supabase.from("quiz_questions").select("*")
      .eq("quiz_id",quizId).order("sort_order");
    setQuestions(data??[]);
  };

  const loadAnswers = async (quizId:string) => {
    const { data } = await supabase.from("quiz_answers").select("*").eq("quiz_id",quizId);
    setQAnswers(data??[]);
  };

  const openEdit = (quiz:DBQuiz) => {
    setEditingQid(quiz.id); setEditQuiz(quiz);
    loadQuestions(quiz.id); loadAnswers(quiz.id);
  };

  // ── Admin: Create quiz ─────────────────────────────────────────────────────
  const handleCreateQuiz = async () => {
    if (!newTitle.trim()) { notify("Enter a quiz title","err"); return; }
    const sess = sessions.find(s=>s.id===newSid);
    if (!sess) { notify("Select a session","err"); return; }
    setCreating(true);
    const row: DBQuiz = {
      id: genId(), session_id: newSid, week_number: sess.week_number,
      title: newTitle.trim(), status: "draft",
      current_q_index: 0, xp_per_correct: newXp, xp_pair_bonus: newBonus,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("quizzes").insert(row);
    if (error) { notify(error.message,"err"); setCreating(false); return; }
    setQuizzes(prev=>[row,...prev]);
    setNewTitle(""); openEdit(row);
    notify("Quiz created! Now add questions ✓");
    setCreating(false);
  };

  // ── Admin: Add question ────────────────────────────────────────────────────
  const handleAddQuestion = async () => {
    if (!editingQid||!nq.q.trim()||!nq.a.trim()||!nq.b.trim()||!nq.c.trim()||!nq.d.trim()) {
      notify("Fill in all fields","err"); return;
    }
    const row: DBQuizQuestion = {
      id:genId(), quiz_id:editingQid, sort_order:questions.length,
      question:nq.q.trim(), option_a:nq.a.trim(), option_b:nq.b.trim(),
      option_c:nq.c.trim(), option_d:nq.d.trim(), correct:nq.correct,
      time_limit:nq.time, created_at:new Date().toISOString(),
    };
    await supabase.from("quiz_questions").insert(row);
    setQuestions(prev=>[...prev,row]);
    setNq({ q:"",a:"",b:"",c:"",d:"",correct:"a",time:20 });
    notify("Question added ✓");
  };

  // ── Admin: Delete question ─────────────────────────────────────────────────
  const handleDeleteQ = async (id:string) => {
    await supabase.from("quiz_questions").delete().eq("id",id);
    setQuestions(prev=>prev.filter(q=>q.id!==id));
  };

  // ── Admin: Open quiz (players can see it) ──────────────────────────────────
  const handleOpenQuiz = async (id:string) => {
    if (questions.length===0) { notify("Add at least one question first","err"); return; }
    await supabase.from("quizzes").update({ status:"open", current_q_index:0 }).eq("id",id);
    setQuizzes(prev=>prev.map(q=>q.id===id?{...q,status:"open",current_q_index:0}:q));
    notify("Quiz is now open! Players can see it 👀");
  };

  // ── Admin: Start / advance question ───────────────────────────────────────
  const handleActivateQuestion = async (quizId:string, qIndex:number) => {
    await supabase.from("quizzes").update({ status:"active", current_q_index:qIndex }).eq("id",quizId);
    setQuizzes(prev=>prev.map(q=>q.id===quizId?{...q,status:"active",current_q_index:qIndex}:q));
    if (editQuiz) setEditQuiz(prev=>prev?{...prev,status:"active",current_q_index:qIndex}:null);
    notify(`Question ${qIndex+1} is LIVE ⚡`);
  };

  // ── Admin: Close quiz + award XP ──────────────────────────────────────────
  const handleCloseQuiz = async (quiz:DBQuiz) => {
    await supabase.from("quizzes").update({ status:"closed" }).eq("id",quiz.id);
    setQuizzes(prev=>prev.map(q=>q.id===quiz.id?{...q,status:"closed"}:q));

    // Award XP to correct answerers
    const { data:allAnswers } = await supabase.from("quiz_answers")
      .select("*").eq("quiz_id",quiz.id).eq("is_correct",true);
    const playerXp: Record<string,number> = {};
    (allAnswers??[]).forEach((a:DBQuizAnswer) => {
      playerXp[a.player_name] = (playerXp[a.player_name]??0) + quiz.xp_per_correct;
    });

    // Pair bonus: if both partners answered every question correctly
    const { data:pairsData } = await supabase.from("pairs")
      .select("*").eq("session_id", quiz.session_id??"");
    (pairsData??[]).forEach((pair:any) => {
      const aXp = playerXp[pair.member_a_name.toLowerCase()];
      const bXp = playerXp[pair.member_b_name.toLowerCase()];
      if (aXp !== undefined && bXp !== undefined) {
        playerXp[pair.member_a_name.toLowerCase()] = (playerXp[pair.member_a_name.toLowerCase()]??0) + quiz.xp_pair_bonus;
        playerXp[pair.member_b_name.toLowerCase()] = (playerXp[pair.member_b_name.toLowerCase()]??0) + quiz.xp_pair_bonus;
      }
    });

    // Write XP to player_profiles
    for (const [name, xp] of Object.entries(playerXp)) {
      const { data:existing } = await supabase.from("player_profiles").select("total_xp,challenge_xp").eq("name",name).maybeSingle();
      if (existing) {
        await supabase.from("player_profiles").update({
          total_xp: existing.total_xp + xp,
          challenge_xp: existing.challenge_xp + xp,
          updated_at: new Date().toISOString(),
        }).eq("name",name);
      }
    }
    notify(`Quiz closed! XP awarded to ${Object.keys(playerXp).length} players 🏆`);
  };

  // ── Admin: Delete quiz ─────────────────────────────────────────────────────
  const handleDeleteQuiz = async (id:string) => {
    await supabase.from("quizzes").delete().eq("id",id);
    setQuizzes(prev=>prev.filter(q=>q.id!==id));
    if (editingQid===id) { setEditingQid(null); setEditQuiz(null); }
    notify("Quiz deleted");
  };

  // ── Player: Submit answer ──────────────────────────────────────────────────
  const handlePlayerAnswer = async (questionId:string, chosen:"a"|"b"|"c"|"d") => {
    if (!myName||myAnswers[questionId]) return;  // already answered
    const q = playerQs.find(q=>q.id===questionId);
    if (!q) return;
    const isCorrect = chosen===q.correct;
    const row = {
      id:genId(), quiz_id:playerQuiz!.id, question_id:questionId,
      player_name:myName.toLowerCase(), chosen, is_correct:isCorrect,
      answered_at:new Date().toISOString(),
    };
    await supabase.from("quiz_answers").insert(row);
    setMyAnswers(prev=>({...prev,[questionId]:chosen}));
    if (isCorrect) notify("Correct! ✅ +XP incoming");
    else notify("Wrong answer 😬");
  };

  // ── Compute per-question answer stats for admin ────────────────────────────
  const qStats = (qId:string) => {
    const ans = qAnswers.filter(a=>a.question_id===qId);
    const total = ans.length;
    const correct = ans.filter(a=>a.is_correct).length;
    const byChoice: Record<string,number> = { a:0,b:0,c:0,d:0 };
    ans.forEach(a => { byChoice[a.chosen]=(byChoice[a.chosen]??0)+1; });
    return { total, correct, byChoice };
  };

  // ── Player leaderboard (from answers) ─────────────────────────────────────
  const playerScores = () => {
    const scores: Record<string,number> = {};
    qAnswers.filter(a=>a.is_correct).forEach(a => {
      scores[a.player_name] = (scores[a.player_name]??0)+1;
    });
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,10);
  };

  const statusColor: Record<string,string> = {
    draft:  "text-white/30 border-white/15 bg-white/5",
    open:   "text-green-400 border-green-500/30 bg-green-500/10",
    active: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    closed: "text-white/20 border-white/8 bg-white/4",
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate:360 }} transition={{ duration:1.5,repeat:Infinity,ease:"linear" }}
        className="text-4xl">🧠</motion.div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PLAYER VIEW — show active quiz question
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAdmin && playerQuiz && playerQs.length>0) {
    const currQ = playerQs[playerQuiz.current_q_index];
    const myPair = myPairs.find(p=>p.session_id===playerQuiz.session_id);

    return (
      <div className="min-h-screen text-white">
        <div className="container mx-auto px-4 pt-6 pb-16 max-w-lg">

          {/* Quiz header */}
          <motion.div initial={{ opacity:0,y:-16 }} animate={{ opacity:1,y:0 }} className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">
                🧠 {playerQuiz.title}
              </span>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${statusColor[playerQuiz.status]}`}>
                {playerQuiz.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/25 font-mono">
              <span>{playerQs.length} questions</span>
              <span>·</span>
              <span className="text-yellow-400">+{playerQuiz.xp_per_correct} XP / correct</span>
              {myPair && <><span>·</span><span className="text-green-400">+{playerQuiz.xp_pair_bonus} pair bonus</span></>}
            </div>
          </motion.div>

          {/* Question progress dots */}
          <div className="flex gap-1.5 mb-5">
            {playerQs.map((q,i)=>(
              <div key={q.id} className={`flex-1 h-1.5 rounded-full transition-all
                ${i<playerQuiz.current_q_index?"bg-green-400"
                  :i===playerQuiz.current_q_index?"bg-yellow-400 animate-pulse"
                  :"bg-white/10"}`}/>
            ))}
          </div>

          {/* Status: waiting for host to activate */}
          {playerQuiz.status==="open" && (
            <div className="text-center py-16">
              <motion.div animate={{ scale:[1,1.08,1] }} transition={{ duration:2,repeat:Infinity }}
                className="text-5xl mb-4">⏳</motion.div>
              <p className="text-white/50 font-mono text-sm">Waiting for host to start the quiz...</p>
            </div>
          )}

          {/* Active question */}
          {playerQuiz.status==="active" && currQ && (
            <motion.div key={currQ.id} initial={{ opacity:0,scale:0.95 }} animate={{ opacity:1,scale:1 }}>

              {/* Question + timer */}
              <div className="flex items-start gap-4 mb-5">
                <CountdownRing seconds={countdown} total={currQ.time_limit}/>
                <div className="flex-1">
                  <p className="text-[10px] text-white/25 font-mono mb-1">
                    Question {playerQuiz.current_q_index+1} of {playerQs.length}
                  </p>
                  <p className="text-white font-bold text-base leading-snug">{currQ.question}</p>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                {(["a","b","c","d"] as const).map(opt=>{
                  const answered = !!myAnswers[currQ.id];
                  const myChoice = myAnswers[currQ.id];
                  const isCorrect = opt===currQ.correct;
                  let cls = OPTION_COLORS[opt];
                  if (answered) {
                    if (opt===myChoice&&isCorrect) cls = OPTION_CORRECT;
                    else if (opt===myChoice&&!isCorrect) cls = OPTION_WRONG;
                    else if (isCorrect) cls = OPTION_CORRECT;
                  }

                  return (
                    <motion.button key={opt} whileTap={{ scale:answered?1:0.95 }}
                      onClick={()=>!answered&&countdown>0&&handlePlayerAnswer(currQ.id,opt)}
                      disabled={answered||countdown===0}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all
                                  ${answered?"cursor-default":countdown>0?"hover:brightness-110 cursor-pointer":"opacity-50 cursor-not-allowed"}
                                  ${cls}`}>
                      <span className="text-[10px] font-black uppercase block mb-1 opacity-60">{OPTION_LABELS[opt]}</span>
                      <span className="text-sm font-semibold leading-tight">{(currQ as any)[`option_${opt}`]}</span>
                      {answered&&opt===myAnswers[currQ.id]&&<span className="text-[9px] font-mono ml-1">{isCorrect?"✓":"✗"}</span>}
                    </motion.button>
                  );
                })}
              </div>

              {/* After answering */}
              {myAnswers[currQ.id] && (
                <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} className="mt-5 text-center">
                  <p className="text-white/40 text-sm font-mono">
                    {myAnswers[currQ.id]===currQ.correct
                      ? "🎉 Correct! Waiting for next question..."
                      : `❌ Correct answer was ${OPTION_LABELS[currQ.correct]}. Next question soon...`}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Quiz closed — results */}
          {playerQuiz.status==="closed" && (
            <div className="flex flex-col gap-4">
              <div className="text-center py-4">
                <div className="text-4xl mb-2">🏆</div>
                <h2 className="text-2xl font-black text-white">Quiz Over!</h2>
                {myName && (
                  <p className="text-white/40 text-sm mt-1">
                    You got {qAnswers.filter(a=>a.player_name===myName.toLowerCase()&&a.is_correct).length} / {playerQs.length} correct
                  </p>
                )}
              </div>
              <div>
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-3">Top Players</p>
                {playerScores().map(([name,score],i)=>(
                  <div key={name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5
                                              ${name===myName.toLowerCase()?"bg-white/10 border border-white/15":"bg-white/5"}`}>
                    <span className="text-sm">{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                    <span className="flex-1 text-sm font-semibold text-white capitalize">{name}</span>
                    <span className="text-yellow-300 font-black font-mono text-sm">{score}/{playerQs.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <AnimatePresence>{toast&&<Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}</AnimatePresence>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PLAYER VIEW — no active quiz
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAdmin) return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-black"><span className="text-white">Weekly </span>
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">Quiz</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Answer questions with your pair. Earn XP for correct answers.</p>
        </div>

        {!isAdmin && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/4 border border-white/8">
            <Lock className="w-3.5 h-3.5 text-white/20 shrink-0"/>
            <span className="text-white/30 text-xs font-mono">Are you the host?</span>
            <button onClick={()=>router.push("/game/admin/login")}
              className="ml-auto text-[10px] text-red-400 font-mono hover:text-red-300">Admin Login →</button>
          </motion.div>
        )}

        <div className="text-center py-16">
          <div className="text-5xl mb-4">🧠</div>
          <p className="text-white/40 text-sm font-mono">No quiz is open right now.</p>
          <p className="text-white/20 text-xs font-mono mt-1">Come back when the host starts one!</p>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN VIEW
  // ─────────────────────────────────────────────────────────────────────────────

  // Quiz editor (open question view)
  if (editingQid && editQuiz) {
    const currActive = editQuiz.status==="active" ? questions[editQuiz.current_q_index] : null;
    return (
      <div className="min-h-screen text-white">
        <div className="container mx-auto px-4 pt-6 pb-16 max-w-lg">

          {/* Back */}
          <button onClick={()=>{ setEditingQid(null); setEditQuiz(null); }}
            className="flex items-center gap-1.5 text-white/35 hover:text-white text-xs font-mono mb-5 transition-colors">
            ← Back to quizzes
          </button>

          {/* Quiz info + controls */}
          <div className="mb-5 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-white text-base">{editQuiz.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${statusColor[editQuiz.status]}`}>
                    {editQuiz.status}
                  </span>
                  <span className="text-[9px] text-white/25 font-mono">{questions.length} questions</span>
                  <span className="text-[9px] text-yellow-400 font-mono">+{editQuiz.xp_per_correct}xp</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {editQuiz.status==="draft" && (
                  <motion.button whileTap={{ scale:0.97 }} onClick={()=>handleOpenQuiz(editQuiz.id)}
                    disabled={questions.length===0}
                    className="px-3 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold disabled:opacity-40">
                    Open Quiz
                  </motion.button>
                )}
                {(editQuiz.status==="open"||editQuiz.status==="active") && (
                  <>
                    <motion.button whileTap={{ scale:0.97 }}
                      onClick={()=>handleActivateQuestion(editQuiz.id, editQuiz.current_q_index)}
                      className="px-3 py-2 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-bold">
                      {editQuiz.status==="open"?"▶ Start Q1":`▶ Q${editQuiz.current_q_index+1} again`}
                    </motion.button>
                    {editQuiz.current_q_index < questions.length-1 && (
                      <motion.button whileTap={{ scale:0.97 }}
                        onClick={()=>handleActivateQuestion(editQuiz.id, editQuiz.current_q_index+1)}
                        className="px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold">
                        Next →
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale:0.97 }} onClick={()=>handleCloseQuiz(editQuiz)}
                      className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold">
                      Close + XP
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Live answers for current question */}
          {currActive && (
            <div className="mb-5 p-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/5">
              <p className="text-[9px] text-yellow-400 font-mono uppercase tracking-widest mb-2">
                🔴 Live — Q{editQuiz.current_q_index+1}: {currActive.question}
              </p>
              {(() => { const s=qStats(currActive.id); return (
                <div>
                  <p className="text-[10px] text-white/40 font-mono mb-2">
                    {s.total} answers · {s.correct} correct ({s.total>0?Math.round(s.correct/s.total*100):0}%)
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["a","b","c","d"] as const).map(opt=>(
                      <div key={opt} className={`p-2 rounded-xl border text-center ${opt===currActive.correct?OPTION_CORRECT:OPTION_COLORS[opt]}`}>
                        <p className="font-black text-xs">{OPTION_LABELS[opt]}</p>
                        <p className="font-black text-lg">{s.byChoice[opt]??0}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ); })()}
            </div>
          )}

          {/* Questions list */}
          <div className="flex flex-col gap-2.5 mb-6">
            {questions.map((q,i)=>{
              const s = qStats(q.id);
              const isActive = editQuiz.status==="active" && editQuiz.current_q_index===i;
              return (
                <div key={q.id}
                  className={`p-4 rounded-2xl border transition-all
                              ${isActive?"border-yellow-400/40 bg-yellow-400/8":"border-white/8 bg-white/4"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-[9px] text-white/25 font-mono uppercase mb-1">Q{i+1} · {q.time_limit}s</p>
                      <p className="text-white font-semibold text-sm mb-2">{q.question}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {(["a","b","c","d"] as const).map(opt=>(
                          <p key={opt} className={`text-[10px] font-mono px-2 py-1 rounded-lg
                                                    ${opt===q.correct?"text-green-400 bg-green-400/10":"text-white/30"}`}>
                            {OPTION_LABELS[opt]}: {(q as any)[`option_${opt}`]}
                            {opt===q.correct&&" ✓"}
                          </p>
                        ))}
                      </div>
                      {s.total>0&&<p className="text-[9px] text-white/20 font-mono mt-1">{s.total} answers · {s.correct} correct</p>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {editQuiz.status!=="closed" && (
                        <motion.button whileTap={{ scale:0.85 }} onClick={()=>handleActivateQuestion(editQuiz.id,i)}
                          className="w-7 h-7 rounded-lg bg-yellow-400/15 hover:bg-yellow-400/25 flex items-center justify-center transition-colors text-yellow-400 text-xs">
                          ▶
                        </motion.button>
                      )}
                      {editQuiz.status==="draft" && (
                        <motion.button whileTap={{ scale:0.85 }} onClick={()=>handleDeleteQ(q.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/15 flex items-center justify-center transition-colors">
                          <Trash2 className="w-3 h-3 text-white/25"/>
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add question form */}
          {(editQuiz.status==="draft"||editQuiz.status==="open") && (
            <div className="p-5 rounded-2xl border border-dashed border-white/15 bg-white/3">
              <p className="text-[9px] text-white/25 font-mono uppercase tracking-widest mb-3">+ Add Question</p>
              <div className="flex flex-col gap-2.5">
                <textarea value={nq.q} onChange={e=>setNq(p=>({...p,q:e.target.value}))} rows={2}
                  placeholder="Question text..." maxLength={200}
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm
                             placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"/>
                <div className="grid grid-cols-2 gap-2">
                  {(["a","b","c","d"] as const).map(opt=>(
                    <div key={opt} className="relative">
                      <input type="text" value={(nq as any)[opt]} onChange={e=>setNq(p=>({...p,[opt]:e.target.value}))}
                        placeholder={`Option ${OPTION_LABELS[opt]}`} maxLength={80}
                        className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-white text-xs
                                    placeholder-white/20 focus:outline-none transition-all pr-6
                                    ${nq.correct===opt?"border-green-400/50":"border-white/10"}`}/>
                      <button onClick={()=>setNq(p=>({...p,correct:opt}))}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all
                                    ${nq.correct===opt?"bg-green-400 border-green-400":"border-white/20"}`}/>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/25 font-mono shrink-0">Time:</span>
                  <input type="range" min={10} max={60} step={5} value={nq.time}
                    onChange={e=>setNq(p=>({...p,time:Number(e.target.value)}))} className="flex-1 accent-yellow-400"/>
                  <span className="text-[10px] text-yellow-400 font-mono w-10">{nq.time}s</span>
                </div>
                <motion.button whileTap={{ scale:0.97 }} onClick={handleAddQuestion}
                  disabled={!nq.q.trim()||!nq.a.trim()||!nq.b.trim()||!nq.c.trim()||!nq.d.trim()}
                  className="w-full py-2.5 bg-white/10 border border-white/15 rounded-xl text-white text-sm font-bold
                             disabled:opacity-40 hover:bg-white/15 transition-all">
                  <Plus className="w-3.5 h-3.5 inline mr-1.5"/>Add Question
                </motion.button>
              </div>
            </div>
          )}
        </div>
        <AnimatePresence>{toast&&<Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}</AnimatePresence>
      </div>
    );
  }

  // Admin quiz list
  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">
        <motion.div initial={{ opacity:0,y:-16 }} animate={{ opacity:1,y:0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-white/25 font-mono tracking-widest uppercase">Admin · Quiz</span>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-mono">ADMIN</span>
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">Weekly </span>
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">Quiz</span>
          </h1>
          <p className="text-white/25 text-sm mt-1">Create multiple-choice quizzes. Control question by question.</p>
        </motion.div>

        {/* Create form */}
        <div className="p-5 rounded-3xl border border-white/10 bg-white/5 mb-6">
          <p className="text-[9px] text-white/25 font-mono uppercase tracking-widest mb-4">✦ New Quiz</p>

          {/* Session picker */}
          <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">Session</label>
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
            {sessions.slice(0,6).map(s=>(
              <motion.button key={s.id} whileTap={{ scale:0.95 }} onClick={()=>setNewSid(s.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all
                            ${newSid===s.id?"border-yellow-400/50 bg-yellow-400/10 text-yellow-300":"border-white/8 bg-white/4 text-white/40"}`}>
                Wk{s.week_number}
              </motion.button>
            ))}
          </div>

          <input type="text" value={newTitle} onChange={e=>setNewTitle(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleCreateQuiz()} placeholder="Quiz title..."
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm
                       placeholder-white/20 focus:outline-none focus:border-yellow-500/50 mb-3"/>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-[9px] text-white/25 font-mono block mb-1">XP / correct</label>
              <input type="number" value={newXp} onChange={e=>setNewXp(Number(e.target.value))} min={10} max={200} step={10}
                className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-yellow-400 font-black text-sm focus:outline-none"/>
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-white/25 font-mono block mb-1">Pair bonus</label>
              <input type="number" value={newBonus} onChange={e=>setNewBonus(Number(e.target.value))} min={0} max={100} step={10}
                className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-green-400 font-black text-sm focus:outline-none"/>
            </div>
          </div>

          <motion.button whileTap={{ scale:0.97 }} onClick={handleCreateQuiz}
            disabled={creating||!newTitle.trim()||!newSid}
            className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-xl
                       font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2">
            {creating?<><RefreshCw className="w-4 h-4 animate-spin"/>Creating...</>:<><Plus className="w-4 h-4"/>Create Quiz</>}
          </motion.button>
        </div>

        {/* Quiz list */}
        {quizzes.length===0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🧠</div>
            <p className="text-white/30 text-sm font-mono">No quizzes yet. Create one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {quizzes.map((quiz,i)=>(
              <motion.div key={quiz.id} layout initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
                transition={{ delay:i*0.05 }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer hover:bg-white/6
                            ${quiz.status==="active"?"border-yellow-400/30 bg-yellow-400/5":"border-white/8 bg-white/4"}`}>
                <div className="flex items-start gap-3">
                  <div onClick={()=>openEdit(quiz)} className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{quiz.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[9px] text-white/25 font-mono">Wk {quiz.week_number}</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border ${statusColor[quiz.status]}`}>
                        {quiz.status}
                      </span>
                      <span className="text-[9px] text-yellow-400 font-mono">+{quiz.xp_per_correct}xp</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <motion.button whileTap={{ scale:0.9 }} onClick={()=>openEdit(quiz)}
                      className="px-3 py-1.5 rounded-xl bg-white/8 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/15">
                      Edit →
                    </motion.button>
                    <motion.button whileTap={{ scale:0.85 }} onClick={()=>handleDeleteQuiz(quiz.id)}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/15 flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5 text-white/25"/>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>{toast&&<Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}</AnimatePresence>
    </div>
  );
}