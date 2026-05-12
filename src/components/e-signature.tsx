"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { PenLine, RotateCcw, Type, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ESignatureProps {
  onSign: (signatureData: string) => void;
  onCancel?: () => void;
  signerName: string;
  className?: string;
}

export function ESignature({ onSign, onCancel, signerName, className }: ESignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState("");

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#e0e0e0";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  const handleSign = () => {
    if (mode === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      onSign(canvas.toDataURL("image/png"));
    } else {
      // Generate text-based signature
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 200;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, 600, 200);
      ctx.font = "italic 48px 'Georgia', serif";
      ctx.fillStyle = "#e0e0e0";
      ctx.textBaseline = "middle";
      ctx.fillText(typedName, 40, 100);
      onSign(canvas.toDataURL("image/png"));
    }
  };

  const canSign = mode === "draw" ? hasDrawn : typedName.trim().length > 0;

  return (
    <div className={cn("space-y-4 rounded-xl border border-border/50 bg-card/50 p-5", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm font-heading">E-Signature</h3>
          <p className="text-xs text-muted-foreground">Sign as: {signerName}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-accent/50 p-1">
          <Button
            variant={mode === "draw" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setMode("draw")}
          >
            <PenLine className="h-3 w-3" /> Draw
          </Button>
          <Button
            variant={mode === "type" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setMode("type")}
          >
            <Type className="h-3 w-3" /> Type
          </Button>
        </div>
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-32 rounded-lg border border-border/50 bg-background/50 cursor-crosshair touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          <div className="absolute bottom-2 left-3 right-3 border-t border-dashed border-border/30" />
          {!hasDrawn && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/40 pointer-events-none">
              Sign here with mouse or touch
            </p>
          )}
          {hasDrawn && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-7 text-xs gap-1"
              onClick={clearCanvas}
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="Type your full legal name..."
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className="text-lg font-serif italic"
          />
          {typedName && (
            <div className="h-20 rounded-lg border border-border/50 bg-background/50 flex items-center px-6">
              <span className="text-3xl italic text-foreground/80" style={{ fontFamily: "Georgia, serif" }}>
                {typedName}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/60">
        By signing, I agree to the terms of this lease agreement and acknowledge that this electronic signature is legally binding.
      </p>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        )}
        <Button
          size="sm"
          disabled={!canSign}
          onClick={handleSign}
          className="gradient-brand text-white border-0"
        >
          <Check className="h-3.5 w-3.5 mr-1" /> Sign Lease
        </Button>
      </div>
    </div>
  );
}
