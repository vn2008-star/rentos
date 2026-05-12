"use client";

import React, { useState, useMemo } from "react";
import {
  Building2, Home, Users, Plus, Search, MapPin, DollarSign, Percent,
  ChevronRight, Eye, Edit2, MoreHorizontal, TrendingUp, AlertTriangle,
  CheckCircle, Wrench, Wifi, WifiOff, BedDouble, Bath, Ruler, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProperties, useUnits, useTenants, useMaintenance, useWorkOrders } from "@/lib/hooks";
import type { Property, Unit, Tenant } from "@/lib/types";

const statusColors: Record<string, string> = {
  occupied: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  available: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  maintenance: "text-red-400 bg-red-500/15 border-red-500/30",
  reserved: "text-blue-400 bg-blue-500/15 border-blue-500/30",
};

const propTypeIcons: Record<string, string> = {
  apartment: "🏢", house: "🏠", condo: "🏙️", townhouse: "🏘️", commercial: "🏪", multi_family: "🏗️",
};

export default function PortfolioPage() {
  const { properties, isLive } = useProperties();
  const { units } = useUnits();
  const { tenants } = useTenants();
  const { requests } = useMaintenance();
  const { workOrders } = useWorkOrders();

  const [search, setSearch] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // Portfolio-wide KPIs
  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === "occupied").length;
  const vacantUnits = units.filter(u => u.status === "available").length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const totalRevenue = units.reduce((s, u) => s + (u.status === "occupied" ? u.rent : 0), 0);
  const potentialRevenue = units.reduce((s, u) => s + u.rent, 0);
  const openMaintenance = requests.filter(r => !["completed", "closed"].includes(r.status)).length;

  // Filter properties
  const filteredProps = properties.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.address.street.toLowerCase().includes(q) || p.address.city.toLowerCase().includes(q);
  });

  // Property detail
  const detailProp = selectedProperty ? properties.find(p => p.id === selectedProperty) : null;
  const propUnits = detailProp ? units.filter(u => u.propertyId === detailProp.id) : [];
  const propTenants = propUnits.flatMap(u => tenants.filter(t => t.unitId === u.id));
  const propRequests = detailProp ? requests.filter(r => r.propertyId === detailProp.id) : [];
  const propOccupied = propUnits.filter(u => u.status === "occupied").length;
  const propOccRate = propUnits.length > 0 ? Math.round((propOccupied / propUnits.length) * 100) : 0;
  const propRevenue = propUnits.reduce((s, u) => s + (u.status === "occupied" ? u.rent : 0), 0);

  // Unit detail
  const detailUnit = selectedUnit ? units.find(u => u.id === selectedUnit) : null;
  const unitTenants = detailUnit ? tenants.filter(t => t.unitId === detailUnit.id) : [];
  const unitRequests = detailUnit ? requests.filter(r => r.unitId === detailUnit.id) : [];

  const getPropertyStats = (propId: string) => {
    const pUnits = units.filter(u => u.propertyId === propId);
    const occ = pUnits.filter(u => u.status === "occupied").length;
    const rev = pUnits.reduce((s, u) => s + (u.status === "occupied" ? u.rent : 0), 0);
    const maint = requests.filter(r => r.propertyId === propId && !["completed", "closed"].includes(r.status)).length;
    return { units: pUnits.length, occupied: occ, rate: pUnits.length > 0 ? Math.round((occ / pUnits.length) * 100) : 0, revenue: rev, maintenance: maint };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Portfolio Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {properties.length} properties · {totalUnits} units
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-heading">{properties.length}</p>
          <p className="text-[11px] text-muted-foreground">Properties</p>
        </CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-heading">{totalUnits}</p>
          <p className="text-[11px] text-muted-foreground">Total Units</p>
        </CardContent></Card>
        <Card className="border-emerald-500/20 bg-card/50"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-heading text-emerald-400">{occupancyRate}%</p>
          <p className="text-[11px] text-muted-foreground">Occupancy</p>
        </CardContent></Card>
        <Card className="border-amber-500/20 bg-card/50"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-heading text-amber-400">{vacantUnits}</p>
          <p className="text-[11px] text-muted-foreground">Vacant</p>
        </CardContent></Card>
        <Card className="border-blue-500/20 bg-card/50"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-heading text-blue-400">${totalRevenue.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground">Monthly Rev</p>
        </CardContent></Card>
        <Card className="border-red-500/20 bg-card/50"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-heading text-red-400">{openMaintenance}</p>
          <p className="text-[11px] text-muted-foreground">Open Repairs</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search properties..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Property Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredProps.map(prop => {
          const stats = getPropertyStats(prop.id);
          return (
            <Card key={prop.id} className="group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer" onClick={() => setSelectedProperty(prop.id)}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl gradient-brand flex items-center justify-center text-xl shadow-lg shadow-primary/20">
                      {propTypeIcons[prop.type] || "🏠"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm font-heading group-hover:text-primary transition-colors">{prop.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {prop.address.street}, {prop.address.city}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-accent/30 rounded-lg p-2">
                    <p className="text-base font-bold font-heading">{stats.units}</p>
                    <p className="text-[10px] text-muted-foreground">Units</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-2">
                    <p className={`text-base font-bold font-heading ${stats.rate >= 90 ? 'text-emerald-400' : stats.rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{stats.rate}%</p>
                    <p className="text-[10px] text-muted-foreground">Occ</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-2">
                    <p className="text-base font-bold font-heading text-blue-400">${(stats.revenue / 1000).toFixed(1)}k</p>
                    <p className="text-[10px] text-muted-foreground">Rev</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-2">
                    <p className={`text-base font-bold font-heading ${stats.maintenance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{stats.maintenance}</p>
                    <p className="text-[10px] text-muted-foreground">Repairs</p>
                  </div>
                </div>

                {/* Occupancy Bar */}
                <div>
                  <div className="h-1.5 rounded-full bg-accent/30 overflow-hidden">
                    <div className="h-full rounded-full gradient-brand transition-all duration-500" style={{ width: `${stats.rate}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{stats.occupied}/{stats.units} occupied</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Property Detail Dialog */}
      <Dialog open={!!selectedProperty} onOpenChange={() => { setSelectedProperty(null); setSelectedUnit(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailProp && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-3">
                  <span className="text-xl">{propTypeIcons[detailProp.type] || "🏠"}</span>
                  {detailProp.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {detailProp.address.street}, {detailProp.address.city}, {detailProp.address.state} {detailProp.address.zip}
                </div>

                {/* Property Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <Card className="border-border/50"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold font-heading">{propUnits.length}</p>
                    <p className="text-[10px] text-muted-foreground">Units</p>
                  </CardContent></Card>
                  <Card className="border-emerald-500/20"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold font-heading text-emerald-400">{propOccRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Occupancy</p>
                  </CardContent></Card>
                  <Card className="border-blue-500/20"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold font-heading text-blue-400">${propRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                  </CardContent></Card>
                  <Card className="border-amber-500/20"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold font-heading text-amber-400">{propRequests.filter(r => !["completed","closed"].includes(r.status)).length}</p>
                    <p className="text-[10px] text-muted-foreground">Open Repairs</p>
                  </CardContent></Card>
                </div>

                <Tabs defaultValue="units">
                  <TabsList>
                    <TabsTrigger value="units">Units ({propUnits.length})</TabsTrigger>
                    <TabsTrigger value="tenants">Tenants ({propTenants.length})</TabsTrigger>
                    <TabsTrigger value="maintenance">Repairs ({propRequests.length})</TabsTrigger>
                  </TabsList>

                  {/* Units Tab */}
                  <TabsContent value="units" className="mt-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {propUnits.map(unit => {
                        const unitTens = tenants.filter(t => t.unitId === unit.id);
                        const unitMaint = requests.filter(r => r.unitId === unit.id && !["completed","closed"].includes(r.status)).length;
                        return (
                          <Card key={unit.id} className="border-border/50 bg-card/50 hover:border-primary/20 transition-all cursor-pointer" onClick={() => setSelectedUnit(unit.id)}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Home className="h-4 w-4 text-primary" />
                                  <span className="font-semibold text-sm font-heading">Unit {unit.unitNumber}</span>
                                </div>
                                <Badge className={`border text-[10px] ${statusColors[unit.status] || statusColors.available}`}>
                                  {unit.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {unit.beds}bd</span>
                                <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {unit.baths}ba</span>
                                <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {unit.sqft}sf</span>
                                <span className="flex items-center gap-1 ml-auto"><DollarSign className="h-3 w-3" /> ${unit.rent.toLocaleString()}/mo</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">{unitTens.length > 0 ? unitTens.map(t => `${t.firstName} ${t.lastName}`).join(", ") : "Vacant"}</span>
                                {unitMaint > 0 && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">{unitMaint} repairs</Badge>}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </TabsContent>

                  {/* Tenants Tab */}
                  <TabsContent value="tenants" className="mt-4">
                    <div className="space-y-2">
                      {propTenants.map(t => {
                        const tUnit = units.find(u => u.id === t.unitId);
                        return (
                          <Card key={t.id} className="border-border/50 bg-card/50">
                            <CardContent className="p-3 flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {t.firstName[0]}{t.lastName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{t.firstName} {t.lastName}</p>
                                <p className="text-xs text-muted-foreground">{t.email} · Unit {tUnit?.unitNumber || "—"}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-medium">${tUnit?.rent.toLocaleString()}/mo</p>
                                <Badge variant="outline" className={`text-[10px] ${t.leaseId ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>{t.leaseId ? "Active" : "No Lease"}</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {propTenants.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No tenants</p>}
                    </div>
                  </TabsContent>

                  {/* Maintenance Tab */}
                  <TabsContent value="maintenance" className="mt-4">
                    <div className="space-y-2">
                      {propRequests.map(r => {
                        const rUnit = units.find(u => u.id === r.unitId);
                        return (
                          <Card key={r.id} className="border-border/50 bg-card/50">
                            <CardContent className="p-3 flex items-center gap-3">
                              <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{r.title}</p>
                                <p className="text-xs text-muted-foreground">Unit {rUnit?.unitNumber || "—"} · {r.category}</p>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${["completed","closed"].includes(r.status) ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>{r.status.replace("_"," ")}</Badge>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {propRequests.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No maintenance requests</p>}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Unit Detail Dialog */}
      <Dialog open={!!selectedUnit} onOpenChange={() => setSelectedUnit(null)}>
        <DialogContent className="max-w-md">
          {detailUnit && (() => {
            const prop = properties.find(p => p.id === detailUnit.propertyId);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-heading flex items-center gap-2">
                    <Home className="h-5 w-5 text-primary" /> Unit {detailUnit.unitNumber}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <Badge className={`border ${statusColors[detailUnit.status] || statusColors.available}`}>{detailUnit.status}</Badge>
                    <span className="text-sm font-bold font-heading">${detailUnit.rent.toLocaleString()}/mo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center bg-accent/30 rounded-lg p-3">
                    <div><p className="text-sm font-bold">{detailUnit.beds}</p><p className="text-[10px] text-muted-foreground">Beds</p></div>
                    <div><p className="text-sm font-bold">{detailUnit.baths}</p><p className="text-[10px] text-muted-foreground">Baths</p></div>
                    <div><p className="text-sm font-bold">{detailUnit.sqft}</p><p className="text-[10px] text-muted-foreground">Sq Ft</p></div>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Property</p><p className="text-sm">{prop?.name || "—"}</p></div>
                  {detailUnit.amenities?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Amenities</p>
                      <div className="flex flex-wrap gap-1">{detailUnit.amenities.map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}</div>
                    </div>
                  )}
                  {unitTenants.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Current Tenants</p>
                      {unitTenants.map(t => (
                        <div key={t.id} className="flex items-center gap-3 bg-accent/30 rounded-lg p-2">
                          <div className="h-8 w-8 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold">{t.firstName[0]}{t.lastName[0]}</div>
                          <div><p className="text-sm font-medium">{t.firstName} {t.lastName}</p><p className="text-xs text-muted-foreground">{t.email}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {unitRequests.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Maintenance ({unitRequests.length})</p>
                      {unitRequests.map(r => (
                        <div key={r.id} className="flex items-center gap-2 text-sm py-1">
                          <Wrench className="h-3 w-3 text-muted-foreground" />
                          <span className="flex-1 truncate">{r.title}</span>
                          <Badge variant="outline" className="text-[10px]">{r.status.replace("_"," ")}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
