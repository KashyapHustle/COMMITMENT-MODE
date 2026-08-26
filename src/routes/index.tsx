import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Flame,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/ProgressRing";
import {
  buildSeries,
  computeBadges,
  computeStreak,
  daysBetween,
  formatMoney,
  levelFor,
  todayISO,
  useHustle,
  type Entry,
  type Goal,
} from "@/lib/hustle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hustle Quest — Side Hustle Money Goal Tracker" },
      {
        name: "description",
        content:
          "Set a money target and a deadline, log every win, and watch your streaks, levels and charts grow. A gamified commitment tracker for side hustlers.",
      },
      { property: "og:title", content: "Hustle Quest — Side Hustle Money Goal Tracker" },
      {
        property: "og:description",
        content:
          "Commit to a money target, log daily wins, and track pace with charts, streaks and badges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { state, loaded, persist } = useHustle();

  if (!loaded) return <div className="min-h-screen" />;
  if (!state.goal)
    return <GoalSetup onCreate={(goal) => persist({ goal, entries: [] })} />;

  return (
    <Dashboard
      goal={state.goal}
      entries={state.entries}
      onAdd={(entry) => persist({ goal: state.goal, entries: [entry, ...state.entries] })}
      onDelete={(id) =>
        persist({ goal: state.goal, entries: state.entries.filter((e) => e.id !== id) })
      }
      onReset={() => persist({ goal: null, entries: [] })}
    />
  );
}

/* ---------------- setup ---------------- */

function GoalSetup({ onCreate }: { onCreate: (g: Goal) => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState("$");
  const [deadline, setDeadline] = useState("");
  const [openEnded, setOpenEnded] = useState(false);

  const valid = Number(target) > 0 && (openEnded || !!deadline);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-accent" /> Commitment mode
        </span>
        <h1 className="text-4xl font-bold tracking-tight">
          Make <span className="text-gradient">the money</span>. Before the clock.
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick a target, pick a deadline, then log every win. Streaks, levels and charts keep you
          honest.
        </p>
      </header>

      <section className="surface-card space-y-5 p-5">
        <div className="space-y-2">
          <Label htmlFor="title">Quest name</Label>
          <Input
            id="title"
            placeholder="Freelance design sprint"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div className="space-y-2">
            <Label htmlFor="cur">Symbol</Label>
            <Input id="cur" value={currency} onChange={(e) => setCurrency(e.target.value.slice(0, 3))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target">Target amount</Label>
            <Input
              id="target"
              inputMode="decimal"
              placeholder="5000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline</Label>
          <Input
            id="deadline"
            type="date"
            min={todayISO()}
            disabled={openEnded}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setOpenEnded((v) => !v)}
            className={`text-xs font-medium underline-offset-4 hover:underline ${
              openEnded ? "text-accent" : "text-muted-foreground"
            }`}
          >
            {openEnded ? "✓ No deadline — pure grind mode" : "No deadline? Go open-ended"}
          </button>
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={!valid}
          onClick={() =>
            onCreate({
              title: title.trim() || "My side hustle quest",
              target: Number(target),
              currency: currency || "$",
              startDate: todayISO(),
              deadline: openEnded ? null : deadline,
              createdAt: Date.now(),
            })
          }
        >
          <Target /> Start the quest
        </Button>
      </section>
    </main>
  );
}

/* ---------------- dashboard ---------------- */

function Dashboard({
  goal,
  entries,
  onAdd,
  onDelete,
  onReset,
}: {
  goal: Goal;
  entries: Entry[];
  onAdd: (e: Entry) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const pct = goal.target > 0 ? total / goal.target : 0;
  const remaining = Math.max(0, goal.target - total);
  const daysLeft = goal.deadline ? daysBetween(todayISO(), goal.deadline) : null;
  const perDay = daysLeft && daysLeft > 0 ? remaining / daysLeft : remaining;
  const streak = computeStreak(entries);
  const xp = Math.round(pct * 300) + entries.length * 8 + streak * 12;
  const level = levelFor(xp);
  const badges = computeBadges(entries, goal);
  const series = useMemo(() => buildSeries(entries, goal), [entries, goal]);

  const submit = () => {
    const value = Number(amount);
    if (!value) return;
    onAdd({
      id: crypto.randomUUID(),
      amount: value,
      label: label.trim() || "Win",
      date: todayISO(),
    });
    setAmount("");
    setLabel("");
  };

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 pt-8 pb-16">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Hustle Quest</p>
          <h1 className="text-2xl font-bold tracking-tight">{goal.title}</h1>
        </div>
        <Button variant="ghost" size="icon" aria-label="Reset quest" onClick={onReset}>
          <RotateCcw />
        </Button>
      </header>

      {/* hero ring */}
      <section className="surface-card flex flex-col items-center gap-4 p-6">
        <ProgressRing pct={pct}>
          <div>
            <p className="text-3xl font-bold">{formatMoney(total, goal.currency)}</p>
            <p className="text-xs text-muted-foreground">
              of {formatMoney(goal.target, goal.currency)}
            </p>
            <p className="mt-1 text-sm font-semibold text-accent">{Math.round(pct * 100)}%</p>
          </div>
        </ProgressRing>

        <div className="grid w-full grid-cols-3 gap-2 text-center">
          <Stat label="Left" value={formatMoney(remaining, goal.currency)} />
          <Stat
            label={daysLeft === null ? "Mode" : "Days left"}
            value={daysLeft === null ? "Open" : `${Math.max(0, daysLeft)}`}
          />
          <Stat label="Need/day" value={formatMoney(perDay, goal.currency)} />
        </div>
      </section>

      {/* level + streak */}
      <section className="grid grid-cols-2 gap-3">
        <div className="surface-card space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-accent" /> Lv {level.index + 1}
          </div>
          <p className="text-xs text-muted-foreground">{level.name}</p>
          <Progress value={(level.into / level.next) * 100} className="h-2" />
          <p className="text-[11px] text-muted-foreground">{xp} XP</p>
        </div>
        <div className="surface-card space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="size-4 text-accent" /> {streak} day streak
          </div>
          <p className="text-xs text-muted-foreground">
            {streak === 0 ? "Log a win today to light it up." : "Keep the chain alive."}
          </p>
          <div className="flex gap-1 pt-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${i < Math.min(streak, 7) ? "bg-accent" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* log */}
      <section className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Log a win</h2>
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder="Amount"
            className="w-28"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            placeholder="What was it?"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button size="icon" aria-label="Add win" onClick={submit}>
            <Plus />
          </Button>
        </div>
      </section>

      {/* chart */}
      <section className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary-glow" />
          <h2 className="text-sm font-semibold">Progress vs pace</h2>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: -18, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="earnedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-glow)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
                formatter={(v: number, n: string) => [formatMoney(v, goal.currency), n === "earned" ? "Earned" : "Pace"]}
              />
              <Area
                type="monotone"
                dataKey="earned"
                stroke="var(--primary-glow)"
                strokeWidth={2.5}
                fill="url(#earnedFill)"
                dot={{ r: 3, fill: "var(--primary-glow)", strokeWidth: 0 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* badges */}
      <section className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Badges</h2>
        <div className="grid grid-cols-2 gap-2">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border p-3 transition-colors ${
                b.earned
                  ? "border-accent/60 bg-accent/10"
                  : "border-border bg-muted/40 opacity-60"
              }`}
            >
              <p className="text-xs font-semibold">{b.name}</p>
              <p className="text-[11px] text-muted-foreground">{b.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* history */}
      <section className="surface-card space-y-2 p-4">
        <h2 className="text-sm font-semibold">Recent wins</h2>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing logged yet. First win is the hardest.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.slice(0, 12).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="text-[11px] text-muted-foreground">{e.date}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-success">
                    +{formatMoney(e.amount, goal.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete entry"
                    onClick={() => onDelete(e.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/60 px-2 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
