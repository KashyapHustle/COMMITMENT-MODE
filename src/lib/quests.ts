import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Entry, Goal } from "@/lib/hustle";

export type QuestStatus = "active" | "completed" | "archived";

export type Challenge = Goal & {
  id: string;
  status: QuestStatus;
  emoji: string;
  category: string;
  completedAt: string | null;
  total: number;
  wins: number;
};

export type WinRow = Entry & { questId: string; questTitle: string; currency: string };

export type NewChallenge = Omit<Goal, "createdAt"> & { emoji: string; category: string };

export function useChallenges(userId: string | null) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [wins, setWins] = useState<WinRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setChallenges([]);
      setWins([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: qs }, { data: es }] = await Promise.all([
      supabase
        .from("quests")
        .select("id, title, target, currency, start_date, deadline, created_at, status, emoji, category, completed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("entries")
        .select("id, amount, label, date, quest_id")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    const entries = es ?? [];
    const list: Challenge[] = (qs ?? []).map((q) => {
      const mine = entries.filter((e) => e.quest_id === q.id);
      return {
        id: q.id,
        title: q.title,
        target: Number(q.target),
        currency: q.currency,
        startDate: q.start_date,
        deadline: q.deadline,
        createdAt: new Date(q.created_at).getTime(),
        status: (q.status as QuestStatus) ?? "active",
        emoji: q.emoji ?? "🚀",
        category: q.category ?? "General",
        completedAt: q.completed_at,
        total: mine.reduce((s, e) => s + Number(e.amount), 0),
        wins: mine.length,
      };
    });

    const byId = new Map(list.map((c) => [c.id, c]));
    setChallenges(list);
    setWins(
      entries.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        label: e.label,
        date: e.date,
        questId: e.quest_id,
        questTitle: byId.get(e.quest_id)?.title ?? "Challenge",
        currency: byId.get(e.quest_id)?.currency ?? "$",
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createChallenge = useCallback(
    async (c: NewChallenge) => {
      if (!userId) return;
      await supabase.from("quests").insert({
        user_id: userId,
        title: c.title,
        target: c.target,
        currency: c.currency,
        start_date: c.startDate,
        deadline: c.deadline,
        emoji: c.emoji,
        category: c.category,
      });
      await load();
    },
    [userId, load],
  );

  const setStatus = useCallback(
    async (id: string, status: QuestStatus) => {
      await supabase
        .from("quests")
        .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
        .eq("id", id);
      await load();
    },
    [load],
  );

  const deleteChallenge = useCallback(
    async (id: string) => {
      await supabase.from("entries").delete().eq("quest_id", id);
      await supabase.from("quests").delete().eq("id", id);
      await load();
    },
    [load],
  );

  return { challenges, wins, loading, createChallenge, setStatus, deleteChallenge, reload: load };
}
