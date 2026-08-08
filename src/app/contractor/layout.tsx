import React from "react";
import { HardHat } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <HardHat className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold font-heading">RentOS</h1>
            <p className="text-[10px] text-muted-foreground">Contractor Portal</p>
          </div>
        </div>
      </header>
        <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
