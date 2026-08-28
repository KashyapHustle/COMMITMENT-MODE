import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useProfile, useSession } from "@/lib/session";
import { acceptFriendRequest, sendFriendRequest, useFriends } from "@/lib/friends";
import { formatMoney } from "@/lib/hustle";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends & Leaderboard — Hustle Quest" },
      {
        name: "description",
        content:
          "Invite friends with your personal code, accept requests and see who is closest to smashing their side hustle money goal.",
      },
      { property: "og:title", content: "Friends & Leaderboard — Hustle Quest" },
      {
        property: "og:description",
        content: "Invite friends and race them to your side hustle money target.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const navigate = useNavigate();
  const { userId, ready } = useSession();
  const { profile } = useProfile(userId);
  const { leaderboard, requests, reload } = useFriends(userId);
  const [handle, setHandle] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ready && !userId) void navigate({ to: "/auth" });
  }, [ready, userId, navigate]);

  const inviteLink =
    typeof window !== "undefined" && profile
      ? `${window.location.origin}/auth?invite=${profile.invite_code}`
      : "";

  const invite = async () => {
    const value = handle.trim();
    if (!value) return;
    const result = await sendFriendRequest(value);
    const messages: Record<string, string> = {
      sent: "Request sent.",
      already_friends: "You're already friends.",
      incoming_pending: "They already invited you — accept it below.",
      self: "That's you.",
      not_found: "No hustler with that username or code.",
      error: "Couldn't send that request.",
    };
    if (result === "sent") toast.success(messages[result]);
    else toast.error(messages[result] ?? "Something went wrong.");
    setHandle("");
    await reload();
  };

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 pt-8 pb-16">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" asChild>
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Squad</p>
          <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        </div>
      </header>

      <section className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Your invite link</h2>
        <p className="text-xs text-muted-foreground">
          Code <span className="font-semibold text-accent">{profile?.invite_code ?? "…"}</span> —
          anyone who signs up with it becomes your friend.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={inviteLink} className="text-xs" />
          <Button
            size="icon"
            aria-label="Copy invite link"
            onClick={() => {
              void navigator.clipboard.writeText(inviteLink);
              setCopied(true);
              toast.success("Invite link copied.");
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </section>

      <section className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Add by username or code</h2>
        <div className="flex gap-2">
          <Input
            placeholder="moneymachine"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void invite()}
          />
          <Button size="icon" aria-label="Send friend request" onClick={() => void invite()}>
            <UserPlus />
          </Button>
        </div>
      </section>

      {requests.length > 0 && (
        <section className="surface-card space-y-2 p-4">
          <h2 className="text-sm font-semibold">Pending requests</h2>
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm font-medium">@{r.username}</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    const ok = await acceptFriendRequest(r.id);
                    toast[ok ? "success" : "error"](ok ? "Friend added." : "Couldn't accept.");
                    await reload();
                  }}
                >
                  Accept
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-accent" />
          <h2 className="text-sm font-semibold">Leaderboard</h2>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-xs text-muted-foreground">No one here yet. Invite a friend.</p>
        ) : (
          <ul className="space-y-3">
            {leaderboard.map((row, i) => {
              const pct = row.target > 0 ? Math.min(1, row.total / row.target) : 0;
              return (
                <li key={row.user_id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">
                      #{i + 1} {row.display_name || row.username}
                      {row.user_id === userId && (
                        <span className="ml-1 text-[11px] text-accent">you</span>
                      )}
                    </span>
                    <span className="font-semibold">
                      {formatMoney(row.total, row.currency)}
                      <span className="text-muted-foreground">
                        {" "}
                        / {formatMoney(row.target, row.currency)}
                      </span>
                    </span>
                  </div>
                  <Progress value={pct * 100} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">{row.wins} wins logged</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
