"use client";

import React, { useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight, Check, Home, Edit2, Image, Share2, Eye, Camera, Globe2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Unit, Property, Listing } from "@/lib/types";
import { generateListingTitle, generateListingDescription } from "@/lib/listing-generator";
import toast from "react-hot-toast";

const STEPS = [
  { label: "Select Unit", icon: Home },
  { label: "Description", icon: Edit2 },
  { label: "Photos", icon: Image },
  { label: "Channels", icon: Share2 },
  { label: "Preview", icon: Eye },
];

interface FillVacancyWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vacantUnits: Unit[];
  properties: Property[];
  onPublish: (data: {
    unitId: string; propertyId: string; title: string;
    description: string; rent: number; availableDate: string;
  }) => Promise<void>;
}

export function FillVacancyWizard({ open, onOpenChange, vacantUnits, properties, onPublish }: FillVacancyWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rent, setRent] = useState("");
  const [channels, setChannels] = useState<Record<string, boolean>>({ instagram: true, facebook: true, craigslist: false, direct: true });
  const [publishing, setPublishing] = useState(false);

  const selectedProp = selectedUnit ? properties.find(p => p.id === selectedUnit.propertyId) : null;

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    const prop = properties.find(p => p.id === unit.propertyId);
    if (prop) {
      setTitle(generateListingTitle(unit, prop));
      setDescription(generateListingDescription(unit, prop));
      setRent(String(unit.rent));
    }
  };

  const handlePublish = async () => {
    if (!selectedUnit || !selectedProp) return;
    setPublishing(true);
    try {
      await onPublish({
        unitId: selectedUnit.id,
        propertyId: selectedUnit.propertyId,
        title,
        description,
        rent: parseInt(rent) || selectedUnit.rent,
        availableDate: selectedUnit.availableDate || new Date().toISOString().split("T")[0],
      });
      toast.success("🎉 Listing published successfully!");
      onOpenChange(false);
      // Reset
      setStep(0);
      setSelectedUnit(null);
      setTitle("");
      setDescription("");
      setRent("");
    } catch {
      toast.error("Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedUnit;
      case 1: return !!title && !!description;
      case 2: return true; // photos optional
      case 3: return Object.values(channels).some(v => v);
      default: return true;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" /> Fill My Vacancy
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">Create a professional listing in seconds</p>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-4">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <React.Fragment key={i}>
                {i > 0 && <div className={cn("h-px flex-1", isDone ? "bg-primary" : "bg-border")} />}
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all",
                  isActive ? "bg-primary/15 text-primary" : isDone ? "text-primary" : "text-muted-foreground"
                )}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[280px] py-2">
          {/* Step 0: Select Unit */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select a vacant unit to create a listing for:</p>
              {vacantUnits.length === 0 ? (
                <Card className="border-dashed border-border/50 p-8 text-center">
                  <p className="text-sm text-muted-foreground">No vacant units available. All units are occupied!</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                  {vacantUnits.map(unit => {
                    const prop = properties.find(p => p.id === unit.propertyId);
                    const isSelected = selectedUnit?.id === unit.id;
                    return (
                      <Card
                        key={unit.id}
                        className={cn(
                          "cursor-pointer border-border/50 transition-all hover:border-primary/30",
                          isSelected && "border-primary bg-primary/5 shadow-md shadow-primary/10"
                        )}
                        onClick={() => handleSelectUnit(unit)}
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{prop?.name} — Unit {unit.unitNumber}</p>
                            <p className="text-xs text-muted-foreground">{unit.beds === 0 ? "Studio" : `${unit.beds}BR/${unit.baths}BA`} · {unit.sqft} sqft</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-400">${unit.rent.toLocaleString()}/mo</p>
                            <p className="text-[10px] text-muted-foreground">{unit.availableDate || "Now"}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Description */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-accent/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                Content auto-generated from unit data. Edit as needed!
              </div>
              <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} /></div>
              <div><Label>Monthly Rent ($)</Label><Input type="number" value={rent} onChange={e => setRent(e.target.value)} /></div>
            </div>
          )}

          {/* Step 2: Photos */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Add photos to your listing (optional):</p>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="aspect-[4/3] rounded-lg bg-accent/30 border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors">
                    <div className="text-center">
                      <Image className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1" />
                      <p className="text-[10px] text-muted-foreground/50">Add photo</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">💡 Listings with photos get 3× more views. You can add photos later too.</p>
            </div>
          )}

          {/* Step 3: Channels */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose where to promote this listing:</p>
              <div className="space-y-2">
                {[
                  { key: "instagram", label: "Instagram", desc: "Auto-generate hashtag-rich caption with emojis", icon: Camera, color: "text-pink-400" },
                  { key: "facebook", label: "Facebook", desc: "Structured post with all unit details", icon: Globe2, color: "text-blue-400" },
                  { key: "craigslist", label: "Craigslist", desc: "Plain-text listing optimized for CL format", icon: ExternalLink, color: "text-orange-400" },
                  { key: "direct", label: "Direct Link", desc: "Shareable public page anyone can view", icon: Share2, color: "text-emerald-400" },
                ].map(ch => (
                  <Card
                    key={ch.key}
                    className={cn(
                      "cursor-pointer border-border/50 transition-all",
                      channels[ch.key] && "border-primary bg-primary/5"
                    )}
                    onClick={() => setChannels({ ...channels, [ch.key]: !channels[ch.key] })}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", channels[ch.key] ? "bg-primary/15" : "bg-accent/30")}>
                        <ch.icon className={cn("h-4 w-4", channels[ch.key] ? ch.color : "text-muted-foreground")} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ch.label}</p>
                        <p className="text-[11px] text-muted-foreground">{ch.desc}</p>
                      </div>
                      <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all", channels[ch.key] ? "border-primary bg-primary" : "border-border")}>
                        {channels[ch.key] && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 4 && selectedUnit && selectedProp && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Review your listing before publishing:</p>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="aspect-[16/7] rounded-lg bg-accent/30 flex items-center justify-center">
                    <div className="text-center">
                      <Home className="h-8 w-8 mx-auto text-muted-foreground/30 mb-1" />
                      <p className="text-xs text-muted-foreground/50">Listing photos</p>
                    </div>
                  </div>
                  <h3 className="font-semibold font-heading">{title}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">${rent}/mo</Badge>
                    <Badge variant="outline" className="text-xs">{selectedUnit.beds === 0 ? "Studio" : `${selectedUnit.beds} Bed`} · {selectedUnit.baths} Bath</Badge>
                    <Badge variant="outline" className="text-xs">{selectedUnit.sqft} sqft</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4">{description}</p>
                  <div className="flex gap-1.5 pt-2 border-t border-border/30">
                    {Object.entries(channels).filter(([, v]) => v).map(([k]) => (
                      <Badge key={k} variant="outline" className="text-[10px] capitalize">{k}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Navigation */}
        <DialogFooter className="flex !justify-between">
          <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : onOpenChange(false)} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="gap-1.5">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={publishing} className="gradient-brand text-white border-0 gap-1.5">
              {publishing ? "Publishing..." : <><Sparkles className="h-4 w-4" /> Publish Listing</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
