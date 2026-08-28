import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeaderRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  total: number;
  target: number;
  currency: string;
  wins: number;
};

export type RequestRow = {
  id: string;
  from_user: string;
  username: string;
};

export function useFriends(userId: string | null) {
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data: lb } = await supabase.rpc("friend_leaderboard");
    setLeaderboard(
      ((lb ?? []) as LeaderRow[]).map((r) => ({
        ...r,
        total: Number(r.total),
        target: Number(r.target),
        wins: Number(r.wins),
      })),
    );

    const { data: reqs } = await supabase
      .from("friend_requests")
      .select("id, from_user, profiles:from_user(username)")
      .eq("to_user", userId)
      .eq("status", "pending");

    setRequests(
      ((reqs ?? []) as unknown as {
        id: string;
        from_user: string;
        profiles: { username: string } | null;
      }[]).map((r) => ({
        id: r.id,
        from_user: r.from_user,
        username: r.profiles?.username ?? "someone",
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { leaderboard, requests, loading, reload: load };
}

export async function sendFriendRequest(target: string) {
  const { data, error } = await supabase.rpc("send_friend_request", { target });
  if (error) return "error";
  return (data as string) ?? "error";
}

export async function acceptFriendRequest(requestId: string) {
  const { error } = await supabase.rpc("accept_friend_request", { request_id: requestId });
  return !error;
}

/** Redeem a stored invite code once a user is signed in. */
export async function redeemStoredInvite() {
  if (typeof window === "undefined") return;
  const code = window.localStorage.getItem("hustle-invite");
  if (!code) return;
  window.localStorage.removeItem("hustle-invite");
  await sendFriendRequest(code);
}
