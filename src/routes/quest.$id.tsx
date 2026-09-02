import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, CheckCircle2, Flame, Plus, Trash2, TrendingUp, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/ProgressRing";
import { useSession } from "@/lib/session";
import { useQuest } from "@/lib/quest";
import {
  buildSeries,
  computeBadges,
  computeStreak,
  daysBetween,
  formatMoney,
  levelFor,
  todayISO,
} from "@/lib/hustle";

export const Route = createFileRoute("/quest/$id")({
  head: () => ({
    meta: [
      { title: "Challenge — Hustle Quest" },
      {
        name: "description",
        content:
          "Track one side hustle challenge: progress ring, pace chart, streaks, badges and every logged win.",
      },
      { property: "og:title", content: "Challenge — Hustle Quest" },
      {
        property: "og:description",
        content: "Progress, pace, streaks and wins for a single side hustle challenge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuestDetail,
});

function QuestDetail() {
  const { id } = useParams({ from: "/quest/$id" });
  const navigate = useNavigate();
  const { session, ready, userId } = useSession();
  const { quest, entries, loading, addEntry, deleteEntry, setStatus, deleteQuest } = useQuest(
    userId,
    id,
  );
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const series = useMemo(() => (quest ? buildSeries(entries, quest) : []), [entries, quest]);

  if (!ready || loading) return <div className="min-h-screen" />;
  if (!session) {
    void navigate({ to: "/auth", replace: true });
    return <div className="min-h-screen" />;
  }
  if (!quest) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-4 px-5">
        <p className="text-sm text-muted-foreground">That challenge no longer exists.</p>
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      </main>
    );
  }

  const total = quest.total;
  const pct = quest.target > 0 ? total / quest.target : 0;
  const remaining = Math.max(0, quest.target - total);
  const daysLeft = quest.deadline ? daysBetween(todayISO(), quest.deadline) : null;
  const perDay = daysLeft && daysLeft > 0 ? remaining / daysLeft : remaining;
  const streak = computeStreak(entries);
  const xp = Math.round(pct * 300) + entries.length * 8 + streak * 12;
  const level = levelFor(xp);
  const badges = computeBadges(entries, quest);
  const best = entries.reduce((m, e) => Math.max(m, e.amount), 0);
  const avg = entries.length ? total / entries.length : 0;

  const submit = () => {
    const value = Number(amount);
    if (!value) return;
    void addEntry(value, label.trim() || "Win", todayISO());
    setAmount("");
    setLabel("");
  };

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 pt-8 pb-16">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" aria-label="Back" asChild>
            <Link to="/">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {quest.category}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {quest.emoji} {quest.title}
            </h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete challenge"
          onClick={() => {
            void deleteQuest().then(() => {
              toast.success("Challenge deleted");
              void navigate({ to: "/" });
            });
          }}
        >
          <Trash2 />
        </Button>
      </header>

      <section className="surface-card flex flex-col items-center gap-4 p-6">
        <ProgressRing pct={pct}>
          <div>
            <p className="text-3xl font-bold">{formatMoney(total, quest.currency)}</p>
            <p className="text-xs text-muted-foreground">
              of {formatMoney(quest.target, quest.currency)}
            </p>
            <p className="mt-1 text-sm font-semibold text-accent">{Math.round(pct * 100)}%</p>
          </div>
        </ProgressRing>

        <div className="grid w-full grid-cols-3 gap-2 text-center">
          <Stat label="Left" value={formatMoney(remaining, quest.currency)} />
          <Stat
            label={daysLeft === null ? "Mode" : "Days left"}
            value={daysLeft === null ? "Open" : `${Math.max(0, daysLeft)}`}
          />
          <Stat label="Need/day" value={formatMoney(perDay, quest.currency)} />
        </div>

        {quest.status === "completed" ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-success/50 bg-success/10 py-2 text-xs font-semibold text-success">
            <CheckCircle2 className="size-4" /> Challenge completed
          </div>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              void setStatus("completed");
              toast.success("Challenge marked complete 🎉");
            }}
          >
            <CheckCircle2 /> Mark challenge complete
          </Button>
        )}
      </section>

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

      <section className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Wins" value={`${entries.length}`} />
        <Stat label="Avg win" value={formatMoney(avg, quest.currency)} />
        <Stat label="Best win" value={formatMoney(best, quest.currency)} />
      </section>

      {quest.status !== "completed" && (
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
      )}

      <section className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary-glow" />
          <h2 className="text-sm font-semibold">Progress vs pace</h2>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ left: -18, right: 6, top: 6 }}>
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
                formatter={(v: number, n: string) => [
                  formatMoney(v, quest.currency),
                  n === "earned" ? "Earned" : "Pace",
                ]}
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
              <Area
                type="monotone"
                dataKey="pace"
                fill="none"
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Badges</h2>
        <div className="grid grid-cols-2 gap-2">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border p-3 transition-colors ${
                b.earned ? "border-accent/60 bg-accent/10" : "border-border bg-muted/40 opacity-60"
              }`}
            >
              <p className="text-xs font-semibold">{b.name}</p>
              <p className="text-[11px] text-muted-foreground">{b.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card space-y-2 p-4">
        <h2 className="text-sm font-semibold">Wins</h2>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing logged yet. First win is the hardest.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="text-[11px] text-muted-foreground">{e.date}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-success">
                    +{formatMoney(e.amount, quest.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete entry"
                    onClick={() => void deleteEntry(e.id)}
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
