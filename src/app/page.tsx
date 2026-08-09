"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";
import {
  // Still used as a content icon for "properties"; the logo is RentosMark.
  Building2,
  Loader2, ArrowRight, Shield, Zap, BarChart3,
  CreditCard, Wrench, Users, ChevronRight, Star, Check,
  Smartphone, Globe, Lock,
} from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Building2,
    title: "Portfolio Management",
    desc: "Manage properties, units, and tenants from a single command center.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: CreditCard,
    title: "Payments & Billing",
    desc: "Stripe-powered rent collection, autopay, and late fee automation.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Wrench,
    title: "Maintenance Engine",
    desc: "3-way coordination between tenants, managers, and contractors.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    desc: "Occupancy trends, revenue tracking, and exportable reports.",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: Globe,
    title: "Vacancy Marketing",
    desc: "Public listings, dynamic STR pricing, and lead tracking.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: Smartphone,
    title: "Mobile Ready",
    desc: "Install as a PWA or use the native app for on-the-go management.",
    color: "from-indigo-500 to-blue-500",
  },
];

const stats = [
  { label: "Properties Managed", value: "10K+", icon: Building2 },
  { label: "Rent Collected", value: "$2.4B+", icon: CreditCard },
  { label: "Maintenance Resolved", value: "250K+", icon: Wrench },
  { label: "Happy Managers", value: "5,000+", icon: Users },
];

const testimonials = [
  { name: "Sarah Chen", role: "Property Manager, 120 units", text: "RentOS cut my maintenance response time by 60%. The contractor portal alone is worth it.", rating: 5 },
  { name: "Marcus Rivera", role: "Independent Landlord", text: "Finally a platform that doesn't feel like it was built in 2005. Beautiful, fast, and actually useful.", rating: 5 },
  { name: "Jessica Park", role: "RE Portfolio Manager", text: "The analytics dashboard gives me investor-ready reports in one click. Game changer.", rating: 5 },
];

const pricingPlans = [
  { name: "Starter", price: "$49", period: "/mo", units: "Up to 25 units", features: ["Portfolio dashboard", "Tenant management", "Basic maintenance", "Email support"], cta: "Start Free Trial", popular: false },
  { name: "Professional", price: "$199", period: "/mo", units: "Up to 200 units", features: ["Everything in Starter", "Stripe payments & autopay", "Contractor portal", "Analytics & reporting", "Vacancy marketing", "Priority support"], cta: "Start Free Trial", popular: true },
  { name: "Enterprise", price: "Custom", period: "", units: "Unlimited units", features: ["Everything in Pro", "SSO & RBAC", "Custom integrations", "Dedicated success manager", "SLA guarantee", "On-premise option"], cta: "Contact Sales", popular: false },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25 animate-pulse">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── NAV ─── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrollY > 20 ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5" : ""}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl gradient-brand flex items-center justify-center shadow-lg shadow-primary/30">
              <RentosMark className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold font-heading">RentOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
                Get Started <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background grid + glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.07) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
            <Zap className="h-3.5 w-3.5" />
            Now with AI-powered analytics
            <ChevronRight className="h-3 w-3" />
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-heading tracking-tight leading-[1.1] mb-6">
            Property management
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              that just works
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            From rent collection to maintenance coordination — RentOS gives property managers 
            the tools to run their portfolio from anywhere. Beautifully designed. Incredibly fast.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gradient-brand text-white border-0 h-12 px-8 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]">
                Start Free — 3 Months <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base border-border/50 hover:bg-accent/50">
                View Demo
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> No credit card required</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> 3-month free trial</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> Cancel anytime</span>
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/20 overflow-hidden">
            <div className="flex items-center gap-2 px-4 h-10 border-b border-border/30 bg-card/80">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-muted-foreground/50 font-mono">rentos.app/dashboard</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Properties", value: "12", color: "text-blue-400" },
                  { label: "Occupancy", value: "94%", color: "text-emerald-400" },
                  { label: "Revenue", value: "$48.2k", color: "text-amber-400" },
                  { label: "Open Issues", value: "3", color: "text-rose-400" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-accent/30 border border-border/30 p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className={`text-2xl font-bold font-heading mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-accent/20 border border-border/30 p-4 h-32">
                  <p className="text-xs text-muted-foreground font-medium mb-3">Revenue Trend</p>
                  <div className="flex items-end gap-1 h-16">
                    {[40, 55, 45, 65, 50, 75, 60, 80, 70, 85, 78, 90].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-primary/60 to-primary/20" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-accent/20 border border-border/30 p-4 h-32">
                  <p className="text-xs text-muted-foreground font-medium mb-3">Recent Activity</p>
                  {["Rent payment — Unit 4B", "Maintenance closed — 2A", "New application received"].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${["bg-emerald-400", "bg-amber-400", "bg-violet-400"][i]}`} />
                      <span className="text-[11px] text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-16 px-6 border-y border-border/30">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-3xl font-bold font-heading">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-medium mb-2">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-bold font-heading">Built for modern property managers</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              One platform to manage your entire portfolio — from collecting rent to coordinating maintenance.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-border/50 bg-card/30 p-6 hover:border-primary/30 hover:bg-card/60 transition-all duration-300">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold font-heading mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="py-24 px-6 bg-accent/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-medium mb-2">Loved by managers</p>
            <h2 className="text-3xl sm:text-4xl font-bold font-heading">What our users say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
                <div className="flex gap-0.5">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-medium mb-2">Simple pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold font-heading">Plans for every portfolio</h2>
            <p className="text-muted-foreground mt-3">Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pricingPlans.map((plan) => (
              <div key={plan.name} className={`rounded-2xl border p-6 space-y-5 relative ${plan.popular ? "border-primary/50 bg-primary/5 shadow-xl shadow-primary/10" : "border-border/50 bg-card/30"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-white text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold font-heading">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.units}</p>
                </div>
                <div>
                  <span className="text-4xl font-bold font-heading">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block">
                  <Button className={`w-full ${plan.popular ? "gradient-brand text-white border-0" : ""}`} variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-12">
          <div className="h-14 w-14 rounded-2xl gradient-brand flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/30">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading mb-4">
            Ready to modernize your portfolio?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join thousands of property managers who ditched spreadsheets for RentOS. 
            Set up in minutes, not weeks.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="gradient-brand text-white border-0 h-12 px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]">
                Get Started Free <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> SOC 2 Compliant</span>
            <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> 256-bit SSL</span>
            <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> 99.9% Uptime</span>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/30 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center">
              <RentosMark className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold font-heading">RentOS</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Reviews</a>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <p className="text-xs text-muted-foreground/50">© 2026 RentOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
