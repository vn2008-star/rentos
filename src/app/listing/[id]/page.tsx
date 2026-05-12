"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  MapPin, Bed, Bath, Maximize, Calendar, Mail, Phone, Send,
  Home, Star, Check, ArrowRight, Building2, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockListings, mockUnits, mockProperties } from "@/lib/mock-data";
import type { Listing, Unit, Property } from "@/lib/types";
import toast from "react-hot-toast";

export default function PublicListingPage() {
  const params = useParams();
  const id = params.id as string;
  const [listing, setListing] = useState<Listing | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appForm, setAppForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    currentAddress: "", employer: "", income: "", moveInDate: "", message: "",
  });

  useEffect(() => {
    // In production, this would be a Firestore fetch
    const found = mockListings.find(l => l.id === id);
    if (found) {
      setListing(found);
      setUnit(mockUnits.find(u => u.id === found.unitId) || null);
      setProperty(mockProperties.find(p => p.id === found.propertyId) || null);
    }
  }, [id]);

  const handleApply = async () => {
    if (!appForm.firstName || !appForm.lastName || !appForm.email) {
      toast.error("Please fill in required fields");
      return;
    }
    setApplying(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));
    setApplying(false);
    setShowApply(false);
    toast.success("Application submitted! We'll be in touch within 24 hours. 🎉");
  };

  const handleContact = () => {
    if (property) {
      window.location.href = `mailto:leasing@rentos.io?subject=Inquiry: ${listing?.title}&body=Hi, I'm interested in this listing. Please contact me about availability.`;
    }
  };

  if (!listing || !unit || !property) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Home className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <h1 className="text-2xl font-bold font-heading text-white">Listing Not Found</h1>
          <p className="text-sm text-muted-foreground">This listing may have been removed or is no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-lg font-bold font-heading">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">R</div>
            RentOS
          </a>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-white/10 text-white/70 hover:text-white" onClick={handleContact}>
              <Mail className="h-3.5 w-3.5 mr-1.5" /> Contact
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0" onClick={() => setShowApply(true)}>
              Apply Now <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative">
        <div className="aspect-[21/8] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Building2 className="h-16 w-16 mx-auto text-white/10" />
            <p className="text-sm text-white/30">Photos coming soon</p>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
        {listing.status === "filled" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Badge className="bg-red-500/90 text-white text-lg px-6 py-2">This unit has been filled</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Card */}
            <Card className="bg-slate-900/90 border-white/5 backdrop-blur-xl">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold font-heading text-white">{listing.title}</h1>
                  <div className="flex items-center gap-2 mt-2 text-sm text-white/60">
                    <MapPin className="h-4 w-4" />
                    {property.address.street}, {property.address.city}, {property.address.state} {property.address.zip}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                    <Bed className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium">{unit.beds === 0 ? "Studio" : `${unit.beds} Bed`}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                    <Bath className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-medium">{unit.baths} Bath</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                    <Maximize className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-medium">{unit.sqft.toLocaleString()} sqft</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium">{listing.availableDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="bg-slate-900/90 border-white/5">
              <CardHeader><CardTitle className="font-heading text-lg text-white">About This Unit</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">{listing.description}</p>
              </CardContent>
            </Card>

            {/* Amenities */}
            <Card className="bg-slate-900/90 border-white/5">
              <CardHeader><CardTitle className="font-heading text-lg text-white">Amenities</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[...unit.amenities, ...property.amenities].map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Property Info */}
            <Card className="bg-slate-900/90 border-white/5">
              <CardHeader><CardTitle className="font-heading text-lg text-white">About {property.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-white/70">{property.description}</p>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Building2 className="h-4 w-4" />
                  {property.totalUnits} total units · Built {property.yearBuilt || "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Price Card */}
            <Card className="bg-slate-900/90 border-white/5 sticky top-20">
              <CardContent className="p-6 space-y-5">
                <div>
                  <p className="text-3xl font-bold font-heading text-white">${listing.rent.toLocaleString()}<span className="text-base font-normal text-white/50">/mo</span></p>
                  <p className="text-xs text-white/40 mt-1">Security deposit: ${unit.deposit.toLocaleString()}</p>
                </div>

                <div className="space-y-2">
                  <Button className="w-full bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 h-11 text-base" onClick={() => setShowApply(true)}>
                    Apply Now <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button variant="outline" className="w-full border-white/10 text-white/70 hover:text-white" onClick={handleContact}>
                    <Mail className="h-4 w-4 mr-2" /> Contact Manager
                  </Button>
                </div>

                <div className="border-t border-white/5 pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span>Verified listing</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    <span>Available {listing.availableDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Star className="h-4 w-4 text-amber-400" />
                    <span>Powered by RentOS</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Application Form (inline, not dialog) */}
      {showApply && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-slate-900 border-white/10 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="font-heading text-white">Apply for {unit.beds === 0 ? "Studio" : `${unit.beds}BR`} at {property.name}</CardTitle>
              <p className="text-xs text-white/50">${listing.rent}/mo · Available {listing.availableDate}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="apply">
                <TabsList className="w-full">
                  <TabsTrigger value="apply" className="flex-1">Apply Online</TabsTrigger>
                  <TabsTrigger value="contact" className="flex-1">Just Contact</TabsTrigger>
                </TabsList>

                <TabsContent value="apply" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/70">First Name *</Label><Input className="bg-white/5 border-white/10 text-white" value={appForm.firstName} onChange={e => setAppForm({ ...appForm, firstName: e.target.value })} /></div>
                    <div><Label className="text-white/70">Last Name *</Label><Input className="bg-white/5 border-white/10 text-white" value={appForm.lastName} onChange={e => setAppForm({ ...appForm, lastName: e.target.value })} /></div>
                  </div>
                  <div><Label className="text-white/70">Email *</Label><Input type="email" className="bg-white/5 border-white/10 text-white" value={appForm.email} onChange={e => setAppForm({ ...appForm, email: e.target.value })} /></div>
                  <div><Label className="text-white/70">Phone</Label><Input className="bg-white/5 border-white/10 text-white" value={appForm.phone} onChange={e => setAppForm({ ...appForm, phone: e.target.value })} /></div>
                  <div><Label className="text-white/70">Current Address</Label><Input className="bg-white/5 border-white/10 text-white" value={appForm.currentAddress} onChange={e => setAppForm({ ...appForm, currentAddress: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/70">Employer</Label><Input className="bg-white/5 border-white/10 text-white" value={appForm.employer} onChange={e => setAppForm({ ...appForm, employer: e.target.value })} /></div>
                    <div><Label className="text-white/70">Annual Income</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={appForm.income} onChange={e => setAppForm({ ...appForm, income: e.target.value })} /></div>
                  </div>
                  <div><Label className="text-white/70">Desired Move-in Date</Label><Input type="date" className="bg-white/5 border-white/10 text-white" value={appForm.moveInDate} onChange={e => setAppForm({ ...appForm, moveInDate: e.target.value })} /></div>
                  <Button onClick={handleApply} disabled={applying} className="w-full bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0">
                    {applying ? "Submitting..." : "Submit Application"}
                  </Button>
                </TabsContent>

                <TabsContent value="contact" className="space-y-3 mt-4">
                  <div><Label className="text-white/70">Your Name</Label><Input className="bg-white/5 border-white/10 text-white" value={appForm.firstName} onChange={e => setAppForm({ ...appForm, firstName: e.target.value })} /></div>
                  <div><Label className="text-white/70">Email</Label><Input type="email" className="bg-white/5 border-white/10 text-white" value={appForm.email} onChange={e => setAppForm({ ...appForm, email: e.target.value })} /></div>
                  <div><Label className="text-white/70">Message</Label><Textarea className="bg-white/5 border-white/10 text-white" rows={4} value={appForm.message} onChange={e => setAppForm({ ...appForm, message: e.target.value })} placeholder="I'm interested in this listing..." /></div>
                  <Button onClick={handleContact} className="w-full border-white/10" variant="outline">
                    <Send className="h-4 w-4 mr-2" /> Send Message
                  </Button>
                </TabsContent>
              </Tabs>

              <Button variant="ghost" className="w-full text-white/40 hover:text-white/60" onClick={() => setShowApply(false)}>Cancel</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-xs text-white/30">
          <p>© 2025 RentOS. All rights reserved.</p>
          <p>Listing ID: {listing.id}</p>
        </div>
      </footer>
    </div>
  );
}
