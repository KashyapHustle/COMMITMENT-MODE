import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Entry, Goal } from "@/lib/hustle";

export type QuestRow = Goal & { id: string };

export function useQuest(userId: string | null) {
  const [quest, setQuest] = useState<QuestRow | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data: q } = await supabase
      .from("quests")
      .select("id, title, target, currency, start_date, deadline, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!q) {
      setQuest(null);
      setEntries([]);
      setLoading(false);
      return;
    }

    setQuest({
      id: q.id,
      title: q.title,
      target: Number(q.target),
      currency: q.currency,
      startDate: q.start_date,
      deadline: q.deadline,
      createdAt: new Date(q.created_at).getTime(),
    });

    const { data: rows } = await supabase
      .from("entries")
      .select("id, amount, label, date")
      .eq("quest_id", q.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    setEntries(
      (rows ?? []).map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        label: r.label,
        date: r.date,
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createQuest = useCallback(
    async (goal: Goal) => {
      if (!userId) return;
      await supabase.from("quests").insert({
        user_id: userId,
        title: goal.title,
        target: goal.target,
        currency: goal.currency,
        start_date: goal.startDate,
        deadline: goal.deadline,
      });
      await load();
    },
    [userId, load],
  );

  const addEntry = useCallback(
    async (amount: number, label: string, date: string) => {
      if (!userId || !quest) return;
      await supabase
        .from("entries")
        .insert({ user_id: userId, quest_id: quest.id, amount, label, date });
      await load();
    },
    [userId, quest, load],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await supabase.from("entries").delete().eq("id", id);
      await load();
    },
    [load],
  );

  const resetQuest = useCallback(async () => {
    if (!quest) return;
    await supabase.from("quests").delete().eq("id", quest.id);
    await load();
  }, [quest, load]);

  return { quest, entries, loading, createQuest, addEntry, deleteEntry, resetQuest, reload: load };
}
