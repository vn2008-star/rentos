"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";
import { Separator } from "@/components/ui/separator";
import type { UserRole } from "@/lib/types";
import Link from "next/link";

/** The Firebase SDK, fetched alongside the form rather than ahead of it. */
const loadAuth = () => import("@/lib/auth");
import { errorCode } from "@/lib/errors";

/**
 * Where to go after signing up — an invite link sends people here and expects
 * them back. Same-site paths only; an absolute URL would make this an open
 * redirect. Read after mount so the page stays statically rendered.
 */
function useNextPath(): string | null {
  // Read when the state is first created rather than assigned by an effect on a
  // second render. Differing from the server render is fine here: this value is
  // only ever a redirect target and never reaches the DOM, so there is nothing
  // for hydration to mismatch on.
  const [next] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  });
  return next;
}

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const nextPath = useNextPath();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "manager" as UserRole });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Same reasoning as the sign-in form: the Firebase SDK is half a megabyte
  // that nothing needs until this form is submitted, so it is fetched beside the
  // form rather than in front of it.
  React.useEffect(() => {
    loadAuth().catch(() => { /* the handlers retry and report properly */ });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    try {
      const { registerWithEmail } = await loadAuth();
      const profile = await registerWithEmail(form.email, form.password, form.name, form.role);
      setUser(profile);
      // A tenant whose email matches a record we already hold is linked to it
      // automatically, but only once the address is verified. Without this
      // they would land on an empty portal with no explanation.
      toast.success(
        "Account created — check your email and click the verification link, then sign in again.",
        { duration: 8000 }
      );
      router.push(nextPath ?? (profile.role === "tenant" ? "/portal" : "/dashboard"));
    } catch (err) {
      const code = errorCode(err) || "";
      if (code === "auth/email-already-in-use") { setError("An account with this email already exists."); }
      else if (code === "auth/weak-password") { setError("Password is too weak."); }
      else { setError("Registration failed. Please try again."); }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError("");
    try {
      const { loginWithGoogle } = await loadAuth();
      const profile = await loginWithGoogle();
      setUser(profile);
      router.push(nextPath ?? (profile.role === "tenant" ? "/portal" : "/dashboard"));
    } catch (err) {
      if (errorCode(err) !== "auth/popup-closed-by-user") { setError("Google sign-in failed."); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[420px] space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading tracking-tight">Create Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Start managing your properties with RentOS</p>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl shadow-primary/5">
          <CardContent className="p-6 space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">{error}</div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Alex Rivera" className="pl-9" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required disabled={loading} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" placeholder="you@example.com" className="pl-9" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required autoComplete="email" disabled={loading} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => v != null && setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Property Manager</SelectItem>
                    <SelectItem value="owner">Property Owner</SelectItem>
                    <SelectItem value="leasing_agent">Leasing Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-9 pr-10" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" disabled={loading} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-9" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} required autoComplete="new-password" disabled={loading} />
                </div>
              </div>

              <Button type="submit" className="w-full gradient-brand text-white border-0 shadow-lg shadow-primary/25 h-10" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </form>

            <div className="relative"><Separator /><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">or</span></div>

            <Button variant="outline" className="w-full h-10 gap-2" onClick={handleGoogleRegister} disabled={loading}>
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Continue with Google
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
