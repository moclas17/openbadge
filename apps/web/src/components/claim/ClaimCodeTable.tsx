"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, QrCode as QrCodeIcon, Trash2 } from "lucide-react";
import { api, ApiError, APP_URL, type ClaimCode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCode } from "@/components/claim/QRCode";
import { formatDateTime } from "@/lib/utils";

function claimUrl(code: string): string {
  return `${APP_URL}/claim/${code}`;
}

export function ClaimCodeTable({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState("10");
  const [expiresAt, setExpiresAt] = useState("");
  const [freshCodes, setFreshCodes] = useState<ClaimCode[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codesQuery = useQuery({
    queryKey: ["claim-codes", eventId],
    queryFn: async () => (await api.claimCodes.list(eventId)).data,
  });

  const generateMutation = useMutation({
    mutationFn: (input: { quantity: number; expiresAt?: string }) =>
      api.claimCodes.create(eventId, input),
    onSuccess: (res) => {
      setFreshCodes(res.data);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["claim-codes", eventId] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to generate codes");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (codeId: string) => api.claimCodes.revoke(eventId, codeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["claim-codes", eventId] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to revoke code");
    },
  });

  const onGenerate = (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty < 1) return;
    generateMutation.mutate({
      quantity: qty,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
  };

  const copyAll = async () => {
    const text = freshCodes
      .filter((c) => c.code)
      .map((c) => claimUrl(c.code!))
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = () => {
    const rows = [
      ["code", "claim_url", "expires_at"],
      ...freshCodes
        .filter((c) => c.code)
        .map((c) => [c.code!, claimUrl(c.code!), c.expiresAt ?? ""]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `claim-codes-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const codes = codesQuery.data ?? [];

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Generate batch */}
      <Card>
        <CardHeader>
          <CardTitle>Generate claim codes</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onGenerate}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="w-full sm:w-32">
              <Label htmlFor="cc-qty">Quantity</Label>
              <Input
                id="cc-qty"
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="w-full sm:w-64">
              <Label htmlFor="cc-expires">Expires at (optional)</Label>
              <Input
                id="cc-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <Button type="submit" loading={generateMutation.isPending}>
              Generate
            </Button>
          </form>

          {freshCodes.length > 0 && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                New codes — shown only once. Copy or download them now.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copyAll}>
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy all URLs"}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadCsv}>
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </div>
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {freshCodes.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded bg-white px-3 py-2"
                  >
                    <code className="break-all font-mono text-xs text-slate-700">
                      {c.code}
                    </code>
                    {c.code && (
                      <button
                        type="button"
                        onClick={() => setQrCode(c.code!)}
                        className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                        aria-label="Show QR code"
                      >
                        <QrCodeIcon className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Codes table */}
      <Card>
        <CardHeader>
          <CardTitle>All codes</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {codesQuery.isLoading ? (
            <div className="space-y-2 px-5 pb-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : codes.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              No claim codes yet. Generate a batch above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="px-5 py-3">Code ID</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Expires</th>
                    <th className="px-5 py-3">Used</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">
                        {c.id}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {c.expiresAt ? formatDateTime(c.expiresAt) : "Never"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {c.usedAt ? formatDateTime(c.usedAt) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {c.code && (
                            <button
                              type="button"
                              onClick={() => setQrCode(c.code!)}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                              aria-label="Show QR code"
                            >
                              <QrCodeIcon className="h-4 w-4" />
                            </button>
                          )}
                          {c.status === "active" && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Revoke this claim code? This cannot be undone.")) {
                                  revokeMutation.mutate(c.id);
                                }
                              }}
                              disabled={revokeMutation.isPending}
                              className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              aria-label="Revoke code"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!qrCode} onClose={() => setQrCode(null)} title="Claim QR code">
        {qrCode && <QRCode value={claimUrl(qrCode)} filename={`claim-${qrCode}`} />}
      </Dialog>
    </div>
  );
}
