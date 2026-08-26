import { useCallback, useEffect, useState } from "react";

export type Entry = {
  id: string;
  amount: number;
  label: string;
  date: string; // YYYY-MM-DD
};

export type Goal = {
  title: string;
  target: number;
  currency: string;
  startDate: string;
  deadline: string | null; // null = open ended
  createdAt: number;
};

export type HustleState = {
  goal: Goal | null;
  entries: Entry[];
};

const KEY = "hustle-quest-v1";
const empty: HustleState = { goal: null, entries: [] };

function read(): HustleState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as HustleState;
    return { goal: parsed.goal ?? null, entries: parsed.entries ?? [] };
  } catch {
    return empty;
  }
}

export function useHustle() {
  const [state, setState] = useState<HustleState>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(read());
    setLoaded(true);
  }, []);

  const persist = useCallback((next: HustleState) => {
    setState(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  return { state, loaded, persist };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function daysBetween(a: string, b: string) {
  const ms = new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime();
  return Math.round(ms / 86400000);
}

export function formatMoney(value: number, currency: string) {
  const rounded = Math.round(value * 100) / 100;
  return `${currency}${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Consecutive days (ending today or yesterday) with at least one entry. */
export function computeStreak(entries: Entry[]) {
  const days = new Set(entries.map((e) => e.date));
  if (days.size === 0) return 0;
  const start = new Date(todayISO() + "T00:00:00");
  if (!days.has(todayISO())) start.setDate(start.getDate() - 1);
  let streak = 0;
  for (;;) {
    const iso = start.toISOString().slice(0, 10);
    if (!days.has(iso)) break;
    streak += 1;
    start.setDate(start.getDate() - 1);
  }
  return streak;
}

export const LEVELS = [
  "Side Hustler",
  "Grinder",
  "Closer",
  "Operator",
  "Rainmaker",
  "Mogul",
] as const;

export function levelFor(xp: number) {
  const index = Math.min(LEVELS.length - 1, Math.floor(xp / 100));
  return {
    index,
    name: LEVELS[index],
    into: xp - index * 100,
    next: index === LEVELS.length - 1 ? 100 : 100,
  };
}

export type Badge = { id: string; name: string; hint: string; earned: boolean };

export function computeBadges(entries: Entry[], goal: Goal | null): Badge[] {
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const streak = computeStreak(entries);
  const best = entries.reduce((m, e) => Math.max(m, e.amount), 0);
  const pct = goal && goal.target > 0 ? total / goal.target : 0;
  return [
    { id: "first", name: "First Blood", hint: "Log your first win", earned: entries.length >= 1 },
    { id: "streak3", name: "On Fire", hint: "3-day streak", earned: streak >= 3 },
    { id: "streak7", name: "Unstoppable", hint: "7-day streak", earned: streak >= 7 },
    { id: "ten", name: "Ten Wins", hint: "Log 10 entries", earned: entries.length >= 10 },
    { id: "half", name: "Halfway Hero", hint: "Hit 50% of target", earned: pct >= 0.5 },
    { id: "big", name: "Big Ticket", hint: "One win over 500", earned: best >= 500 },
    { id: "done", name: "Goal Crusher", hint: "Reach 100%", earned: pct >= 1 },
  ];
}

export function buildSeries(entries: Entry[], goal: Goal) {
  const end = goal.deadline ?? todayISO();
  const lastDay = daysBetween(goal.startDate, end) >= 0 ? end : goal.startDate;
  const span = Math.max(1, Math.min(180, daysBetween(goal.startDate, lastDay)));
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount);

  const rows: { date: string; label: string; earned: number; pace: number | null }[] = [];
  let running = 0;
  const today = todayISO();
  for (let i = 0; i <= span; i++) {
    const d = new Date(goal.startDate + "T00:00:00");
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    running += byDay.get(iso) ?? 0;
    rows.push({
      date: iso,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      earned: iso <= today ? Math.round(running * 100) / 100 : null!,
      pace: goal.deadline ? Math.round((goal.target * (i / span)) * 100) / 100 : null,
    });
  }
  return rows;
}
