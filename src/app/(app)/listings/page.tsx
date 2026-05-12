"use client";

import React, { useState } from "react";
import {
  Megaphone, Plus, Globe, Share2, ExternalLink, Eye, Pause, Play,
  CheckCircle2, Users, Clock, TrendingUp, Copy, Camera, Globe2,
  Search, Wifi, WifiOff, MoreHorizontal, Trash2, Edit2, Mail, Phone,
  Sparkles, ArrowUpRight, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useListings, useUnits, useProperties } from "@/lib/hooks";
import { generateListingTitle, generateListingDescription, generateSocialCaption, calculateDaysOnMarket, getListingStats } from "@/lib/listing-generator";
import type { Listing } from "@/lib/types";
import toast from "react-hot-toast";

const statusConfig = {
  active: { label: "Active", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", icon: Play },
  paused: { label: "Paused", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: Pause },
  filled: { label: "Filled", color: "text-blue-400 bg-blue-500/15 border-blue-500/30", icon: CheckCircle2 },
};

const sourceIcons: Record<string, string> = {
  instagram: "📸", facebook: "📘", craigslist: "📋", "apartments.com": "🏢", zillow: "🏠", direct: "🔗",
};

export default function ListingsPage() {
  const { listings, loading, isLive, addListing, updateListing, removeListing } = useListings();
  const { units } = useUnits();
  const { properties } = useProperties();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Listing | null>(null);
  const [showSocial, setShowSocial] = useState<{ listing: Listing; platform: "instagram" | "facebook" | "craigslist" } | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ unitId: "", title: "", description: "", rent: "" });

  const vacantUnits = units.filter(u => u.status === "available");
  const stats = getListingStats(listings);

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    return l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q);
  });

  const handleAutoGenerate = () => {
    if (!form.unitId) return;
    const unit = units.find(u => u.id === form.unitId);
    const prop = properties.find(p => unit && p.id === unit.propertyId);
    if (unit && prop) {
      setForm({
        ...form,
        title: generateListingTitle(unit, prop),
        description: generateListingDescription(unit, prop),
        rent: String(unit.rent),
      });
      toast.success("✨ Auto-generated listing content!");
    }
  };

  const handleCreate = async () => {
    const unit = units.find(u => u.id === form.unitId);
    if (!unit || !form.title) return;
    setSaving(true);
    try {
      await addListing({
        unitId: form.unitId,
        propertyId: unit.propertyId,
        title: form.title,
        description: form.description,
        rent: parseInt(form.rent) || unit.rent,
        availableDate: unit.availableDate || new Date().toISOString().split("T")[0],
      });
      toast.success("Listing published!");
      setShowCreate(false);
      setForm({ unitId: "", title: "", description: "", rent: "" });
    } catch { toast.error("Failed to create listing"); }
    finally { setSaving(false); }
  };

  const handleToggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === "active" ? "paused" : "active";
    await updateListing(listing.id, { status: newStatus });
    toast.success(`Listing ${newStatus === "active" ? "activated" : "paused"}`);
  };

  const handleMarkFilled = async (listing: Listing) => {
    await updateListing(listing.id, { status: "filled" });
    toast.success("Listing marked as filled! 🎉");
    setShowDetail(null);
  };

  const handleCopySocial = (caption: string) => {
    navigator.clipboard.writeText(caption);
    toast.success("Caption copied to clipboard! 📋");
  };

  const handleOpenSocial = (listing: Listing, platform: "instagram" | "facebook" | "craigslist") => {
    const unit = units.find(u => u.id === listing.unitId);
    const prop = properties.find(p => p.id === listing.propertyId);
    if (unit && prop) {
      setShowSocial({ listing, platform });
    }
  };

  const renderListingCard = (listing: Listing) => {
    const unit = units.find(u => u.id === listing.unitId);
    const prop = properties.find(p => p.id === listing.propertyId);
    const sc = statusConfig[listing.status];
    const StatusIcon = sc.icon;
    const dom = calculateDaysOnMarket(listing);

    return (
      <Card key={listing.id} className="group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer" onClick={() => setShowDetail(listing)}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm font-heading truncate group-hover:text-primary transition-colors">{listing.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{prop?.name} · Unit {unit?.unitNumber} · {unit?.beds === 0 ? "Studio" : `${unit?.beds}BR/${unit?.baths}BA`}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleStatus(listing); }}>
                  {listing.status === "active" ? <><Pause className="h-4 w-4 mr-2" /> Pause</> : <><Play className="h-4 w-4 mr-2" /> Activate</>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkFilled(listing); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Filled
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this listing?")) removeListing(listing.id); }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs">
            <Badge className={`border ${sc.color}`}><StatusIcon className="h-3 w-3 mr-1" />{sc.label}</Badge>
            <span className="text-emerald-400 font-medium">${listing.rent.toLocaleString()}/mo</span>
            <span className="text-muted-foreground">{dom}d on market</span>
          </div>

          {/* Leads & Social */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{listing.leads.length} lead{listing.leads.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex gap-1">
              {listing.syndicatedTo.map(s => (
                <span key={s} className="text-xs" title={s}>{sourceIcons[s] || "🌐"}</span>
              ))}
              {listing.socialPosts.map((sp, i) => (
                <span key={i} className="text-xs" title={`Posted to ${sp.platform}`}>{sourceIcons[sp.platform] || "📱"}</span>
              ))}
            </div>
          </div>

          {/* Quick social share */}
          <div className="flex gap-1.5 pt-1 border-t border-border/30">
            <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1" onClick={(e) => { e.stopPropagation(); handleOpenSocial(listing, "instagram"); }}>
              <Camera className="h-3 w-3" /> IG
            </Button>
            <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1" onClick={(e) => { e.stopPropagation(); handleOpenSocial(listing, "facebook"); }}>
              <Globe2 className="h-3 w-3" /> FB
            </Button>
            <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1" onClick={(e) => { e.stopPropagation(); handleOpenSocial(listing, "craigslist"); }}>
              <ExternalLink className="h-3 w-3" /> CL
            </Button>
            <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1 ml-auto" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/listing/${listing.id}`); toast.success("Link copied!"); }}>
              <Copy className="h-3 w-3" /> Link
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Listings & Vacancies</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Manage your {listings.length} listing{listings.length !== 1 ? "s" : ""}
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> New Listing</Button>
          <Button onClick={() => setShowCreate(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Megaphone className="h-4 w-4" /> Fill My Vacancy</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Megaphone className="h-5 w-5 mx-auto text-emerald-400 mb-1" />
            <p className="text-2xl font-bold font-heading">{stats.activeCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Listings</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-blue-400 mb-1" />
            <p className="text-2xl font-bold font-heading">{stats.totalLeads}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Leads</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-400 mb-1" />
            <p className="text-2xl font-bold font-heading">{stats.avgDaysOnMarket || "—"}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Days</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-violet-400 mb-1" />
            <p className="text-2xl font-bold font-heading">{stats.conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conversion</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search listings..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({listings.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({listings.filter(l => l.status === "active").length})</TabsTrigger>
          <TabsTrigger value="paused">Paused ({listings.filter(l => l.status === "paused").length})</TabsTrigger>
          <TabsTrigger value="filled">Filled ({listings.filter(l => l.status === "filled").length})</TabsTrigger>
        </TabsList>
        {["all", "active", "paused", "filled"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.filter(l => tab === "all" || l.status === tab).map(renderListingCard)}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Listing Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Create Listing</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Vacant Unit</Label>
              <Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose a unit..." /></SelectTrigger>
                <SelectContent>
                  {vacantUnits.map(u => {
                    const p = properties.find(pp => pp.id === u.propertyId);
                    return <SelectItem key={u.id} value={u.id}>{p?.name} — Unit {u.unitNumber} ({u.beds === 0 ? "Studio" : `${u.beds}BR`}) · ${u.rent}/mo</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            {form.unitId && (
              <Button type="button" variant="outline" className="w-full gap-2" onClick={handleAutoGenerate}>
                <Sparkles className="h-4 w-4 text-amber-400" /> Auto-Generate Title & Description
              </Button>
            )}
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Bright 2BR near UC Davis..." /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Describe the listing..." /></div>
            <div><Label>Monthly Rent ($)</Label><Input type="number" value={form.rent} onChange={e => setForm({ ...form, rent: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.unitId || !form.title || saving} className="gradient-brand text-white border-0">{saving ? "Publishing..." : "Publish Listing"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Listing Detail Sheet */}
      <Sheet open={!!showDetail} onOpenChange={(open) => !open && setShowDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {showDetail && (() => {
            const listing = showDetail;
            const unit = units.find(u => u.id === listing.unitId);
            const prop = properties.find(p => p.id === listing.propertyId);
            const sc = statusConfig[listing.status];
            const dom = calculateDaysOnMarket(listing);

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="font-heading text-lg">{listing.title}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`border ${sc.color}`}>{sc.label}</Badge>
                    <span className="text-xs text-muted-foreground">{dom} days on market</span>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs">${listing.rent.toLocaleString()}/mo</Badge>
                  </div>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Unit Info */}
                  <div className="rounded-lg bg-accent/30 p-4 space-y-1">
                    <p className="text-sm font-medium">{prop?.name} — Unit {unit?.unitNumber}</p>
                    <p className="text-xs text-muted-foreground">{unit?.beds === 0 ? "Studio" : `${unit?.beds} bed`} · {unit?.baths} bath · {unit?.sqft} sqft</p>
                    <p className="text-xs text-muted-foreground">{prop?.address.street}, {prop?.address.city}, {prop?.address.state} {prop?.address.zip}</p>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Description</h4>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{listing.description}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleToggleStatus(listing)} className="gap-1.5">
                      {listing.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Activate</>}
                    </Button>
                    <Button size="sm" onClick={() => handleMarkFilled(listing)} className="gradient-brand text-white border-0 gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Filled
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/listing/${listing.id}`); toast.success("Link copied!"); }}>
                      <Copy className="h-3.5 w-3.5" /> Copy Link
                    </Button>
                  </div>

                  {/* Social Share */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Share to Social</h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleOpenSocial(listing, "instagram")}>
                        <Camera className="h-3.5 w-3.5" /> Instagram
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleOpenSocial(listing, "facebook")}>
                        <Globe2 className="h-3.5 w-3.5" /> Facebook
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleOpenSocial(listing, "craigslist")}>
                        <ExternalLink className="h-3.5 w-3.5" /> Craigslist
                      </Button>
                    </div>
                  </div>

                  {/* Social History */}
                  {listing.socialPosts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Post History</h4>
                      <div className="space-y-2">
                        {listing.socialPosts.map((sp, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg bg-accent/30 px-3 py-2">
                            <span className="text-sm">{sourceIcons[sp.platform] || "📱"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium capitalize">{sp.platform}</p>
                              <p className="text-[11px] text-muted-foreground">{new Date(sp.postedAt).toLocaleDateString()}</p>
                            </div>
                            <a href={sp.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              View <ArrowUpRight className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leads */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Leads ({listing.leads.length})</h4>
                    {listing.leads.length > 0 ? (
                      <div className="space-y-2">
                        {listing.leads.map((lead, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg bg-accent/30 px-3 py-2">
                            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary">
                              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{lead.name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Mail className="h-3 w-3" />{lead.email}
                                {lead.phone && <><Phone className="h-3 w-3 ml-1" />{lead.phone}</>}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{sourceIcons[lead.source]} {lead.source}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No leads yet. Share this listing to attract interest!</p>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Social Caption Dialog */}
      <Dialog open={!!showSocial} onOpenChange={(open) => !open && setShowSocial(null)}>
        <DialogContent className="max-w-lg">
          {showSocial && (() => {
            const { listing, platform } = showSocial;
            const unit = units.find(u => u.id === listing.unitId);
            const prop = properties.find(p => p.id === listing.propertyId);
            if (!unit || !prop) return null;
            const caption = generateSocialCaption(listing, unit, prop, platform);
            const platformNames = { instagram: "Instagram", facebook: "Facebook", craigslist: "Craigslist" };
            const platformColors = { instagram: "text-pink-400", facebook: "text-blue-400", craigslist: "text-orange-400" };

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-heading flex items-center gap-2">
                    {platform === "instagram" && <Camera className={`h-5 w-5 ${platformColors[platform]}`} />}
                    {platform === "facebook" && <Globe2 className={`h-5 w-5 ${platformColors[platform]}`} />}
                    {platform === "craigslist" && <ExternalLink className={`h-5 w-5 ${platformColors[platform]}`} />}
                    Post to {platformNames[platform]}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="rounded-lg bg-accent/30 p-4">
                    <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80 max-h-64 overflow-y-auto">{caption}</pre>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" onClick={() => handleCopySocial(caption)}>
                      <Copy className="h-4 w-4" /> Copy Caption
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => {
                      const urls: Record<string, string> = {
                        instagram: "https://instagram.com",
                        facebook: "https://facebook.com",
                        craigslist: "https://post.craigslist.org",
                      };
                      window.open(urls[platform], "_blank");
                    }}>
                      Open {platformNames[platform]} <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
