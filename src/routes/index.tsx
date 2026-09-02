import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Flame,
  LogOut,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/lib/session";
import { useChallenges, type Challenge, type NewChallenge } from "@/lib/quests";
import { redeemStoredInvite } from "@/lib/friends";
import {
  computeStreak,
  daysBetween,
  formatMoney,
  levelFor,
  todayISO,
  type Entry,
} from "@/lib/hustle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Hustle Quest Side Hustle Tracker" },
      {
        name: "description",
        content:
          "Run multiple side hustle challenges at once. Track money banked, pace, streaks, wins and completed challenges from one gamified dashboard.",
      },
      { property: "og:title", content: "Dashboard — Hustle Quest Side Hustle Tracker" },
      {
        property: "og:description",
        content:
          "Multiple money challenges, separate income streams, streaks, levels and wins in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CATEGORIES = ["Freelance", "Reselling", "Content", "Products", "Services", "General"];
const EMOJIS = ["🚀", "💻", "🎨", "📦", "📱", "🛠️", "🏋️", "🎯"];

function Index() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, ready, userId } = useSession();
  const { profile } = useProfile(userId);
  const { challenges, wins, loading, createChallenge, setStatus, reload } = useChallenges(userId);

  useEffect(() => {
    if (userId) void redeemStoredInvite();
  }, [userId]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (!ready) return <div className="min-h-screen" />;
  if (!session) return <Landing />;
  if (loading) return <div className="min-h-screen" />;

  return (
    <DashboardView
      challenges={challenges}
      wins={wins}
      username={profile?.username ?? null}
      onCreate={(c) => void createChallenge(c).then(() => toast.success("Challenge started 🚀"))}
      onComplete={(id) => void setStatus(id, "completed").then(() => toast.success("Completed 🎉"))}
      onLog={async (questId, amount, label) => {
        if (!userId) return;
        await supabase
          .from("entries")
          .insert({ user_id: userId, quest_id: questId, amount, label, date: todayISO() });
        await reload();
        toast.success("Win logged");
      }}
      onSignOut={() => void signOut()}
    />
  );
}

function Landing() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-5 py-12 text-center">
      <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-accent" /> Commitment mode
      </span>
      <h1 className="text-4xl font-bold tracking-tight">
        Make <span className="text-gradient">the money</span>. Before the clock.
      </h1>
      <p className="text-sm text-muted-foreground">
        Run several hustles side by side, keep the money separate, log every win, and race your
        friends on the leaderboard.
      </p>
      <Button size="lg" asChild>
        <Link to="/auth">
          <Target /> Start your quest
        </Link>
      </Button>
    </main>
  );
}

/* ---------------- dashboard ---------------- */

function DashboardView({
  challenges,
  wins,
  username,
  onCreate,
  onComplete,
  onLog,
  onSignOut,
}: {
  challenges: Challenge[];
  wins: (Entry & { questId: string; questTitle: string; currency: string })[];
  username: string | null;
  onCreate: (c: NewChallenge) => void;
  onComplete: (id: string) => void;
  onLog: (questId: string, amount: number, label: string) => Promise<void>;
  onSignOut: () => void;
}) {
  const [creating, setCreating] = useState(false);

  const active = challenges.filter((c) => c.status === "active");
  const completed = challenges.filter((c) => c.status === "completed");
  const currency = challenges[0]?.currency ?? "$";
  const banked = challenges.reduce((s, c) => s + c.total, 0);
  const streak = computeStreak(wins);
  const xp = wins.length * 8 + streak * 12 + completed.length * 120;
  const level = levelFor(xp);

  const daily = useMemo(() => {
    const rows: { label: string; amount: number }[] = [];
    const byDay = new Map<string, number>();
    for (const w of wins) byDay.set(w.date, (byDay.get(w.date) ?? 0) + w.amount);
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      rows.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, amount: byDay.get(iso) ?? 0 });
    }
    return rows;
  }, [wins]);

  const thisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const iso = cutoff.toISOString().slice(0, 10);
    return wins.filter((w) => w.date >= iso).reduce((s, w) => s + w.amount, 0);
  }, [wins]);

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 pt-8 pb-16">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {username ? `@${username}` : "Hustle Quest"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" aria-label="Friends" asChild>
            <Link to="/friends">
              <Users />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={onSignOut}>
            <LogOut />
          </Button>
        </div>
      </header>

      {/* banked */}
      <section className="surface-card space-y-3 p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="size-4 text-accent" /> Total banked across all challenges
        </div>
        <p className="text-4xl font-bold tracking-tight">{formatMoney(banked, currency)}</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Active" value={`${active.length}`} />
          <Stat label="Wins" value={`${wins.length}`} />
          <Stat label="7d" value={formatMoney(thisWeek, currency)} />
          <Stat label="Done" value={`${completed.length}`} />
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

      {/* quick log */}
      {active.length > 0 && <QuickLog challenges={active} onLog={onLog} />}

      {/* active challenges */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Active challenges</h2>
          <Button size="sm" variant="secondary" onClick={() => setCreating((v) => !v)}>
            <Plus /> New
          </Button>
        </div>

        {creating && (
          <NewChallengeForm
            onCancel={() => setCreating(false)}
            onCreate={(c) => {
              onCreate(c);
              setCreating(false);
            }}
          />
        )}

        {active.length === 0 && !creating ? (
          <div className="surface-card p-5 text-center text-xs text-muted-foreground">
            No active challenge yet. Start one and keep its money separate from the rest.
          </div>
        ) : (
          active.map((c) => <ChallengeCard key={c.id} c={c} onComplete={onComplete} />)
        )}
      </section>

      {/* chart */}
      <section className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary-glow" />
          <h2 className="text-sm font-semibold">Last 14 days</h2>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ left: -18, right: 6, top: 6 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
                formatter={(v: number) => [formatMoney(v, currency), "Earned"]}
              />
              <Bar dataKey="amount" fill="var(--primary-glow)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* completed */}
      {completed.length > 0 && (
        <section className="surface-card space-y-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-success" /> Completed challenges
          </h2>
          <ul className="divide-y divide-border">
            {completed.map((c) => (
              <li key={c.id}>
                <Link
                  to="/quest/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {c.emoji} {c.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.wins} wins · {Math.round((c.total / (c.target || 1)) * 100)}% of target
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-success">
                    {formatMoney(c.total, c.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* recent wins */}
      <section className="surface-card space-y-2 p-4">
        <h2 className="text-sm font-semibold">Recent wins</h2>
        {wins.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing logged yet. First win is the hardest.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {wins.slice(0, 10).map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{w.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {w.questTitle} · {w.date}
                  </p>
                </div>
                <span className="text-sm font-semibold text-success">
                  +{formatMoney(w.amount, w.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ChallengeCard({ c, onComplete }: { c: Challenge; onComplete: (id: string) => void }) {
  const pct = c.target > 0 ? Math.min(1, c.total / c.target) : 0;
  const daysLeft = c.deadline ? daysBetween(todayISO(), c.deadline) : null;
  const remaining = Math.max(0, c.target - c.total);
  const perDay = daysLeft && daysLeft > 0 ? remaining / daysLeft : remaining;

  return (
    <div className="surface-card space-y-3 p-4">
      <Link to="/quest/$id" params={{ id: c.id }} className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {c.emoji} {c.title}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {c.category} ·{" "}
            {daysLeft === null
              ? "Open-ended"
              : daysLeft >= 0
                ? `${daysLeft} days left`
                : "Deadline passed"}
          </p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      <Progress value={pct * 100} className="h-2" />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">
            {formatMoney(c.total, c.currency)}
          </span>{" "}
          of {formatMoney(c.target, c.currency)}
        </span>
        <span>{Math.round(pct * 100)}%</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Wins" value={`${c.wins}`} />
        <Stat label="Left" value={formatMoney(remaining, c.currency)} />
        <Stat label="Need/day" value={formatMoney(perDay, c.currency)} />
      </div>
      <Button variant="secondary" size="sm" className="w-full" onClick={() => onComplete(c.id)}>
        <CheckCircle2 /> Complete challenge
      </Button>
    </div>
  );
}

function QuickLog({
  challenges,
  onLog,
}: {
  challenges: Challenge[];
  onLog: (questId: string, amount: number, label: string) => Promise<void>;
}) {
  const [questId, setQuestId] = useState(challenges[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const submit = () => {
    const value = Number(amount);
    const target = questId || challenges[0]?.id;
    if (!value || !target) return;
    void onLog(target, value, label.trim() || "Win");
    setAmount("");
    setLabel("");
  };

  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="text-sm font-semibold">Log a win</h2>
      <select
        value={questId}
        onChange={(e) => setQuestId(e.target.value)}
        className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm"
        aria-label="Challenge"
      >
        {challenges.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.title}
          </option>
        ))}
      </select>
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
  );
}

function NewChallengeForm({
  onCreate,
  onCancel,
}: {
  onCreate: (c: NewChallenge) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState("$");
  const [deadline, setDeadline] = useState("");
  const [openEnded, setOpenEnded] = useState(false);
  const [emoji, setEmoji] = useState("🚀");
  const [category, setCategory] = useState("General");

  const valid = Number(target) > 0 && (openEnded || !!deadline);

  return (
    <section className="surface-card space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="title">Challenge name</Label>
        <Input
          id="title"
          placeholder="Freelance design sprint"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={`size-9 rounded-lg border text-base ${
              emoji === e ? "border-accent bg-accent/15" : "border-border bg-secondary"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat">Income stream</Label>
        <select
          id="cat"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[80px_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="cur">Symbol</Label>
          <Input
            id="cur"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.slice(0, 3))}
          />
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

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!valid}
          onClick={() =>
            onCreate({
              title: title.trim() || "My side hustle challenge",
              target: Number(target),
              currency: currency || "$",
              startDate: todayISO(),
              deadline: openEnded ? null : deadline,
              emoji,
              category,
            })
          }
        >
          <Target /> Start
        </Button>
      </div>
    </section>
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
