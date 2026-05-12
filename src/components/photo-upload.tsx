"use client";

import React, { useCallback, useState, useRef } from "react";
import { Upload, X, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PhotoUploadProps {
  photos: (File | string)[];
  onChange: (photos: (File | string)[]) => void;
  maxPhotos?: number;
  className?: string;
  label?: string;
}

export function PhotoUpload({
  photos,
  onChange,
  maxPhotos = 10,
  className,
  label = "Upload Photos",
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const newFiles = Array.from(files).filter(
        (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
      );
      const remaining = maxPhotos - photos.length;
      if (remaining <= 0) return;
      onChange([...photos, ...newFiles.slice(0, remaining)]);
    },
    [photos, onChange, maxPhotos]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removePhoto = useCallback(
    (index: number) => {
      onChange(photos.filter((_, i) => i !== index));
    },
    [photos, onChange]
  );

  const getPreviewUrl = (photo: File | string): string => {
    if (typeof photo === "string") return photo;
    return URL.createObjectURL(photo);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-sm font-medium">{label}</label>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo, i) => (
            <div
              key={i}
              className="relative group aspect-square rounded-lg overflow-hidden border border-border/50 bg-accent/30"
            >
              <img
                src={getPreviewUrl(photo)}
                alt={`Photo ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removePhoto(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      {photos.length < maxPhotos && (
        <div
          className={cn(
            "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border/50 hover:border-primary/40 hover:bg-accent/30"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="rounded-xl bg-accent/50 p-3 mb-3">
            <ImagePlus className={cn("h-6 w-6", dragActive ? "text-primary" : "text-muted-foreground")} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {dragActive ? "Drop photos here" : "Click or drag photos"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {photos.length}/{maxPhotos} · Max 10MB each · JPG, PNG, WebP
          </p>
        </div>
      )}
    </div>
  );
}
