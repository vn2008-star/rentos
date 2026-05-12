"use client";
import { Settings, Building2, Bell, Shield, Palette, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Settings</h1><p className="text-sm text-muted-foreground mt-0.5">Manage your organization and account</p></div>
      <Card className="border-border/50 bg-card/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Organization</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Organization Name</Label><Input defaultValue="RentOS Demo" /></div>
            <div><Label>Timezone</Label><Input defaultValue="America/Los_Angeles" /></div>
          </div>
          <Button className="gradient-brand text-white border-0">Save Changes</Button>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Billing</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/40"><span className="text-sm font-medium">Current Plan</span><span className="text-sm font-bold text-primary">Professional — $199/mo</span></div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/40"><span className="text-sm font-medium">Units Managed</span><span className="text-sm">58 / 200</span></div>
          <Button variant="outline">Manage Subscription</Button>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Email, SMS, and push notification preferences will be configurable here.</p></CardContent>
      </Card>
    </div>
  );
}
