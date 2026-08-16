"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/lib/store";
import { isDemoAvailable, type DemoPersona } from "@/lib/demo";
import Link from "next/link";
import { errorCode } from "@/lib/errors";

/**
 * The Firebase SDK, fetched alongside the form rather than ahead of it.
 *
 * Statically imported, `@/lib/auth` puts firebase/auth and — through
 * ./firebase — firestore and storage in front of the sign-in form: about half a
 * megabyte of JavaScript that has to arrive, parse and run before a person can
 * type their email. None of it is needed until they submit. The effect below
 * starts the fetch as soon as the form is on screen, so by the time anyone has
 * finished typing it has long since arrived; the bundler caches the module, so
 * the handlers' own await resolves instantly.
 */
const loadAuth = () => import("@/lib/auth");

const DEMO_PERSONAS: { persona: DemoPersona; label: string; href: string }[] = [
  { persona: "manager", label: "Manager", href: "/dashboard" },
  { persona: "owner", label: "Owner", href: "/owner" },
  { persona: "tenant", label: "Tenant", href: "/portal" },
  { persona: "contractor", label: "Contractor", href: "/contractor/wo-1" },
];

/**
 * Where to go after signing in.
 *
 * Read from the URL after mount rather than with useSearchParams, which would
 * force this page out of static rendering and demand a Suspense boundary.
 * Only same-site paths are honoured — an absolute URL here would turn the login
 * page into an open redirect.
 */
function useNextPath(): string | null {
  // Read when the state is first created rather than assigned by an effect on a
  // second render. Differing from the server render is fine here: this value is
  // only ever a redirect target and never reaches the DOM, so there is nothing
  // for hydration to mismatch on.
  const [next] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  });
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);
  const nextPath = useNextPath();
  // Inlined at build time, so server and client agree — safe to read during render.
  const demoReady = isDemoAvailable();

  const handleDemoLogin = (persona: DemoPersona, href: string) => {
    loginAsDemo(persona);
    router.push(href);
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Warm the auth chunk once the form is interactive, so submitting does not
  // wait on a download that could have happened while the person was typing.
  React.useEffect(() => {
    loadAuth().catch(() => { /* the handlers retry and report properly */ });
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { loginWithEmail } = await loadAuth();
      const profile = await loginWithEmail(email, password);
      setUser(profile);
      router.push(nextPath ?? (profile.role === "tenant" ? "/portal" : "/dashboard"));
    } catch (err) {
      const code = errorCode(err) || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { loginWithGoogle } = await loadAuth();
      const profile = await loginWithGoogle();
      setUser(profile);
      router.push(nextPath ?? (profile.role === "tenant" ? "/portal" : "/dashboard"));
    } catch (err) {
      if (errorCode(err) !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email first, then click forgot password.");
      return;
    }
    try {
      const { resetPassword } = await loadAuth();
      await resetPassword(email);
      setResetSent(true);
      setError("");
    } catch {
      setError("Failed to send reset email. Check your email address.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[420px] space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading tracking-tight">RentOS</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your property management dashboard</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl shadow-primary/5">
          <CardContent className="p-6 space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {resetSent && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-400">
                Password reset email sent. Check your inbox.
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gradient-brand text-white border-0 shadow-lg shadow-primary/25 h-10"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
            </form>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                or
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full h-10 gap-2"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            {demoReady && (
              <div className="space-y-3 pt-1">
                <div className="relative">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    no Firebase configured
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_PERSONAS.map(({ persona, label, href }) => (
                    <Button
                      key={persona}
                      variant="outline"
                      className="h-9 text-xs"
                      onClick={() => handleDemoLogin(persona, href)}
                      disabled={loading}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  Explore with sample data — no account needed
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Register Link */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary font-medium hover:text-primary/80 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
