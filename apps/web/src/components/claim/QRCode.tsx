"use client";

import { useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QRCode({
  value,
  size = 220,
  filename = "openbadge-qr",
}: {
  value: string;
  size?: number;
  filename?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const downloadPng = useCallback(() => {
    const svg = wrapperRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new window.Image();
    img.onload = () => {
      const scale = 4;
      const canvas = document.createElement("canvas");
      canvas.width = size * scale;
      canvas.height = size * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${filename}.png`;
      a.click();
    };
    img.src = url;
  }, [filename, size]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={wrapperRef} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <QRCodeSVG value={value} size={size} level="M" marginSize={1} />
      </div>
      <p className="max-w-full break-all text-center font-mono text-xs text-slate-500">
        {value}
      </p>
      <Button variant="outline" size="sm" onClick={downloadPng}>
        <Download className="h-4 w-4" />
        Download PNG
      </Button>
    </div>
  );
}
