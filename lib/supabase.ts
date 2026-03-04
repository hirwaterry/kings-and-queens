// lib/supabase.ts  —  FOW Database Layer v2
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role         = "king" | "queen";
export type PairType     = "king-queen" | "king-king" | "queen-queen";
export type SessionStatus = "lobby" | "revealing" | "revealed";
export type ChallengeStatus = "open" | "judging" | "closed";

export interface DBSession {
  id: string; week_number: number; date: string;
  status: SessionStatus; created_at: string;
}
export interface DBParticipant {
  id: string; session_id: string; name: string;
  role: Role; joined_at: string;
}
export interface DBPair {
  id: string; session_id: string;
  member_a_name: string; member_a_role: string;
  member_b_name: string; member_b_role: string;
  pair_type: PairType; created_at: string;
}
export interface DBAgatambyi {
  id: string; session_id: string; name: string; role: string; created_at: string;
}
export interface DBPlayerProfile {
  name: string;           // PK — lowercased
  display_name: string;
  role: Role;
  total_xp: number;
  challenge_xp: number;
  appearances: number;
  current_streak: number;
  longest_streak: number;
  agatambyi_count: number;
  new_pairings: number;
  last_seen_week: number;
  pair_partners: string[];
  created_at: string;
  updated_at: string;
}
export interface DBWeeklyChallenge {
  id: string; session_id: string; week_number: number;
  question: string; topic: string | null; max_xp: number;
  status: ChallengeStatus; created_at: string;
}
export interface DBChallengeAnswer {
  id: string; challenge_id: string; session_id: string;
  pair_id: string; player_a_name: string; player_b_name: string;
  answer: string; score: number | null; xp_awarded: number | null;
  judged_at: string | null; created_at: string;
}
export interface DBReaction {
  id: string; session_id: string; emoji: string;
  player_name: string | null; created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function canonical(a: string, b: string): [string, string] {
  const x = a.toLowerCase(), y = b.toLowerCase();
  return x < y ? [x, y] : [y, x];
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────────────────────

export async function getNextWeekNumber(): Promise<number> {
  const { count } = await supabase.from("sessions").select("*", { count:"exact", head:true });
  return (count ?? 0) + 1;
}

export async function createSession(): Promise<DBSession> {
  const week = await getNextWeekNumber();
  const row = { id: genId(), week_number: week, date: new Date().toISOString().split("T")[0], status: "lobby" as SessionStatus };
  const { data, error } = await supabase.from("sessions").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSession(id: string): Promise<DBSession | null> {
  const { data } = await supabase.from("sessions").select("*").eq("id", id).single();
  return data ?? null;
}

export async function updateSessionStatus(id: string, status: SessionStatus): Promise<void> {
  await supabase.from("sessions").update({ status }).eq("id", id);
}

export async function getActiveSession(): Promise<DBSession | null> {
  const { data } = await supabase.from("sessions").select("*").eq("status","lobby")
    .order("created_at", { ascending: false }).limit(1).single();
  return data ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICIPANTS
// ─────────────────────────────────────────────────────────────────────────────

export async function addParticipant(sessionId: string, name: string, role: Role)
  : Promise<{ participant: DBParticipant | null; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { participant: null, error: "Name cannot be empty." };

  const { data: existing } = await supabase.from("participants")
    .select("id").eq("session_id", sessionId).ilike("name", trimmed).maybeSingle();
  if (existing) return { participant: null, error: `"${trimmed}" is already in this session.` };

  const row = { id: genId(), session_id: sessionId, name: trimmed, role };
  const { data, error } = await supabase.from("participants").insert(row).select().single();
  if (error) return { participant: null, error: error.message };
  return { participant: data };
}

export async function bulkAddParticipants(sessionId: string, text: string)
  : Promise<{ added: number; errors: string[] }> {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let added = 0; const errors: string[] = [];
  for (const line of lines) {
    const parts = line.split(",").map(p => p.trim());
    const name = parts[0];
    const role: Role = (parts[1] ?? "").toLowerCase() === "queen" ? "queen" : "king";
    const { error } = await addParticipant(sessionId, name, role);
    if (error) errors.push(`"${name}": ${error}`); else added++;
  }
  return { added, errors };
}

export async function removeParticipant(id: string): Promise<void> {
  await supabase.from("participants").delete().eq("id", id);
}

export async function getParticipants(sessionId: string): Promise<DBParticipant[]> {
  const { data } = await supabase.from("participants").select("*")
    .eq("session_id", sessionId).order("joined_at", { ascending: true });
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// PAIRING ALGORITHM (history-aware, name-keyed)
// ─────────────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scorePair(
  histMap: Map<string, number>,
  lastMap: Map<string, string | null>,
  lastSid: string,
  nameA: string, nameB: string
): number {
  const [a, b] = canonical(nameA, nameB);
  const key = `${a}:${b}`;
  return (histMap.get(key) ?? 0) * 1000
    + (lastMap.get(key) === lastSid ? 500 : 0)
    + Math.random();
}

function bestCross(
  people: DBParticipant[],
  histMap: Map<string, number>,
  lastMap: Map<string, string | null>,
  lastSid: string, attempts = 60
): { a: DBParticipant; b: DBParticipant }[] {
  const kings  = people.filter(p => p.role === "king");
  const queens = people.filter(p => p.role === "queen");
  if (!kings.length || !queens.length) return [];
  let best: { a: DBParticipant; b: DBParticipant }[] = [];
  let bestScore = Infinity;
  for (let t = 0; t < attempts; t++) {
    const sKings = shuffle(kings); const avail = [...queens];
    const pairs: { a: DBParticipant; b: DBParticipant }[] = [];
    let total = 0;
    for (const k of sKings) {
      if (!avail.length) break;
      const scored = avail.map(q => ({ q, s: scorePair(histMap, lastMap, lastSid, k.name, q.name) }));
      scored.sort((a, b) => a.s - b.s);
      pairs.push({ a: k, b: scored[0].q });
      total += scored[0].s;
      avail.splice(avail.indexOf(scored[0].q), 1);
    }
    if (total < bestScore) { bestScore = total; best = pairs; }
  }
  return best;
}

function bestSame(
  people: DBParticipant[],
  histMap: Map<string, number>,
  lastMap: Map<string, string | null>,
  lastSid: string, attempts = 30
): { a: DBParticipant; b: DBParticipant }[] {
  if (people.length < 2) return [];
  let best: { a: DBParticipant; b: DBParticipant }[] = [];
  let bestScore = Infinity;
  for (let t = 0; t < attempts; t++) {
    const pool = shuffle(people);
    const pairs: { a: DBParticipant; b: DBParticipant }[] = [];
    let total = 0;
    for (let i = 0; i + 1 < pool.length; i += 2) {
      total += scorePair(histMap, lastMap, lastSid, pool[i].name, pool[i+1].name);
      pairs.push({ a: pool[i], b: pool[i+1] });
    }
    if (total < bestScore) { bestScore = total; best = pairs; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// XP CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const XP_BASE        = 100;  // showing up
const XP_NEW_PAIR    = 50;   // new partner (first time)
const XP_AGATAMBYI  = 75;   // being Agatambyi
const XP_SAME_GENDER = 25;   // same-gender fallback pair
const XP_STREAK_PCT  = 0.10; // +10% per streak week above 1

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE PAIRS + UPDATE PROFILES
// ─────────────────────────────────────────────────────────────────────────────

export async function generateAndSavePairs(sessionId: string): Promise<{
  pairs: DBPair[]; agatambyi: DBAgatambyi | null; error?: string;
}> {
  const participants = await getParticipants(sessionId);
  if (!participants.length) return { pairs: [], agatambyi: null, error: "No participants." };

  // Load pairing history
  const { data: histRows } = await supabase.from("pairing_history").select("*");
  const histMap = new Map<string, number>();
  const lastMap = new Map<string, string | null>();
  for (const r of histRows ?? []) {
    const key = `${r.name_a}:${r.name_b}`;
    histMap.set(key, r.times_paired);
    lastMap.set(key, r.last_paired);
  }

  // Load agatambyi history
  const { data: agRows } = await supabase.from("agatambyi_history").select("*");
  const agMap = new Map<string, { times_as_agatambyi: number; last_session_id: string | null }>();
  for (const r of agRows ?? []) agMap.set(r.name.toLowerCase(), r);

  // Get last session id
  const { data: prev } = await supabase.from("sessions").select("id")
    .neq("id", sessionId).order("created_at", { ascending: false }).limit(1);
  const lastSid = prev?.[0]?.id ?? "";

  // Load player profiles (for streak calculation)
  const { data: profileRows } = await supabase.from("player_profiles").select("*");
  const profileMap = new Map<string, DBPlayerProfile>();
  for (const p of profileRows ?? []) profileMap.set(p.name, p);

  // Get current week number
  const { data: sess } = await supabase.from("sessions").select("week_number").eq("id", sessionId).single();
  const weekNum = sess?.week_number ?? 1;

  // ── Pick Agatambyi ──────────────────────────────────────────────────────────
  let working = [...participants];
  let agPart: DBParticipant | null = null;
  if (participants.length % 2 === 1) {
    const scored = participants.map(p => ({
      p,
      score: (agMap.get(p.name.toLowerCase())?.times_as_agatambyi ?? 0) * 1000
           + (agMap.get(p.name.toLowerCase())?.last_session_id === lastSid ? 500 : 0)
           + Math.random(),
    }));
    scored.sort((a, b) => a.score - b.score);
    agPart = scored[0].p;
    working = working.filter(p => p.id !== agPart!.id);
  }

  // ── Cross-gender pairs ──────────────────────────────────────────────────────
  const usedIds = new Set<string>();
  const pairRows: Omit<DBPair, "created_at">[] = [];
  for (const { a, b } of bestCross(working, histMap, lastMap, lastSid)) {
    pairRows.push({ id: genId(), session_id: sessionId,
      member_a_name: a.name, member_a_role: a.role,
      member_b_name: b.name, member_b_role: b.role, pair_type: "king-queen" });
    usedIds.add(a.id); usedIds.add(b.id);
  }

  // ── Same-gender fallback ────────────────────────────────────────────────────
  const leftK = working.filter(p => p.role === "king"  && !usedIds.has(p.id));
  const leftQ = working.filter(p => p.role === "queen" && !usedIds.has(p.id));
  for (const { a, b } of bestSame(leftK, histMap, lastMap, lastSid))
    pairRows.push({ id: genId(), session_id: sessionId,
      member_a_name: a.name, member_a_role: a.role,
      member_b_name: b.name, member_b_role: b.role, pair_type: "king-king" });
  for (const { a, b } of bestSame(leftQ, histMap, lastMap, lastSid))
    pairRows.push({ id: genId(), session_id: sessionId,
      member_a_name: a.name, member_a_role: a.role,
      member_b_name: b.name, member_b_role: b.role, pair_type: "queen-queen" });

  // ── Save pairs ──────────────────────────────────────────────────────────────
  const { data: savedPairs, error: pErr } = await supabase.from("pairs").insert(pairRows).select();
  if (pErr) return { pairs: [], agatambyi: null, error: pErr.message };

  // ── Save agatambyi ──────────────────────────────────────────────────────────
  let savedAg: DBAgatambyi | null = null;
  if (agPart) {
    const { data } = await supabase.from("agatambyi")
      .insert({ id: genId(), session_id: sessionId, name: agPart.name, role: agPart.role })
      .select().single();
    savedAg = data;
  }

  // ── Update pairing history ──────────────────────────────────────────────────
  for (const pair of pairRows) {
    const [a, b] = canonical(pair.member_a_name, pair.member_b_name);
    const ex = histRows?.find(r => r.name_a === a && r.name_b === b);
    if (ex) await supabase.from("pairing_history")
      .update({ times_paired: ex.times_paired + 1, last_paired: sessionId }).eq("name_a", a).eq("name_b", b);
    else await supabase.from("pairing_history")
      .insert({ name_a: a, name_b: b, times_paired: 1, last_paired: sessionId });
  }

  // ── Update agatambyi history ────────────────────────────────────────────────
  if (agPart) {
    const key = agPart.name.toLowerCase();
    const ex = agMap.get(key);
    if (ex) await supabase.from("agatambyi_history")
      .update({ times_as_agatambyi: ex.times_as_agatambyi + 1, last_session_id: sessionId }).eq("name", key);
    else await supabase.from("agatambyi_history")
      .insert({ name: key, times_as_agatambyi: 1, last_session_id: sessionId });
  }

  // ── Update player_profiles (XP + streak) ───────────────────────────────────
  for (const participant of participants) {
    const key = participant.name.toLowerCase();
    const existing = profileMap.get(key);

    // Streak: consecutive weeks
    const prevStreak = existing?.current_streak ?? 0;
    const lastSeenWeek = existing?.last_seen_week ?? 0;
    const newStreak = lastSeenWeek === weekNum - 1 ? prevStreak + 1 : 1;
    const longestStreak = Math.max(existing?.longest_streak ?? 0, newStreak);

    // Find this participant's pair
    const myPair = pairRows.find(p =>
      p.member_a_name.toLowerCase() === key || p.member_b_name.toLowerCase() === key
    );
    const isAgatambyi = agPart?.name.toLowerCase() === key;
    const partnerName = myPair
      ? (myPair.member_a_name.toLowerCase() === key
          ? myPair.member_b_name.toLowerCase()
          : myPair.member_a_name.toLowerCase())
      : null;

    const partners = existing?.pair_partners ?? [];
    const isNewPair = partnerName ? !partners.includes(partnerName) : false;
    const newPartners = partnerName && isNewPair ? [...partners, partnerName] : partners;

    // XP calculation
    let xp = XP_BASE;
    if (isNewPair) xp += XP_NEW_PAIR;
    if (isAgatambyi) xp += XP_AGATAMBYI;
    if (myPair && myPair.pair_type !== "king-queen") xp += XP_SAME_GENDER;
    xp += Math.floor(xp * (newStreak - 1) * XP_STREAK_PCT);

    const newProfile: Omit<DBPlayerProfile, "created_at" | "updated_at"> = {
      name: key,
      display_name: participant.name,
      role: participant.role,
      total_xp: (existing?.total_xp ?? 0) + xp,
      challenge_xp: existing?.challenge_xp ?? 0,
      appearances: (existing?.appearances ?? 0) + 1,
      current_streak: newStreak,
      longest_streak: longestStreak,
      agatambyi_count: (existing?.agatambyi_count ?? 0) + (isAgatambyi ? 1 : 0),
      new_pairings: (existing?.new_pairings ?? 0) + (isNewPair ? 1 : 0),
      last_seen_week: weekNum,
      pair_partners: newPartners,
    };

    if (existing) {
      await supabase.from("player_profiles")
        .update({ ...newProfile, updated_at: new Date().toISOString() }).eq("name", key);
    } else {
      await supabase.from("player_profiles").insert(newProfile);
    }
  }

  return { pairs: savedPairs ?? [], agatambyi: savedAg };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getPairs(sessionId: string): Promise<DBPair[]> {
  const { data } = await supabase.from("pairs").select("*")
    .eq("session_id", sessionId).order("created_at", { ascending: true });
  return data ?? [];
}

export async function getAgatambyi(sessionId: string): Promise<DBAgatambyi | null> {
  const { data } = await supabase.from("agatambyi").select("*")
    .eq("session_id", sessionId).maybeSingle();
  return data ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD — reads directly from player_profiles
// ─────────────────────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<DBPlayerProfile[]> {
  const { data } = await supabase.from("player_profiles").select("*")
    .order("total_xp", { ascending: false });
  return data ?? [];
}

export async function getPlayerProfile(name: string): Promise<DBPlayerProfile | null> {
  const { data } = await supabase.from("player_profiles").select("*")
    .eq("name", name.toLowerCase()).maybeSingle();
  return data ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

export async function createChallenge(
  sessionId: string, weekNumber: number, question: string, topic: string, maxXp: number
): Promise<DBWeeklyChallenge> {
  const row = { id: genId(), session_id: sessionId, week_number: weekNumber,
    question, topic, max_xp: maxXp, status: "open" as ChallengeStatus };
  const { data, error } = await supabase.from("weekly_challenges").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getChallengesForSession(sessionId: string): Promise<DBWeeklyChallenge[]> {
  const { data } = await supabase.from("weekly_challenges").select("*").eq("session_id", sessionId);
  return data ?? [];
}

export async function getAllChallenges(): Promise<DBWeeklyChallenge[]> {
  const { data } = await supabase.from("weekly_challenges").select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function updateChallengeStatus(id: string, status: ChallengeStatus): Promise<void> {
  await supabase.from("weekly_challenges").update({ status }).eq("id", id);
}

export async function submitAnswer(
  challengeId: string, sessionId: string, pairId: string,
  playerAName: string, playerBName: string, answer: string
): Promise<DBChallengeAnswer> {
  const row = { id: genId(), challenge_id: challengeId, session_id: sessionId,
    pair_id: pairId, player_a_name: playerAName, player_b_name: playerBName, answer };
  const { data, error } = await supabase.from("challenge_answers").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAnswersForChallenge(challengeId: string): Promise<DBChallengeAnswer[]> {
  const { data } = await supabase.from("challenge_answers").select("*")
    .eq("challenge_id", challengeId).order("created_at", { ascending: true });
  return data ?? [];
}

/** Host scores an answer: 0-100. XP is awarded proportionally to max_xp. */
export async function judgeAnswer(
  answerId: string, score: number, maxXp: number,
  playerAName: string, playerBName: string
): Promise<void> {
  const xpAwarded = Math.round((score / 100) * maxXp);
  await supabase.from("challenge_answers").update({
    score, xp_awarded: xpAwarded, judged_at: new Date().toISOString()
  }).eq("id", answerId);

  // Award XP to both players
  const xpEach = Math.round(xpAwarded / 2);
  for (const name of [playerAName, playerBName]) {
    const key = name.toLowerCase();
    const { data: profile } = await supabase.from("player_profiles")
      .select("total_xp, challenge_xp").eq("name", key).maybeSingle();
    if (profile) {
      await supabase.from("player_profiles").update({
        total_xp: profile.total_xp + xpEach,
        challenge_xp: profile.challenge_xp + xpEach,
        updated_at: new Date().toISOString(),
      }).eq("name", key);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function addReaction(sessionId: string, emoji: string, playerName?: string): Promise<void> {
  await supabase.from("reactions").insert({ id: genId(), session_id: sessionId, emoji, player_name: playerName ?? null });
}

// ─────────────────────────────────────────────────────────────────────────────
// RANK TIERS
// ─────────────────────────────────────────────────────────────────────────────

export type RankTier = "novice" | "warrior" | "veteran" | "elite" | "legend" | "champion";

export function getRankTier(xp: number): {
  tier: RankTier; label: string; icon: string; nextXP: number; minXP: number;
} {
  if (xp >= 5000) return { tier:"champion", label:"Champion", icon:"👑", nextXP:Infinity, minXP:5000 };
  if (xp >= 2500) return { tier:"legend",   label:"Legend",   icon:"⚔️", nextXP:5000,    minXP:2500 };
  if (xp >= 1200) return { tier:"elite",    label:"Elite",    icon:"🛡️", nextXP:2500,    minXP:1200 };
  if (xp >= 500)  return { tier:"veteran",  label:"Veteran",  icon:"⚡", nextXP:1200,    minXP:500  };
  if (xp >= 150)  return { tier:"warrior",  label:"Warrior",  icon:"🗡️", nextXP:500,     minXP:150  };
  return               { tier:"novice",   label:"Novice",   icon:"🌱", nextXP:150,     minXP:0    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL SESSIONS (for All Pairs page)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllSessions(): Promise<DBSession[]> {
  const { data } = await supabase.from("sessions").select("*")
    .eq("status", "revealed").order("week_number", { ascending: false });
  return data ?? [];
}

export async function getAllPairsForSession(sessionId: string): Promise<DBPair[]> {
  return getPairs(sessionId);
}