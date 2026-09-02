ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '🚀',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';

ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_status_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_status_check CHECK (status IN ('active','completed','archived'));

CREATE INDEX IF NOT EXISTS quests_user_status_idx ON public.quests (user_id, status);
CREATE INDEX IF NOT EXISTS entries_quest_idx ON public.entries (quest_id);

CREATE OR REPLACE FUNCTION public.friend_leaderboard()
 RETURNS TABLE(user_id uuid, username text, display_name text, total numeric, target numeric, currency text, wins bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH people AS (
    SELECT auth.uid() AS uid
    UNION
    SELECT f.friend_id FROM public.friendships f WHERE f.user_id = auth.uid()
  ), latest AS (
    SELECT DISTINCT ON (q.user_id) q.user_id, q.id, q.target, q.currency
    FROM public.quests q
    WHERE q.user_id IN (SELECT uid FROM people) AND q.status = 'active'
    ORDER BY q.user_id, q.created_at DESC
  )
  SELECT p.id, p.username, p.display_name,
         coalesce((SELECT sum(e.amount) FROM public.entries e WHERE e.quest_id = l.id), 0),
         coalesce(l.target, 0), coalesce(l.currency, '$'),
         coalesce((SELECT count(*) FROM public.entries e WHERE e.quest_id = l.id), 0)
  FROM public.profiles p
  JOIN people pe ON pe.uid = p.id
  LEFT JOIN latest l ON l.user_id = p.id
  ORDER BY 4 DESC;
$function$;