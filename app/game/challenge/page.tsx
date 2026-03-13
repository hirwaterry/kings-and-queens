"use client";
// app/game/challenge/page.tsx

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Send, Star, Zap, Check, ChevronDown, ChevronUp,
  Trash2, Edit3, RefreshCw, Lock, Shuffle,
} from "lucide-react";
import {
  supabase, createChallenge, getAllChallenges,
  getAnswersForChallenge, submitAnswer, judgeAnswer, updateChallengeStatus,
  getPairs,
  type DBWeeklyChallenge, type DBChallengeAnswer, type DBPair, type DBSession,
} from "@/lib/supabase";
import { isAdminAuthed } from "@/hooks/useAdmin";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK
// ─────────────────────────────────────────────────────────────────────────────
const TOPICS = ["Icebreaker", "Culture", "Deep Talk", "Fun", "Creative", "Challenge", "Values", "Future"];

const TOPIC_META: Record<string, { emoji: string; color: string; bg: string }> = {
  "Icebreaker": { emoji:"🤝", color:"text-blue-300",   bg:"bg-blue-500/15 border-blue-500/30"    },
  "Culture":    { emoji:"🌍", color:"text-green-300",  bg:"bg-green-500/15 border-green-500/30"  },
  "Deep Talk":  { emoji:"💬", color:"text-violet-300", bg:"bg-violet-500/15 border-violet-500/30"},
  "Fun":        { emoji:"🎉", color:"text-yellow-300", bg:"bg-yellow-500/15 border-yellow-500/30"},
  "Creative":   { emoji:"🎨", color:"text-pink-300",   bg:"bg-pink-500/15 border-pink-500/30"    },
  "Challenge":  { emoji:"⚡", color:"text-orange-300", bg:"bg-orange-500/15 border-orange-500/30"},
  "Values":     { emoji:"🧭", color:"text-teal-300",   bg:"bg-teal-500/15 border-teal-500/30"    },
  "Future":     { emoji:"🚀", color:"text-indigo-300", bg:"bg-indigo-500/15 border-indigo-500/30"},
};

const TOPIC_QUESTIONS: Record<string, string[]> = {
  "Icebreaker": [
    "What's one surprising thing you both have in common that nobody would guess?",
    "If you were a dish on a Rwandan menu, what would you be and why?",
    "Describe your personality using only three emojis — then explain them to each other.",
    "What's the most random skill you each have that most people don't know about?",
    "If your life had a theme song right now, what would it be?",
    "What was the last thing that made you genuinely laugh out loud?",
    "Tell each other one childhood memory that still makes you smile.",
    "If you could only eat one meal for the rest of the year, what would it be?",
  ],
  "Culture": [
    "Share a Rwandan proverb that resonates with both of you and explain why.",
    "What's one cultural tradition from your family you're most proud of?",
    "What's something unique about how you celebrate your favourite holiday?",
    "If you could bring one Rwandan tradition to any other country, what would it be?",
    "What food from your upbringing do you wish more people knew about?",
    "Describe how your culture shaped how you approach friendships.",
    "What's a cultural misunderstanding you've had to explain to someone?",
    "If you could preserve one aspect of Rwandan culture forever, what would it be?",
  ],
  "Deep Talk": [
    "What's one goal you're both silently working toward right now?",
    "What do you wish more people understood about you without you having to explain it?",
    "What's a belief you held 3 years ago that you've since completely changed?",
    "If you could send a message to your 15-year-old self, what would it say?",
    "What's the kindest thing a stranger has ever done for you?",
    "When did you last feel truly proud of yourself, and for what?",
    "What does success actually look like to you — not what others expect, but really?",
    "What's one thing you're still figuring out about yourself?",
  ],
  "Fun": [
    "You're both stranded on an island — what three items did each of you bring?",
    "Plan your ideal 24 hours together in Kigali with a 50,000 RWF budget.",
    "If you swapped jobs for a week, what chaos would unfold?",
    "What would your pair name be if you were a crime-fighting duo?",
    "Create a business idea using only the skills between the two of you.",
    "If you had to star in a reality show together, what kind and what's the plot?",
    "What animal best represents each of your personalities and why?",
    "If your friendship was a movie, what's the genre, title, and who plays each of you?",
  ],
  "Creative": [
    "Write a 4-line poem about this week together. It doesn't have to be good.",
    "Describe your pair using only weather metaphors — what kind of storm are you?",
    "Design a flag for your pair. What symbols are on it and what do they mean?",
    "If you were to paint a portrait of this week, what colors would dominate?",
    "Write the opening line of a novel that starts with your first conversation.",
    "Create a motto for your pair — 10 words max, make it memorable.",
    "If your friendship was a season of the year, which is it and why?",
    "Describe each other in exactly 6 words. No more, no less.",
  ],
  "Challenge": [
    "Teach each other one thing in 90 seconds. Proof of learning required.",
    "Both do 15 squats right now and send proof in the group chat.",
    "Find something you BOTH own that most people your age don't have.",
    "Each of you share your most embarrassing recent moment — the funnier the better.",
    "Call or text someone you haven't spoken to in 3+ months. Report back.",
    "Switch phones for 2 minutes. What's the most interesting thing you saw?",
    "Find a hidden talent in each other in under 5 minutes.",
    "Make up a handshake that represents your pair and teach it to someone else.",
  ],
  "Values": [
    "What's one value you refuse to compromise on, no matter what?",
    "If you had to donate 10% of everything you earned, where would it go?",
    "What does loyalty mean to each of you — and where's the line?",
    "Describe a moment when doing the right thing was really hard.",
    "What's something most people treat as optional that you think is essential?",
    "If you could fix one broken thing in society, what would you fix first?",
    "What role does faith or spirituality play in how you make decisions?",
    "What's the most important lesson your parents taught you, intentionally or not?",
  ],
  "Future": [
    "Where do you both see yourselves in exactly 5 years? Be specific.",
    "What's one dream that scares you because you're not sure you can pull it off?",
    "If you could learn one skill in the next 90 days, what would it be and why?",
    "What kind of legacy do you want to leave — not fame, but impact?",
    "If you could live in any city in the world for a year, which one and why?",
    "What does your ideal week look like in 10 years?",
    "If money weren't a factor, what would you spend most of your time doing?",
    "What's one thing you're building toward right now that excites you most?",
  ],
};

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

// ── Score slider ───────────────────────────────────────────────────────────────
const ScoreSlider = ({ value, onChange }: { value:number; onChange:(v:number)=>void }) => (
  <div className="flex items-center gap-3">
    <input type="range" min={0} max={100} value={value}
      onChange={e=>onChange(Number(e.target.value))} className="flex-1 accent-yellow-400 h-1.5"/>
    <div className="w-12 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
      <span className="text-yellow-300 font-black text-sm">{value}</span>
    </div>
  </div>
);

// ── Answer card ───────────────────────────────────────────────────────────────
const AnswerCard = ({ answer, maxXp, onJudge }: {
  answer: DBChallengeAnswer; maxXp:number; onJudge:(id:string,score:number)=>void
}) => {
  const [score,   setScore  ] = useState(answer.score ?? 70);
  const [judging, setJudging] = useState(false);
  const [done,    setDone   ] = useState(answer.score !== null);
  const xpPreview = Math.round((score/100)*maxXp/2);

  return (
    <motion.div layout initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      className={`p-4 rounded-2xl border ${done?"border-green-500/30 bg-green-500/6":"border-white/10 bg-white/5"}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20">
          <span className="text-[10px] text-yellow-300 font-bold">{answer.player_a_name}</span>
          <span className="text-white/20 text-[10px]">×</span>
          <span className="text-[10px] text-rose-300 font-bold">{answer.player_b_name}</span>
        </div>
        {done && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-green-400 font-mono">
            <Check className="w-3 h-3"/> {answer.score}/100 · +{answer.xp_awarded} XP each
          </div>
        )}
      </div>
      <p className="text-white/80 text-sm mb-3 leading-relaxed">{answer.answer}</p>
      {!done && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span className="font-mono">Score: {score}/100</span>
            <span className="text-yellow-400 font-mono">+{xpPreview} XP each</span>
          </div>
          <ScoreSlider value={score} onChange={setScore}/>
          <motion.button whileTap={{ scale:0.97 }} disabled={judging}
            onClick={async () => { setJudging(true); await onJudge(answer.id, score); setDone(true); setJudging(false); }}
            className="w-full py-2.5 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900
                       rounded-xl font-black text-sm flex items-center justify-center gap-2">
            {judging?"Awarding...":<><Star className="w-4 h-4"/>Award XP</>}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

// ── Player submit card ────────────────────────────────────────────────────────
const PlayerChallengeCard = ({
  challenge, myPair, hasSubmitted, onSubmit, onNeedProfile,
}: {
  challenge: DBWeeklyChallenge; myPair: DBPair|null; hasSubmitted: boolean;
  onSubmit:(challengeId:string,answer:string)=>void; onNeedProfile:()=>void;
}) => {
  const [answer, setAnswer] = useState("");
  const meta = TOPIC_META[challenge.topic ?? "Icebreaker"] ?? TOPIC_META["Icebreaker"];

  if (hasSubmitted) return (
    <motion.div initial={{ scale:0.95 }} animate={{ scale:1 }}
      className="p-5 rounded-2xl border border-green-500/30 bg-green-500/8 text-center">
      <div className="text-3xl mb-2">✅</div>
      <p className="text-green-300 font-bold text-sm">Answer submitted!</p>
      <p className="text-white/30 text-xs mt-1">Waiting for host to score...</p>
    </motion.div>
  );

  if (!myPair) return (
    <div className={`p-4 rounded-2xl border ${meta.bg} text-center`}>
      <p className="text-white/50 text-sm mb-3">You need a name and active pair to answer.</p>
      <motion.button whileTap={{ scale:0.97 }} onClick={onNeedProfile}
        className="px-5 py-2.5 bg-violet-500/25 border border-violet-500/40 rounded-xl text-violet-300 font-bold text-sm">
        Set Up Profile
      </motion.button>
    </div>
  );

  return (
    <div className={`p-4 rounded-2xl border ${meta.bg} flex flex-col gap-3`}>
      <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono">
        <span>Answering as</span>
        <span className="text-yellow-300 font-bold">{myPair.member_a_name}</span>
        <span>&</span>
        <span className="text-rose-300 font-bold">{myPair.member_b_name}</span>
      </div>
      <textarea value={answer} onChange={e=>setAnswer(e.target.value)} rows={3}
        placeholder="Write your answer together..."
        className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white
                   text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-all resize-none"/>
      <motion.button whileTap={{ scale:0.97 }}
        onClick={() => onSubmit(challenge.id, answer.trim())} disabled={!answer.trim()}
        className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl
                   font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
        <Send className="w-4 h-4"/>Submit Answer
      </motion.button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ChallengePage() {
  const router = useRouter();

  const [isAdmin,       setIsAdmin      ] = useState(false);
  const [challenges,    setChallenges   ] = useState<DBWeeklyChallenge[]>([]);
  const [allSessions,   setAllSessions  ] = useState<DBSession[]>([]);
  const [selectedSid,   setSelectedSid  ] = useState<string>("");   // session chosen for new challenge
  const [expanded,      setExpanded     ] = useState<string|null>(null);
  const [answers,       setAnswers      ] = useState<Record<string, DBChallengeAnswer[]>>({});
  const [myPairs,       setMyPairs      ] = useState<DBPair[]>([]);
  const [myName,        setMyName       ] = useState("");
  const [submittedIds,  setSubmittedIds ] = useState<Set<string>>(new Set());
  const [toast,         setToast        ] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const [loading,       setLoading      ] = useState(true);

  // Create/edit form
  const [question,      setQuestion     ] = useState("");
  const [topic,         setTopic        ] = useState("Icebreaker");
  const [maxXp,         setMaxXp        ] = useState(200);
  const [creating,      setCreating     ] = useState(false);
  const [showSugg,      setShowSugg     ] = useState(false);
  const [editingId,     setEditingId    ] = useState<string|null>(null);
  const [editQuestion,  setEditQuestion ] = useState("");

  const notify = (msg:string, type:"ok"|"err"="ok") => setToast({msg,type});

  const load = useCallback(async () => {
    setLoading(true);
    const name  = localStorage.getItem("fow_my_name") ?? "";
    const admin = isAdminAuthed();
    setMyName(name);
    setIsAdmin(admin);

    // Load all sessions for the dropdown
    const { data: sessions } = await supabase
      .from("sessions").select("*").order("week_number", { ascending: false });
    const sessionList: DBSession[] = sessions ?? [];
    setAllSessions(sessionList);

    // Default selection: most recent session
    if (sessionList.length > 0 && !selectedSid) {
      setSelectedSid(sessionList[0].id);
    }

    // Load all challenges
    const { data: cData } = await supabase
      .from("weekly_challenges").select("*").order("created_at", { ascending: false });
    setChallenges(cData ?? []);

    // Load my pairs
    if (name) {
      const revealed = sessionList.filter(s => s.status === "revealed");
      const allPairs = (await Promise.all(revealed.map(s => getPairs(s.id)))).flat();
      const mine = allPairs.filter(p =>
        p.member_a_name.toLowerCase() === name.toLowerCase() ||
        p.member_b_name.toLowerCase() === name.toLowerCase()
      );
      setMyPairs(mine);

      if (mine.length > 0) {
        const { data: myAnswers } = await supabase.from("challenge_answers")
          .select("challenge_id").in("pair_id", mine.map(p=>p.id));
        setSubmittedIds(new Set((myAnswers??[]).map((a:any) => a.challenge_id)));
      }
    }
    setLoading(false);
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("challenge-live")
      .on("postgres_changes",{ event:"*", schema:"public", table:"challenge_answers" }, load)
      .on("postgres_changes",{ event:"*", schema:"public", table:"weekly_challenges" }, load)
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  }, [load]);

  const loadAnswers = async (id:string) => {
    const ans = await getAnswersForChallenge(id);
    setAnswers(prev => ({...prev, [id]:ans}));
  };

  const handleExpand = (id:string) => {
    if (expanded===id) { setExpanded(null); return; }
    setExpanded(id); loadAnswers(id);
  };

  // ── Admin: Create ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!question.trim()) { notify("Enter a question first","err"); return; }
    if (!selectedSid)     { notify("Select a session first","err"); return; }
    const sess = allSessions.find(s => s.id === selectedSid);
    if (!sess)            { notify("Session not found","err"); return; }
    setCreating(true);
    try {
      const c = await createChallenge(selectedSid, sess.week_number, question.trim(), topic, maxXp);
      setChallenges(prev=>[c,...prev]);
      setQuestion("");
      notify(`Challenge posted for Week ${sess.week_number}! 🎯`);
    } catch(e:any) { notify(e.message,"err"); }
    setCreating(false);
  };

  // ── Admin: Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async (id:string) => {
    await supabase.from("weekly_challenges").delete().eq("id",id);
    setChallenges(prev=>prev.filter(c=>c.id!==id));
    notify("Challenge deleted");
  };

  // ── Admin: Save edit ──────────────────────────────────────────────────────────
  const handleSaveEdit = async (id:string) => {
    if (!editQuestion.trim()) return;
    await supabase.from("weekly_challenges").update({ question: editQuestion.trim() }).eq("id",id);
    setChallenges(prev=>prev.map(c=>c.id===id?{...c,question:editQuestion.trim()}:c));
    setEditingId(null);
    notify("Updated ✏️");
  };

  // ── Player: Submit ────────────────────────────────────────────────────────────
  const handleSubmitAnswer = async (challengeId:string, answer:string) => {
    const challenge = challenges.find(c=>c.id===challengeId);
    if (!challenge) return;
    const myPair = myPairs.find(p=>p.session_id===challenge.session_id);
    if (!myPair) { notify("You're not in a pair for this session","err"); return; }
    try {
      await submitAnswer(challengeId, challenge.session_id, myPair.id,
        myPair.member_a_name, myPair.member_b_name, answer);
      setSubmittedIds(prev=>new Set([...prev,challengeId]));
      notify("Answer submitted! Waiting for host to score 🎯");
    } catch(e:any) { notify(e.message,"err"); }
  };

  // ── Admin: Judge ──────────────────────────────────────────────────────────────
  const handleJudge = async (answerId:string, score:number) => {
    const challengeId = Object.keys(answers).find(cid=>answers[cid].some(a=>a.id===answerId))!;
    const challenge = challenges.find(c=>c.id===challengeId)!;
    const answer    = answers[challengeId].find(a=>a.id===answerId)!;
    await judgeAnswer(answerId, score, challenge.max_xp, answer.player_a_name, answer.player_b_name);
    notify(`+${Math.round((score/100)*challenge.max_xp)} XP awarded 🏆`);
    loadAnswers(challengeId);
  };

  const latestPair = myPairs[myPairs.length-1] ?? null;
  const meta = TOPIC_META[topic] ?? TOPIC_META["Icebreaker"];
  const pickRandom = () => {
    const pool = TOPIC_QUESTIONS[topic] ?? [];
    setQuestion(pool[Math.floor(Math.random()*pool.length)] ?? "");
  };

  const selectedSession = allSessions.find(s => s.id === selectedSid);

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-violet-400"/>
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Weekly Challenge</span>
            {isAdmin && <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 font-mono">ADMIN</span>}
          </div>
          <h1 className="text-3xl font-black">
            <span className="text-white">{isAdmin?"Post a ":"Earn "}</span>
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">{isAdmin?"Challenge":"Bonus XP"}</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">
            {isAdmin ? "Pick any session, post your question, judge answers." : "Answer with your pair. Host scores you. XP on your profile."}
          </p>
        </motion.div>

        {/* Admin login hint for non-admins */}
        {!isAdmin && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/4 border border-white/8">
            <Lock className="w-3.5 h-3.5 text-white/20 shrink-0"/>
            <span className="text-white/30 text-xs font-mono">Are you the host?</span>
            <button onClick={() => router.push("/game/admin/login")}
              className="ml-auto text-[10px] text-red-400 font-mono hover:text-red-300 transition-colors">
              Admin Login →
            </button>
          </motion.div>
        )}

        {/* ── ADMIN: Create form ── */}
        {isAdmin && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 mb-6">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mb-4">✦ Post a Challenge</p>

            {/* ── SESSION PICKER ── */}
            <div className="mb-4">
              <label className="text-[10px] text-white/30 font-mono uppercase tracking-widest block mb-1.5">
                Attach to Week
              </label>
              {allSessions.length === 0 ? (
                <div className="px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <p className="text-orange-400 text-xs font-mono">
                    ⚠️ No sessions yet. Go to <button onClick={()=>router.push("/game/admin/live")}
                      className="underline text-orange-300">Admin → Host Session</button> to create one.
                  </p>
                </div>
              ) : (
                <div className="grid gap-1.5 max-h-40 overflow-y-auto pr-1"
                  style={{ scrollbarWidth:"none" }}>
                  {allSessions.map(sess => (
                    <motion.button key={sess.id} whileTap={{ scale:0.98 }}
                      onClick={() => setSelectedSid(sess.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                                  ${selectedSid===sess.id
                                    ? "border-violet-400/60 bg-violet-400/12"
                                    : "border-white/8 bg-white/4 hover:border-white/20"}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0
                                       ${selectedSid===sess.id ? "bg-violet-400/20 text-violet-300" : "bg-white/8 text-white/40"}`}>
                        W{sess.week_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${selectedSid===sess.id?"text-white":"text-white/60"}`}>
                          Week {sess.week_number}
                        </p>
                        <p className="text-[9px] font-mono text-white/25">{sess.date}</p>
                      </div>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border shrink-0
                                        ${sess.status==="lobby"?"text-green-400 border-green-500/25 bg-green-500/8"
                                          :sess.status==="revealed"?"text-blue-400 border-blue-500/25 bg-blue-500/8"
                                          :"text-yellow-400 border-yellow-500/25 bg-yellow-500/8"}`}>
                        {sess.status}
                      </span>
                      {selectedSid===sess.id && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0"/>}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {allSessions.length > 0 && (
              <>
                {/* Topic pills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {TOPICS.map(t => {
                    const m = TOPIC_META[t];
                    return (
                      <motion.button key={t} whileTap={{ scale:0.93 }} onClick={()=>{setTopic(t);setShowSugg(false);}}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border
                                    ${topic===t ? `${m.bg} ${m.color}` : "bg-white/5 border-white/8 text-white/35 hover:text-white/60"}`}>
                        {m.emoji} {t}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Question input */}
                <div className="relative mb-2">
                  <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={2}
                    placeholder="Type your challenge question here..."
                    className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white
                               placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all resize-none pr-28"/>
                  <div className="absolute bottom-2.5 right-2 flex items-center gap-1">
                    <motion.button whileTap={{ scale:0.85 }} onClick={pickRandom}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/8 hover:bg-white/15
                                 text-[9px] text-white/40 font-mono transition-all">
                      <Shuffle className="w-2.5 h-2.5"/>Random
                    </motion.button>
                    <motion.button whileTap={{ scale:0.85 }} onClick={()=>setShowSugg(!showSugg)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 text-[9px] text-violet-400 font-mono">
                      {showSugg?"▲":"▼"} List
                    </motion.button>
                  </div>
                </div>

                <AnimatePresence>
                  {showSugg && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                      exit={{ opacity:0, height:0 }} className="overflow-hidden mb-3">
                      <div className={`rounded-xl border p-2 ${meta.bg} flex flex-col gap-0.5`}>
                        <p className="text-[8px] font-mono text-white/25 px-2 mb-1 uppercase tracking-wider">
                          {meta.emoji} {topic} · {TOPIC_QUESTIONS[topic].length} questions
                        </p>
                        {TOPIC_QUESTIONS[topic].map((q,i)=>(
                          <motion.button key={i} whileTap={{ scale:0.98 }}
                            onClick={()=>{ setQuestion(q); setShowSugg(false); }}
                            className="text-left text-xs text-white/55 hover:text-white py-1.5 px-2.5
                                       rounded-lg hover:bg-white/10 transition-all leading-relaxed">{q}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* XP pool */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] text-white/30 font-mono shrink-0">XP Pool:</span>
                  <input type="range" min={50} max={500} step={50} value={maxXp}
                    onChange={e=>setMaxXp(Number(e.target.value))} className="flex-1 accent-violet-400 h-1.5"/>
                  <div className="w-16 h-7 rounded-lg bg-violet-400/15 border border-violet-400/30 flex items-center justify-center">
                    <span className="text-violet-300 font-black text-xs">{maxXp} XP</span>
                  </div>
                </div>

                <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.97 }}
                  onClick={handleCreate} disabled={creating||!question.trim()||!selectedSid}
                  className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl
                             font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40
                             shadow-lg shadow-violet-500/20">
                  {creating
                    ? <><RefreshCw className="w-4 h-4 animate-spin"/>Posting...</>
                    : <><Plus className="w-4 h-4"/>Post to {selectedSession ? `Week ${selectedSession.week_number}` : "..."}</>}
                </motion.button>
              </>
            )}
          </motion.div>
        )}

        {/* ── Challenges list ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:"linear" }}
              className="text-3xl">🎯</motion.div>
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🎯</div>
            <p className="text-white/30 text-sm font-mono">No challenges yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {challenges.map((c, i) => {
              const isOpen   = expanded===c.id;
              const cAnswers = answers[c.id] ?? [];
              const judged   = cAnswers.filter(a=>a.score!==null).length;
              const topicM   = TOPIC_META[c.topic??"Icebreaker"] ?? TOPIC_META["Icebreaker"];
              const isEditing = editingId===c.id;
              const sessLabel = allSessions.find(s=>s.id===c.session_id);

              return (
                <motion.div key={c.id} layout initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay:i*0.04 }} className="rounded-2xl overflow-hidden">

                  <div className={`flex items-center gap-3 p-3.5 border transition-all
                                   ${isOpen?"border-violet-500/30 bg-violet-500/10":"border-white/8 bg-white/5"}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border ${topicM.bg}`}>
                      {topicM.emoji}
                    </div>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>handleExpand(c.id)}>
                      <p className="text-white font-semibold text-sm truncate">{c.question}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] text-white/25 font-mono">Wk {c.week_number}</span>
                        {sessLabel && <span className="text-[8px] text-white/15 font-mono">{sessLabel.date}</span>}
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border
                                          ${c.status==="open"?"bg-green-500/12 text-green-400 border-green-500/20"
                                            :c.status==="judging"?"bg-yellow-500/12 text-yellow-400 border-yellow-500/20"
                                            :"bg-white/5 text-white/25 border-white/8"}`}>
                          {c.status}
                        </span>
                        <span className={`text-[9px] font-mono ${topicM.color}`}>{c.topic}</span>
                        <span className="text-[9px] text-white/25 font-mono">{c.max_xp} XP</span>
                        {cAnswers.length>0&&<span className="text-[9px] text-white/20 font-mono">{judged}/{cAnswers.length} judged</span>}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <motion.button whileTap={{ scale:0.85 }}
                          onClick={()=>{ setEditingId(c.id); setEditQuestion(c.question); }}
                          className="w-7 h-7 rounded-lg bg-white/8 hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                          <Edit3 className="w-3.5 h-3.5 text-white/40"/>
                        </motion.button>
                        <motion.button whileTap={{ scale:0.85 }} onClick={()=>handleDelete(c.id)}
                          className="w-7 h-7 rounded-lg bg-white/8 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-white/40"/>
                        </motion.button>
                      </div>
                    )}
                    <motion.button whileTap={{ scale:0.85 }} onClick={()=>handleExpand(c.id)}>
                      {isOpen?<ChevronUp className="w-4 h-4 text-white/30"/>:<ChevronDown className="w-4 h-4 text-white/30"/>}
                    </motion.button>
                  </div>

                  {/* Inline edit */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                        exit={{ opacity:0, height:0 }} className="overflow-hidden">
                        <div className="p-3 bg-blue-500/8 border-x border-b border-blue-500/20 flex gap-2">
                          <input type="text" value={editQuestion} onChange={e=>setEditQuestion(e.target.value)}
                            onKeyDown={e=>{ if(e.key==="Enter")handleSaveEdit(c.id); if(e.key==="Escape")setEditingId(null); }}
                            autoFocus
                            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none"/>
                          <button onClick={()=>handleSaveEdit(c.id)} className="px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold text-xs">Save</button>
                          <button onClick={()=>setEditingId(null)} className="px-3 py-2 rounded-xl bg-white/8 text-white/40 font-bold text-xs">Cancel</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded body */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                        exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }} className="overflow-hidden">
                        <div className="p-4 border-x border-b border-violet-500/20 bg-violet-500/5 flex flex-col gap-3">
                          {!isAdmin && c.status==="open" && (
                            <PlayerChallengeCard challenge={c} myPair={latestPair}
                              hasSubmitted={submittedIds.has(c.id)} onSubmit={handleSubmitAnswer}
                              onNeedProfile={()=>router.push("/game/profile")}/>
                          )}
                          {!isAdmin && c.status!=="open" && (
                            <p className="text-white/30 text-xs font-mono text-center py-3">
                              {c.status==="judging"?"Host is scoring answers...":"This challenge is closed."}
                            </p>
                          )}
                          {isAdmin && (
                            <>
                              {cAnswers.length===0
                                ? <p className="text-white/20 text-xs font-mono text-center py-3">No answers yet.</p>
                                : cAnswers.map(a=>(
                                    <AnswerCard key={a.id} answer={a} maxXp={c.max_xp} onJudge={handleJudge}/>
                                  ))}
                              <div className="flex gap-2 pt-1">
                                {c.status==="open" && (
                                  <motion.button whileTap={{ scale:0.97 }}
                                    onClick={async()=>{ await updateChallengeStatus(c.id,"judging"); load(); }}
                                    className="flex-1 py-2 rounded-xl border border-yellow-500/25 bg-yellow-500/8 text-yellow-400 text-xs font-bold">
                                    Move to Judging
                                  </motion.button>
                                )}
                                {c.status!=="closed" && (
                                  <motion.button whileTap={{ scale:0.97 }}
                                    onClick={async()=>{ await updateChallengeStatus(c.id,"closed"); notify("Closed ✅"); load(); }}
                                    className="flex-1 py-2 rounded-xl border border-red-500/25 bg-red-500/8 text-red-400 text-xs font-bold">
                                    Close Challenge
                                  </motion.button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <AnimatePresence>
        {toast && <Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </AnimatePresence>
    </div>
  );
}