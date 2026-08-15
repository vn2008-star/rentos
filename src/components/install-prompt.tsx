"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Browser facts this component renders from — display mode and platform.
 *
 * Both go through useSyncExternalStore rather than an effect that assigns state.
 * They decide whether anything renders at all, so reading them in a lazy state
 * initialiser would make the client's first render disagree with the server's
 * and break hydration; assigning them in an effect is the cascading render the
 * compiler objects to. The server snapshot is the conservative answer: not
 * standalone, not iOS, which renders nothing until the client says otherwise.
 */
const NO_SUBSCRIBE = () => () => {};

function useIsStandalone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false
  );
}

function useIsIOS(): boolean {
  // Never changes for the life of the page, so there is nothing to subscribe to.
  return useSyncExternalStore(
    NO_SUBSCRIBE,
    () => /iPad|iPhone|iPod/.test(navigator.userAgent),
    () => false
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isIOS = useIsIOS();
  const isStandalone = useIsStandalone();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  };

  // Only show if installable (Android) or on iOS (manual instructions)
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-card/95 backdrop-blur-md p-4 shadow-2xl shadow-primary/10">
        <div className="h-10 w-10 rounded-lg gradient-brand flex items-center justify-center shrink-0">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold font-heading">Install RentOS</p>
          <p className="text-[11px] text-muted-foreground">
            {isIOS ? "Tap Share → Add to Home Screen" : "Add to your home screen for quick access"}
          </p>
        </div>
        {deferredPrompt ? (
          <Button size="sm" className="gradient-brand text-white border-0 text-xs shrink-0" onClick={handleInstall}>
            Install
          </Button>
        ) : null}
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
