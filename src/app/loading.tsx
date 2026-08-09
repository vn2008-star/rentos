import { Loader2 } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";

export default function RootLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25 animate-pulse">
          <RentosMark className="h-8 w-8 text-white" />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading RentOS...
        </div>
      </div>
    </div>
  );
}
