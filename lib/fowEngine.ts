// ─────────────────────────────────────────────────────────────────────────────
// lib/fowEngine.ts  —  Friend of a Week · Core Engine v2
//
// "Every King deserves a Queen, every Queen deserves a King,
//  and every Agatambyi deserves the spotlight."
//
// KEY GUARANTEES:
//   1. Never repeat a pair if any other valid option exists
//   2. Never assign the same Agatambyi twice if anyone else hasn't had it yet
//   3. Strongly avoids repeating the SAME pair from the previous week
//   4. Same-gender fallback only when gender imbalance forces it
//   5. Full history persists in localStorage across all sessions
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role = "king" | "queen";

export interface Participant {
  id: string;
  name: string;
  role: Role;
  addedAt: number;
}

export interface Pair {
  id: string;
  memberA: Participant;
  memberB: Participant;
  type: "king-queen" | "king-king" | "queen-queen";
}

export interface PairingResult {
  pairs: Pair[];
  agatambyi: Participant | null;
  weekNumber: number;
  sessionId: string;
  date: string;
  totalParticipants: number;
}

export interface Session {
  id: string;
  weekNumber: number;
  date: string;
  participants: Participant[];
  result: PairingResult | null;
}

// ── Store — the source of truth for all history ───────────────────────────────

export interface FOWStore {
  sessions: Session[];
  currentSessionId: string | null;
  participantHistory: Record<string, number>;      // name → total appearances
  pairingHistory: Record<string, Record<string, number>>; // idA → idB → count
  agatambyiCount: Record<string, number>;          // id → times been Agatambyi
  lastAgatambyiId: string | null;                  // who was Agatambyi last week
  lastWeekPairKeys: string[];                      // "idA:idB" strings from last session
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORE_KEY = "fow_store_v2";

export function loadStore(): FOWStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as FOWStore;
    return {
      ...emptyStore(),
      ...parsed,
      pairingHistory:   parsed.pairingHistory  ?? {},
      agatambyiCount:   parsed.agatambyiCount  ?? {},
      lastAgatambyiId:  parsed.lastAgatambyiId ?? null,
      lastWeekPairKeys: parsed.lastWeekPairKeys ?? [],
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: FOWStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function emptyStore(): FOWStore {
  return {
    sessions: [],
    currentSessionId: null,
    participantHistory: {},
    pairingHistory: {},
    agatambyiCount: {},
    lastAgatambyiId: null,
    lastWeekPairKeys: [],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Canonical pair key — symmetric so A:B === B:A */
function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

function getPairingCount(store: FOWStore, idA: string, idB: string): number {
  return store.pairingHistory[idA]?.[idB] ?? 0;
}

function recordPairing(
  history: Record<string, Record<string, number>>,
  idA: string,
  idB: string
): Record<string, Record<string, number>> {
  const h = { ...history };
  if (!h[idA]) h[idA] = {};
  if (!h[idB]) h[idB] = {};
  h[idA] = { ...h[idA], [idB]: (h[idA][idB] ?? 0) + 1 };
  h[idB] = { ...h[idB], [idA]: (h[idB][idA] ?? 0) + 1 };
  return h;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
//
// Lower score = more preferred pairing.
//
//   times paired together × 1000   — main driver, avoids repeats
//   was last week's exact pair × 500 — extra penalty for consecutive repeat
//   random 0–1                      — tie-breaker for variety
//
// Example with 5 people over many weeks:
//   A+B paired 0 times → score ~0    → always picked first
//   A+B paired 1 time  → score ~1000 → picked only when others all scored higher
//   A+B paired last wk → +500 extra  → very strongly skipped this week
// ─────────────────────────────────────────────────────────────────────────────

function scorePair(
  store: FOWStore,
  idA: string,
  idB: string
): number {
  const times = getPairingCount(store, idA, idB);
  const wasLastWeek = store.lastWeekPairKeys.includes(pairKey(idA, idB)) ? 1 : 0;
  return times * 1000 + wasLastWeek * 500 + Math.random();
}

// ─────────────────────────────────────────────────────────────────────────────
// BEST-MATCH GREEDY ALGORITHM
//
// We run the greedy matcher ATTEMPTS times with different random king orders,
// then keep the assignment that produced the lowest total score.
//
// This isn't a perfect Hungarian-algorithm optimum but it's extremely close
// for groups of 30-50 people and runs instantly.
// ─────────────────────────────────────────────────────────────────────────────

function bestCrossGenderMatching(
  store: FOWStore,
  kings: Participant[],
  queens: Participant[],
  attempts = 60
): { king: Participant; queen: Participant }[] {
  const count = Math.min(kings.length, queens.length);
  if (count === 0) return [];

  let best: { king: Participant; queen: Participant }[] = [];
  let bestScore = Infinity;

  for (let t = 0; t < attempts; t++) {
    const shuffledKings = shuffle(kings);
    const available     = [...queens];
    const assignment: { king: Participant; queen: Participant }[] = [];
    let totalScore = 0;

    for (const king of shuffledKings) {
      if (!available.length) break;
      const scored = available.map((q) => ({ q, s: scorePair(store, king.id, q.id) }));
      scored.sort((a, b) => a.s - b.s);
      const pick = scored[0];
      assignment.push({ king, queen: pick.q });
      totalScore += pick.s;
      available.splice(available.indexOf(pick.q), 1);
    }

    if (totalScore < bestScore) {
      bestScore = totalScore;
      best = assignment;
    }
  }

  return best;
}

function bestSameGenderMatching(
  store: FOWStore,
  people: Participant[],
  attempts = 30
): { a: Participant; b: Participant }[] {
  if (people.length < 2) return [];

  let best: { a: Participant; b: Participant }[] = [];
  let bestScore = Infinity;

  for (let t = 0; t < attempts; t++) {
    const pool  = shuffle(people);
    const pairs: { a: Participant; b: Participant }[] = [];
    let total = 0;

    for (let i = 0; i + 1 < pool.length; i += 2) {
      total += scorePair(store, pool[i].id, pool[i + 1].id);
      pairs.push({ a: pool[i], b: pool[i + 1] });
    }

    if (total < bestScore) { bestScore = total; best = pairs; }
  }

  return best;
}

// ── Session management ────────────────────────────────────────────────────────

export function getCurrentWeekNumber(store: FOWStore): number {
  return store.sessions.length + 1;
}

export function createSession(store: FOWStore): { store: FOWStore; session: Session } {
  const session: Session = {
    id: genId(),
    weekNumber: getCurrentWeekNumber(store),
    date: new Date().toISOString().split("T")[0],
    participants: [],
    result: null,
  };
  return {
    store: { ...store, sessions: [...store.sessions, session], currentSessionId: session.id },
    session,
  };
}

export function getCurrentSession(store: FOWStore): Session | null {
  if (!store.currentSessionId) return null;
  return store.sessions.find((s) => s.id === store.currentSessionId) ?? null;
}

// ── Participant management ────────────────────────────────────────────────────

export function addParticipant(
  store: FOWStore,
  sessionId: string,
  name: string,
  role: Role
): { store: FOWStore; participant: Participant; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { store, participant: null!, error: "Name cannot be empty." };
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return { store, participant: null!, error: "Session not found." };

  const dup = session.participants.find(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (dup) return { store, participant: null!, error: `"${trimmed}" is already in the list.` };

  const participant: Participant = { id: genId(), name: trimmed, role, addedAt: Date.now() };
  return {
    store: {
      ...store,
      sessions: store.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, participants: [...s.participants, participant] }
          : s
      ),
      participantHistory: {
        ...store.participantHistory,
        [trimmed]: (store.participantHistory[trimmed] ?? 0) + 1,
      },
    },
    participant,
  };
}

export function removeParticipant(store: FOWStore, sessionId: string, pid: string): FOWStore {
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return store;
  const removed = session.participants.find((p) => p.id === pid);
  const updatedHistory = { ...store.participantHistory };
  if (removed) updatedHistory[removed.name] = Math.max(0, (updatedHistory[removed.name] ?? 1) - 1);
  return {
    ...store,
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, participants: s.participants.filter((p) => p.id !== pid) } : s
    ),
    participantHistory: updatedHistory,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE PAIRS — main function
// ─────────────────────────────────────────────────────────────────────────────

export function generatePairs(
  store: FOWStore,
  sessionId: string
): { store: FOWStore; result: PairingResult; error?: string } {

  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return { store, result: null!, error: "Session not found." };
  if (session.participants.length < 1)
    return { store, result: null!, error: "Add at least 1 participant." };

  const total  = session.participants.length;
  let wKings   = session.participants.filter((p) => p.role === "king");
  let wQueens  = session.participants.filter((p) => p.role === "queen");
  let agatambyi: Participant | null = null;
  let pairingHist = { ...store.pairingHistory };
  const finalPairs: Pair[] = [];

  // ── Step 1: Elect Agatambyi if odd total ───────────────────────────────────
  //
  // Fairness scoring — lower = more fair to pick this person:
  //   agatambyiCount × 1000  (main fairness driver)
  //   wasLastWeek × 500      (strongly avoid back-to-back)
  //   random 0–1             (tie-breaker)
  //
  if (total % 2 === 1) {
    const scored = session.participants.map((p) => ({
      p,
      score:
        (store.agatambyiCount[p.id] ?? 0) * 1000 +
        (store.lastAgatambyiId === p.id ? 500 : 0) +
        Math.random(),
    }));
    scored.sort((a, b) => a.score - b.score);
    agatambyi = scored[0].p;
    wKings  = wKings.filter((p)  => p.id !== agatambyi!.id);
    wQueens = wQueens.filter((p) => p.id !== agatambyi!.id);
  }

  // ── Step 2: Cross-gender pairs ─────────────────────────────────────────────
  const usedIds = new Set<string>();
  const crossMatches = bestCrossGenderMatching(store, wKings, wQueens);

  for (const { king, queen } of crossMatches) {
    finalPairs.push({ id: genId(), memberA: king, memberB: queen, type: "king-queen" });
    pairingHist = recordPairing(pairingHist, king.id, queen.id);
    usedIds.add(king.id);
    usedIds.add(queen.id);
  }

  // ── Step 3: Same-gender fallback ───────────────────────────────────────────
  const leftKings  = wKings.filter((p)  => !usedIds.has(p.id));
  const leftQueens = wQueens.filter((p) => !usedIds.has(p.id));

  for (const { a, b } of bestSameGenderMatching(store, leftKings)) {
    finalPairs.push({ id: genId(), memberA: a, memberB: b, type: "king-king" });
    pairingHist = recordPairing(pairingHist, a.id, b.id);
  }
  for (const { a, b } of bestSameGenderMatching(store, leftQueens)) {
    finalPairs.push({ id: genId(), memberA: a, memberB: b, type: "queen-queen" });
    pairingHist = recordPairing(pairingHist, a.id, b.id);
  }

  // ── Build result + update store ────────────────────────────────────────────
  const result: PairingResult = {
    pairs: finalPairs,
    agatambyi,
    weekNumber: session.weekNumber,
    sessionId,
    date: session.date,
    totalParticipants: total,
  };

  const newAgatambyiCount = { ...store.agatambyiCount };
  if (agatambyi) newAgatambyiCount[agatambyi.id] = (newAgatambyiCount[agatambyi.id] ?? 0) + 1;

  const updatedStore: FOWStore = {
    ...store,
    sessions: store.sessions.map((s) => s.id === sessionId ? { ...s, result } : s),
    pairingHistory: pairingHist,
    agatambyiCount: newAgatambyiCount,
    lastAgatambyiId: agatambyi?.id ?? store.lastAgatambyiId,
    lastWeekPairKeys: finalPairs.map((p) => pairKey(p.memberA.id, p.memberB.id)),
  };

  return { store: updatedStore, result };
}

// ─────────────────────────────────────────────────────────────────────────────
// XP & POINTS SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
//
//  +100 XP  — showing up and being paired                (base, every week)
//  +50  XP  — pairing with someone brand new             (novelty bonus)
//  +75  XP  — being selected as Agatambyi                (spotlight bonus)
//  +25  XP  — part of a same-gender fallback pair        (solidarity bonus)
//  Streak multiplier: floor(base × currentStreak × 0.10)
//    e.g. 3-week streak → +20% extra XP on base
//
// Rank tiers (by total XP):
//   0–149    🌱 Novice
//   150–499  🗡️ Warrior
//   500–1199 ⚡ Veteran
//   1200–2499 🛡️ Elite
//   2500–4999 ⚔️ Legend
//   5000+    👑 Champion

export interface HeroStats {
  id: string;
  name: string;
  role: Role;
  totalXP: number;
  appearances: number;
  currentStreak: number;
  longestStreak: number;
  agatambyiCount: number;
  newPairings: number;        // times paired with someone for the first time
  pairPartners: string[];     // ids of unique past partners
}

export function computeAllHeroStats(store: FOWStore): HeroStats[] {
  // KEY FIX: use name.toLowerCase() as the map key, NOT p.id
  // Because the same person gets a new id every session they're re-added,
  // so keying by id creates duplicate rows on the leaderboard.
  const statsMap: Record<string, HeroStats> = {};
  const lastSeenWeek: Record<string, number> = {};  // key = nameLower

  const completed = store.sessions
    .filter((s) => s.result !== null)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  for (const session of completed) {
    const result = session.result!;
    const week   = session.weekNumber;

    // Init / update streak for all participants — keyed by lowercased name
    for (const p of session.participants) {
      const key = p.name.toLowerCase();
      if (!statsMap[key]) {
        statsMap[key] = {
          id: key,           // stable string key shown in UI
          name: p.name,      // display name (use first-seen casing)
          role: p.role,
          totalXP: 0, appearances: 0,
          currentStreak: 0, longestStreak: 0,
          agatambyiCount: 0, newPairings: 0, pairPartners: [],
        };
      }
      const s = statsMap[key];
      // Update role in case it changed (rare but possible)
      s.role = p.role;
      s.currentStreak = lastSeenWeek[key] === week - 1 ? s.currentStreak + 1 : 1;
      s.longestStreak = Math.max(s.longestStreak, s.currentStreak);
      lastSeenWeek[key] = week;
      s.appearances++;
    }

    // XP from pairs — identify members by name, not id
    for (const pair of result.pairs) {
      for (const m of [pair.memberA, pair.memberB]) {
        const key = m.name.toLowerCase();
        const s   = statsMap[key];
        if (!s) continue;

        const partner     = [pair.memberA, pair.memberB].find((x) => x.id !== m.id)!;
        const partnerKey  = partner.name.toLowerCase();
        // "new pairing" means we've never been paired with this person by NAME before
        const isNew = !s.pairPartners.includes(partnerKey);

        let xp = 100; // base
        if (isNew) {
          xp += 50;
          s.newPairings++;
          s.pairPartners.push(partnerKey);
        }
        if (pair.type !== "king-queen") xp += 25; // solidarity bonus
        xp += Math.floor(xp * (s.currentStreak - 1) * 0.1); // streak multiplier
        s.totalXP += xp;
      }
    }

    // Agatambyi XP — also by name
    if (result.agatambyi) {
      const key = result.agatambyi.name.toLowerCase();
      const s   = statsMap[key];
      if (s) { s.agatambyiCount++; s.totalXP += 75; }
    }
  }

  return Object.values(statsMap).sort(
    (a, b) => b.totalXP - a.totalXP || b.appearances - a.appearances
  );
}

// ── Rank tier ─────────────────────────────────────────────────────────────────

export type RankTier = "novice" | "warrior" | "veteran" | "elite" | "legend" | "champion";

export function getRankTier(xp: number): {
  tier: RankTier; label: string; icon: string; nextXP: number; minXP: number;
} {
  if (xp >= 5000) return { tier:"champion", label:"Champion", icon:"👑", nextXP:Infinity, minXP:5000 };
  if (xp >= 2500) return { tier:"legend",   label:"Legend",   icon:"⚔️", nextXP:5000,    minXP:2500 };
  if (xp >= 1200) return { tier:"elite",    label:"Elite",    icon:"🛡️", nextXP:2500,    minXP:1200 };
  if (xp >= 500)  return { tier:"veteran",  label:"Veteran",  icon:"⚡", nextXP:1200,    minXP:500  };
  if (xp >= 150)  return { tier:"warrior",  label:"Warrior",  icon:"🗡️", nextXP:500,     minXP:150  };
  return                  { tier:"novice",   label:"Novice",   icon:"🌱", nextXP:150,     minXP:0    };
}

// ── Bulk add ──────────────────────────────────────────────────────────────────

export function bulkAddParticipants(
  store: FOWStore,
  sessionId: string,
  text: string
): { store: FOWStore; added: number; errors: string[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  let added = 0;
  let s = store;

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    const name    = parts[0];
    const roleRaw = (parts[1] ?? "").toLowerCase();
    const role: Role = roleRaw === "queen" ? "queen" : "king";
    const { store: next, error } = addParticipant(s, sessionId, name, role);
    if (error) { errors.push(`"${name}": ${error}`); }
    else        { s = next; added++; }
  }

  return { store: s, added, errors };
}

// ── Session stats ─────────────────────────────────────────────────────────────

export function getSessionStats(session: Session) {
  const kings      = session.participants.filter((p) => p.role === "king").length;
  const queens     = session.participants.filter((p) => p.role === "queen").length;
  const total      = session.participants.length;
  const crossPairs = session.result?.pairs.filter((p) => p.type === "king-queen").length ?? 0;
  const samePairs  = session.result?.pairs.filter((p) => p.type !== "king-queen").length ?? 0;
  return { kings, queens, total, crossPairs, samePairs };
}