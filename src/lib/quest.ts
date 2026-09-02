import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Entry } from "@/lib/hustle";
import type { Challenge, QuestStatus } from "@/lib/quests";

/** Loads a single challenge (by id) with its entries. */
export function useQuest(userId: string | null, questId: string | null) {
  const [quest, setQuest] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId || !questId) {
      setQuest(null);
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: q } = await supabase
      .from("quests")
      .select("id, title, target, currency, start_date, deadline, created_at, status, emoji, category, completed_at")
      .eq("id", questId)
      .maybeSingle();

    if (!q) {
      setQuest(null);
      setEntries([]);
      setLoading(false);
      return;
    }

    const { data: rows } = await supabase
      .from("entries")
      .select("id, amount, label, date")
      .eq("quest_id", q.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    const list: Entry[] = (rows ?? []).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      label: r.label,
      date: r.date,
    }));

    setQuest({
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
      total: list.reduce((s, e) => s + e.amount, 0),
      wins: list.length,
    });
    setEntries(list);
    setLoading(false);
  }, [userId, questId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addEntry = useCallback(
    async (amount: number, label: string, date: string) => {
      if (!userId || !questId) return;
      await supabase.from("entries").insert({ user_id: userId, quest_id: questId, amount, label, date });
      await load();
    },
    [userId, questId, load],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await supabase.from("entries").delete().eq("id", id);
      await load();
    },
    [load],
  );

  const setStatus = useCallback(
    async (status: QuestStatus) => {
      if (!questId) return;
      await supabase
        .from("quests")
        .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
        .eq("id", questId);
      await load();
    },
    [questId, load],
  );

  const deleteQuest = useCallback(async () => {
    if (!questId) return;
    await supabase.from("entries").delete().eq("quest_id", questId);
    await supabase.from("quests").delete().eq("id", questId);
  }, [questId]);

  return { quest, entries, loading, addEntry, deleteEntry, setStatus, deleteQuest, reload: load };
}
