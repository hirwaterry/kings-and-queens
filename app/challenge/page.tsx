"use client";

// app/challenge/page.tsx
// Host creates a weekly challenge question for pairs to answer.
// Each pair submits one answer. Host scores 0-100. XP flows to player_profiles.

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Send, Star, Zap, Check, ChevronDown, ChevronUp, Crown, Users } from "lucide-react";
import {
  supabase, createChallenge, getAllChallenges, getChallengesForSession,
  getAnswersForChallenge, submitAnswer, judgeAnswer, updateChallengeStatus,
  getActiveSession, getPairs,
  type DBWeeklyChallenge, type DBChallengeAnswer, type DBPair, type DBSession,
} from "@/lib/supabase";

// ── Topic presets ──────────────────────────────────────────────────────────────
const TOPICS = ["Icebreaker", "Culture", "Fun", "Deep Talk", "Creative", "Challenge"];
const TOPIC_QUESTIONS: Record<string, string[]> = {
  "Icebreaker": [
    "What's one surprising thing you both have in common?",
    "If you were a dish, what would you both be and why?",
  ],
  "Culture": [
    "Share one cultural tradition from your family that you're proud of.",
    "What's a Rwandan proverb that resonates with both of you?",
  ],
  "Fun": [
    "If you had to swap lives for a day, what's the first thing you'd do?",
    "Plan your ideal day together in Kigali — go!",
  ],
  "Deep Talk": [
    "What's one goal you're both silently working toward right now?",
    "What do you wish more people understood about you?",
  ],
  "Creative": [
    "Write a 2-line poem about your week, together.",
    "If your friendship was a movie, what's the title and genre?",
  ],
  "Challenge": [
    "Teach each other something in 60 seconds. What did you learn?",
    "Do 10 push-ups together and screenshot the proof.",
  ],
};

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }: { msg:string; type:"ok"|"err"; onDone:()=>void }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return ()=>clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border text-sm
                  font-semibold backdrop-blur-sm flex items-center gap-2 shadow-2xl
                  ${type==="ok"?"bg-green-500/20 border-green-500/40 text-green-300":"bg-red-500/20 border-red-500/40 text-red-300"}`}>
      {type==="ok"?<Check className="w-4 h-4"/>:<Zap className="w-4 h-4"/>}{msg}
    </motion.div>
  );
};

// ── Score slider ───────────────────────────────────────────────────────────────
const ScoreSlider = ({ value, onChange }: { value:number; onChange:(v:number)=>void }) => (
  <div className="flex items-center gap-3">
    <input type="range" min={0} max={100} value={value} onChange={e=>onChange(Number(e.target.value))}
      className="flex-1 accent-yellow-400 h-1.5" />
    <div className="w-12 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
      <span className="text-yellow-300 font-black text-sm">{value}</span>
    </div>
  </div>
);

// ── Answer card (host judging view) ───────────────────────────────────────────
const AnswerCard = ({
  answer, maxXp, onJudge,
}: { answer:DBChallengeAnswer; maxXp:number; onJudge:(id:string,score:number)=>void }) => {
  const [score,    setScore   ] = useState(70);
  const [judging,  setJudging ] = useState(false);
  const [done,     setDone    ] = useState(!!answer.score);
  const xpPreview = Math.round((score / 100) * maxXp / 2);

  const handle = async () => {
    setJudging(true);
    await onJudge(answer.id, score);
    setDone(true);
    setJudging(false);
  };

  return (
    <motion.div layout initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      className={`p-4 rounded-2xl border transition-all
                  ${done ? "border-green-500/30 bg-green-500/8" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20">
          <span className="text-[10px] text-yellow-300 font-bold">{answer.player_a_name}</span>
          <span className="text-white/20 text-[10px]">×</span>
          <span className="text-[10px] text-rose-300 font-bold">{answer.player_b_name}</span>
        </div>
        {done && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-green-400 font-mono">
            <Check className="w-3 h-3" /> Scored {answer.score}/100 · +{answer.xp_awarded} XP
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
          <ScoreSlider value={score} onChange={setScore} />
          <motion.button whileTap={{ scale:0.97 }} onClick={handle} disabled={judging}
            className="w-full py-2.5 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900
                       rounded-xl font-black text-sm flex items-center justify-center gap-2">
            {judging ? "Awarding..." : <><Star className="w-4 h-4"/>Award XP</>}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

// ── Challenge card (player submit view) ───────────────────────────────────────
const PlayerChallengeCard = ({
  challenge, myPair, myName, onSubmit,
}: {
  challenge: DBWeeklyChallenge;
  myPair: DBPair | null;
  myName: string;
  onSubmit: (challengeId:string, answer:string) => void;
}) => {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handle = () => {
    if (!answer.trim() || !myPair) return;
    onSubmit(challenge.id, answer.trim());
    setSubmitted(true);
  };

  if (submitted) return (
    <motion.div initial={{ scale:0.95 }} animate={{ scale:1 }}
      className="p-5 rounded-2xl border border-green-500/30 bg-green-500/8 text-center">
      <div className="text-3xl mb-2">✅</div>
      <p className="text-green-300 font-bold text-sm">Answer submitted!</p>
      <p className="text-white/30 text-xs mt-1">Waiting for host to score...</p>
    </motion.div>
  );

  return (
    <div className="p-5 rounded-2xl border border-violet-500/30 bg-violet-500/8 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-violet-400/60 font-mono uppercase tracking-widest">{challenge.topic ?? "Challenge"}</span>
        <span className="ml-auto text-[10px] text-white/25 font-mono">+{challenge.max_xp} XP pool</span>
      </div>
      <p className="text-white font-semibold text-sm leading-relaxed">{challenge.question}</p>

      {myPair ? (
        <>
          <div className="flex items-center gap-2 text-[11px] text-white/30 font-mono">
            <span>Answering as</span>
            <span className="text-yellow-300">{myPair.member_a_name}</span>
            <span>&</span>
            <span className="text-rose-300">{myPair.member_b_name}</span>
          </div>
          <textarea value={answer} onChange={e=>setAnswer(e.target.value)} rows={3}
            placeholder="Write your answer together..."
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white
                       text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50
                       transition-all resize-none" />
          <motion.button whileTap={{ scale:0.97 }} onClick={handle} disabled={!answer.trim()}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl
                       font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            <Send className="w-4 h-4" />Submit Answer
          </motion.button>
        </>
      ) : (
        <p className="text-white/30 text-xs font-mono">Join a session first to submit an answer.</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const [isAdmin,     setIsAdmin    ] = useState(false);
  const [challenges,  setChallenges ] = useState<DBWeeklyChallenge[]>([]);
  const [expanded,    setExpanded   ] = useState<string | null>(null);
  const [answers,     setAnswers    ] = useState<Record<string, DBChallengeAnswer[]>>({});
  const [activeSession, setActiveSession] = useState<DBSession | null>(null);
  const [myPairs,     setMyPairs    ] = useState<DBPair[]>([]);
  const [myName,      setMyName     ] = useState("");
  const [toast,       setToast      ] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const [loading,     setLoading    ] = useState(true);

  // Create form
  const [question,  setQuestion ] = useState("");
  const [topic,     setTopic    ] = useState("Icebreaker");
  const [maxXp,     setMaxXp    ] = useState(200);
  const [creating,  setCreating ] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const notify = (msg:string, type:"ok"|"err"="ok") => setToast({msg,type});

  const load = useCallback(async () => {
    setLoading(true);
    const name = localStorage.getItem("fow_my_name") ?? "";
    const admin = localStorage.getItem("fow_is_admin") === "true";
    setMyName(name);
    setIsAdmin(admin);

    const [allC, sess] = await Promise.all([getAllChallenges(), getActiveSession()]);
    setChallenges(allC);
    setActiveSession(sess);

    // Load my pairs from all sessions
    if (name) {
      const allSessions = await supabase.from("sessions").select("id").eq("status","revealed");
      const pairPromises = (allSessions.data ?? []).map(s => getPairs(s.id));
      const allPairs = (await Promise.all(pairPromises)).flat();
      const mine = allPairs.filter(p =>
        p.member_a_name.toLowerCase() === name.toLowerCase() ||
        p.member_b_name.toLowerCase() === name.toLowerCase()
      );
      setMyPairs(mine);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: new challenge answers
  useEffect(() => {
    const channel = supabase.channel("challenge-answers-live")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"challenge_answers" }, () => {
        load();
      })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"challenge_answers" }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const loadAnswers = async (challengeId: string) => {
    const ans = await getAnswersForChallenge(challengeId);
    setAnswers(prev => ({ ...prev, [challengeId]: ans }));
  };

  const handleExpand = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadAnswers(id);
  };

  const handleCreate = async () => {
    if (!question.trim()) { notify("Enter a question first", "err"); return; }
    if (!activeSession)   { notify("No active session. Create one from Live Pair first.", "err"); return; }
    setCreating(true);
    try {
      const c = await createChallenge(activeSession.id, activeSession.week_number, question.trim(), topic, maxXp);
      setChallenges(prev => [c, ...prev]);
      setQuestion("");
      notify(`Challenge posted for Week ${activeSession.week_number}! 🎯`);
    } catch (e: any) { notify(e.message, "err"); }
    setCreating(false);
  };

  const handleSubmitAnswer = async (challengeId: string, answer: string) => {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    // Find the pair this player is in for this session
    const myPair = myPairs.find(p => p.session_id === challenge.session_id);
    if (!myPair) { notify("You're not in a pair for this session", "err"); return; }

    try {
      await submitAnswer(challengeId, challenge.session_id, myPair.id,
        myPair.member_a_name, myPair.member_b_name, answer);
      notify("Answer submitted! Waiting for host to score 🎯");
    } catch (e: any) { notify(e.message, "err"); }
  };

  const handleJudge = async (answerId: string, score: number) => {
    const challengeId = Object.keys(answers).find(cid =>
      answers[cid].some(a => a.id === answerId)
    )!;
    const challenge = challenges.find(c => c.id === challengeId)!;
    const answer = answers[challengeId].find(a => a.id === answerId)!;
    await judgeAnswer(answerId, score, challenge.max_xp, answer.player_a_name, answer.player_b_name);
    notify(`Scored! +${Math.round((score/100)*challenge.max_xp)} XP awarded 🏆`);
    loadAnswers(challengeId);
  };

  const latestPair = myPairs[myPairs.length - 1] ?? null;

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 pt-8 pb-16 max-w-lg">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-violet-400" />
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Weekly Challenge</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-white">Earn </span>
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              Bonus XP
            </span>
          </h1>
          <p className="text-white/30 text-sm mt-1">
            {isAdmin ? "Post a question. Score pair answers. XP updates instantly." : "Answer with your pair. Earn XP. Climb the board."}
          </p>
        </motion.div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-white/5 border border-white/8 rounded-2xl">
          {[{id:false,label:"Player View",icon:"⚔️"},{id:true,label:"Host View",icon:"👑"}].map(m=>(
            <motion.button key={String(m.id)} whileTap={{ scale:0.97 }}
              onClick={() => { setIsAdmin(m.id); localStorage.setItem("fow_is_admin", String(m.id)); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all
                          ${isAdmin===m.id?"bg-white/15 text-white border border-white/20":"text-white/40 hover:text-white/60"}`}>
              <span>{m.icon}</span><span>{m.label}</span>
            </motion.button>
          ))}
        </div>

        {/* ── HOST: Create challenge ── */}
        {isAdmin && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">
            <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-4">
              ✦ Post This Week's Challenge
            </p>

            {/* Topic pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {TOPICS.map(t => (
                <motion.button key={t} whileTap={{ scale:0.95 }} onClick={() => setTopic(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                              ${topic===t
                                ? "bg-violet-500/25 border border-violet-500/50 text-violet-300"
                                : "bg-white/5 border border-white/10 text-white/40 hover:text-white/60"}`}>
                  {t}
                </motion.button>
              ))}
            </div>

            {/* Question input */}
            <div className="relative mb-3">
              <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={2}
                placeholder="Type your challenge question..."
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white
                           placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50
                           transition-all resize-none" />
              <button onClick={() => setShowSuggestions(!showSuggestions)}
                className="absolute bottom-3 right-3 text-[10px] text-violet-400/60 hover:text-violet-400 font-mono">
                suggestions {showSuggestions ? "▲" : "▼"}
              </button>
            </div>

            {/* Suggestions */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                  exit={{ opacity:0, height:0 }} className="overflow-hidden mb-3">
                  <div className="flex flex-col gap-1.5 p-3 bg-white/5 rounded-xl border border-white/8">
                    {(TOPIC_QUESTIONS[topic] ?? []).map((q,i) => (
                      <button key={i} onClick={() => { setQuestion(q); setShowSuggestions(false); }}
                        className="text-left text-xs text-white/50 hover:text-white/90 py-1.5 px-2
                                   rounded-lg hover:bg-white/8 transition-all leading-relaxed">
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Max XP */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[11px] text-white/30 font-mono shrink-0">XP Pool:</span>
              <input type="range" min={50} max={500} step={50} value={maxXp}
                onChange={e=>setMaxXp(Number(e.target.value))}
                className="flex-1 accent-yellow-400 h-1.5" />
              <div className="w-16 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/30
                              flex items-center justify-center">
                <span className="text-yellow-300 font-black text-xs">{maxXp} XP</span>
              </div>
            </div>

            <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
              onClick={handleCreate} disabled={creating || !question.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl
                         font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40
                         shadow-lg shadow-violet-500/20">
              {creating ? "Posting..." : <><Plus className="w-4 h-4"/>Post Challenge</>}
            </motion.button>
          </motion.div>
        )}

        {/* ── Challenges list ── */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-12 text-white/25 font-mono text-sm">Loading challenges...</div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-white/30 text-sm font-mono">No challenges yet.</p>
              {isAdmin && <p className="text-white/20 text-xs font-mono mt-1">Post one above to get started.</p>}
            </div>
          ) : challenges.map((c, i) => {
            const isOpen = expanded === c.id;
            const cAnswers = answers[c.id] ?? [];
            const judged = cAnswers.filter(a => a.score !== null).length;

            return (
              <motion.div key={c.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                transition={{ delay: i * 0.05 }} layout className="rounded-2xl overflow-hidden">
                {/* Header row */}
                <motion.div whileHover={{ x:2 }} onClick={() => handleExpand(c.id)}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-all border
                              ${isOpen
                                ? "bg-violet-500/15 border-violet-500/30"
                                : "bg-white/5 border-white/8 hover:bg-white/8"}`}>
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/25
                                  flex items-center justify-center text-lg shrink-0">🎯</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{c.question}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-white/30 font-mono">Week {c.week_number}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full
                                        ${c.status==="open"?"bg-green-500/15 text-green-400 border border-green-500/20"
                                          :c.status==="judging"?"bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
                                          :"bg-white/5 text-white/30 border border-white/10"}`}>
                        {c.status}
                      </span>
                      <span className="text-[10px] text-violet-400/70 font-mono">{c.max_xp} XP</span>
                      {cAnswers.length > 0 && (
                        <span className="text-[10px] text-white/25 font-mono">{judged}/{cAnswers.length} judged</span>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
                           : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
                </motion.div>

                {/* Expanded content */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                      exit={{ opacity:0, height:0 }} transition={{ duration:0.22 }} className="overflow-hidden">
                      <div className="p-4 border-x border-b border-violet-500/20 bg-violet-500/5
                                      flex flex-col gap-3">
                        {/* Player: submit answer */}
                        {!isAdmin && c.status === "open" && (
                          <PlayerChallengeCard challenge={c} myPair={latestPair}
                            myName={myName} onSubmit={handleSubmitAnswer} />
                        )}

                        {/* Host: judge answers */}
                        {isAdmin && (
                          <>
                            {cAnswers.length === 0 ? (
                              <p className="text-white/25 text-xs font-mono text-center py-4">
                                No answers submitted yet.
                              </p>
                            ) : cAnswers.map(a => (
                              <AnswerCard key={a.id} answer={a} maxXp={c.max_xp}
                                onJudge={(id, score) => handleJudge(id, score)} />
                            ))}

                            {/* Close challenge */}
                            {c.status !== "closed" && (
                              <motion.button whileTap={{ scale:0.97 }}
                                onClick={async () => {
                                  await updateChallengeStatus(c.id, "closed");
                                  notify("Challenge closed. XP awarded! 🏆");
                                  load();
                                }}
                                className="w-full py-2.5 rounded-xl border border-white/15 text-white/40
                                           hover:border-red-500/30 hover:text-red-400 text-xs font-semibold
                                           transition-all flex items-center justify-center gap-2">
                                Close Challenge
                              </motion.button>
                            )}
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
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast key={toast.msg} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}