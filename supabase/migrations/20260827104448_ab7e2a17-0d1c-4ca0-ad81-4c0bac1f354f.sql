CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text,
  invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(5), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username));
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  target numeric NOT NULL CHECK (target > 0),
  currency text NOT NULL DEFAULT '$',
  start_date date NOT NULL DEFAULT current_date,
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quests_user_idx ON public.quests (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quests TO authenticated;
GRANT ALL ON public.quests TO service_role;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quests_own" ON public.quests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  label text NOT NULL DEFAULT 'Win',
  date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entries_quest_idx ON public.entries (quest_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries_own" ON public.entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
GRANT SELECT, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friendships_delete_own" ON public.friendships FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user),
  CHECK (from_user <> to_user)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_select_involved" ON public.friend_requests FOR SELECT TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "requests_insert_own" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);
CREATE POLICY "requests_update_recipient" ON public.friend_requests FOR UPDATE TO authenticated USING (auth.uid() = to_user) WITH CHECK (auth.uid() = to_user);
CREATE POLICY "requests_delete_sender" ON public.friend_requests FOR DELETE TO authenticated USING (auth.uid() = from_user);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'hustler'), '[^a-z0-9_]', '', 'g'));
  IF base = '' THEN base := 'hustler'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = candidate) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, candidate, coalesce(NEW.raw_user_meta_data->>'display_name', candidate));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.accept_friend_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.friend_requests;
BEGIN
  SELECT * INTO r FROM public.friend_requests WHERE id = request_id AND to_user = auth.uid() AND status = 'pending';
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  UPDATE public.friend_requests SET status = 'accepted' WHERE id = r.id;
  INSERT INTO public.friendships (user_id, friend_id) VALUES (r.from_user, r.to_user) ON CONFLICT DO NOTHING;
  INSERT INTO public.friendships (user_id, friend_id) VALUES (r.to_user, r.from_user) ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.friend_leaderboard()
RETURNS TABLE (user_id uuid, username text, display_name text, total numeric, target numeric, currency text, wins bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT auth.uid() AS uid
    UNION
    SELECT f.friend_id FROM public.friendships f WHERE f.user_id = auth.uid()
  ), latest AS (
    SELECT DISTINCT ON (q.user_id) q.user_id, q.id, q.target, q.currency
    FROM public.quests q
    WHERE q.user_id IN (SELECT uid FROM people)
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
$$;
GRANT EXECUTE ON FUNCTION public.friend_leaderboard() TO authenticated;

CREATE OR REPLACE FUNCTION public.send_friend_request(target text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t uuid;
BEGIN
  SELECT id INTO t FROM public.profiles WHERE lower(username) = lower(trim(target)) OR invite_code = lower(trim(target));
  IF t IS NULL THEN RETURN 'not_found'; END IF;
  IF t = auth.uid() THEN RETURN 'self'; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE user_id = auth.uid() AND friend_id = t) THEN RETURN 'already_friends'; END IF;
  IF EXISTS (SELECT 1 FROM public.friend_requests WHERE from_user = t AND to_user = auth.uid() AND status = 'pending') THEN
    RETURN 'incoming_pending';
  END IF;
  INSERT INTO public.friend_requests (from_user, to_user) VALUES (auth.uid(), t)
  ON CONFLICT (from_user, to_user) DO UPDATE SET status = 'pending', created_at = now();
  RETURN 'sent';
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;