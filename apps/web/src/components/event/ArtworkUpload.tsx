"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function ArtworkUpload({
  onUploaded,
  initialUrl,
  purpose = "event_artwork",
}: {
  onUploaded: (mediaId: string, url: string) => void;
  initialUrl?: string | null;
  purpose?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Only PNG, JPEG or WEBP images are allowed.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("Image must be 10MB or smaller.");
        return;
      }

      setUploading(true);
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      try {
        const ticket = await api.media.createUpload({
          purpose,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        const { mediaId, uploadUrl } = ticket.data;

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed (${putRes.status})`);
        }

        const completed = await api.media.complete(mediaId);
        const finalUrl = completed.data?.url ?? localPreview;
        setPreviewUrl(finalUrl);
        onUploaded(mediaId, finalUrl);
      } catch (err) {
        setPreviewUrl(initialUrl ?? null);
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Upload failed",
        );
      } finally {
        setUploading(false);
      }
    },
    [initialUrl, onUploaded, purpose],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex aspect-square w-full max-w-xs cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50",
        )}
      >
        {previewUrl ? (
          <>
            <Image
              src={previewUrl}
              alt="Artwork preview"
              fill
              className="object-cover"
              sizes="320px"
              unoptimized
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </>
        ) : uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <ImagePlus className="h-10 w-10 text-slate-400" aria-hidden />
            <p className="text-sm font-medium text-slate-600">
              Drop artwork here or tap to browse
            </p>
            <p className="text-xs text-slate-400">PNG, JPEG or WEBP · up to 10MB</p>
          </div>
        )}
      </div>

      {previewUrl && !uploading && (
        <button
          type="button"
          onClick={() => {
            setPreviewUrl(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
