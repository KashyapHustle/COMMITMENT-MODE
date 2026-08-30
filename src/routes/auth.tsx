import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type Search = { invite?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    invite: typeof search["invite"] === "string" ? search["invite"] : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Sign in — Hustle Quest" },
      {
        name: "description",
        content:
          "Create your Hustle Quest account with an email and username, then invite friends to grind their money goals alongside you.",
      },
      { property: "og:title", content: "Sign in — Hustle Quest" },
      {
        property: "og:description",
        content: "Create a profile, pick a username and invite friends to your side hustle quest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (search.invite) window.localStorage.setItem("hustle-invite", search.invite);
  }, [search.invite]);

  // Surface expired / invalid confirmation links instead of silently failing.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const code = hash.get("error_code") ?? query.get("error_code");
    const desc = hash.get("error_description") ?? query.get("error_description");
    if (!code && !desc) return;
    setLinkError(
      code === "otp_expired"
        ? "That confirmation link has expired. Enter your email below and resend it."
        : (desc ?? "That confirmation link is no longer valid.").replace(/\+/g, " "),
    );
    setSent(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void navigate({ to: "/" });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const emailRedirectTo = () =>
    typeof window === "undefined" ? undefined : `${window.location.origin}/auth`;

  const submit = async () => {
    if (!email || password.length < 6) {
      toast.error("Enter an email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (clean.length < 3) {
        toast.error("Pick a username with at least 3 letters, numbers or underscores.");
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirectTo(),
          data: { username: clean, display_name: clean },
        },
      });
      setBusy(false);
      if (error) {
        // Non-sensitive diagnostic for the browser console.
        console.error("[auth] signUp failed", { status: error.status, message: error.message });
        if (error.message.toLowerCase().includes("rate limit")) {
          toast.error("Too many emails sent right now. Wait a few minutes and try again.");
        } else if (error.message.toLowerCase().includes("already registered")) {
          toast.error("That email already has an account — sign in instead.");
          setMode("signin");
        } else {
          toast.error(error.message);
        }
        return;
      }
      if (data.session) return;
      // Supabase returns an obfuscated user with no identities when the email
      // already exists and is confirmed — no email is sent in that case.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error("That email is already verified. Sign in instead.");
        setMode("signin");
        return;
      }
      setLinkError(null);
      setSent(true);
      setCooldown(30);
      toast.success("Confirmation email sent.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        console.error("[auth] signIn failed", { status: error.status, message: error.message });
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setSent(true);
          setLinkError("Your email isn't verified yet. Resend the confirmation link below.");
          return;
        }
        toast.error(error.message);
      }
    }
  };

  const resend = async () => {
    if (cooldown > 0 || !email) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: emailRedirectTo() },
    });
    setBusy(false);
    if (error) {
      console.error("[auth] resend failed", { status: error.status, message: error.message });
      if (error.message.toLowerCase().includes("already confirmed")) {
        toast.error("This email is already verified — just sign in.");
        setSent(false);
        setMode("signin");
        return;
      }
      toast.error(
        error.status === 429
          ? "Too many requests. Wait a minute before resending."
          : `Couldn't resend: ${error.message}`,
      );
      return;
    }
    setLinkError(null);
    setCooldown(30);
    toast.success("Confirmation email resent.");
  };



  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed. Try again.");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-accent" /> Hustle Quest
        </span>
        <h1 className="text-3xl font-bold tracking-tight">
          {mode === "signup" ? (
            <>
              Claim your <span className="text-gradient">handle</span>
            </>
          ) : (
            <>
              Welcome <span className="text-gradient">back</span>
            </>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {search.invite
            ? "You were invited by a friend — sign up and you'll be connected."
            : "Save your quest to the cloud and race your friends."}
        </p>
      </header>

      {sent ? (
        <section className="surface-card space-y-2 p-6 text-center">
          <h2 className="text-sm font-semibold">Check your email</h2>
          <p className="text-xs text-muted-foreground">
            We sent a confirmation link to {email}. Click it to activate your account.
          </p>
        </section>
      ) : (
        <section className="surface-card space-y-4 p-5">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="moneymachine"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>

          <Button className="w-full" size="lg" disabled={busy} onClick={() => void submit()}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="secondary" className="w-full" onClick={() => void google()}>
            Continue with Google
          </Button>

          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </section>
      )}
    </main>
  );
}
