import { ArrowLeft, Home } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl gradient-brand shadow-lg shadow-primary/25 flex items-center justify-center">
          <RentosMark className="h-9 w-9 text-white" />
        </div>
        <div>
          <h1 className="text-6xl font-bold font-heading bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
            404
          </h1>
          <p className="text-lg font-semibold mt-2">Page not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard">
            <Button className="gradient-brand text-white border-0 gap-2">
              <Home className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
