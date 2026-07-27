"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Award, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { explorerTxUrl, formatDateTime } from "@/lib/utils";

export default function MyClaimsPage() {
  const claimsQuery = useQuery({
    queryKey: ["my-claims"],
    queryFn: async () => (await api.me.claims()).data,
    refetchInterval: (query) =>
      query.state.data?.some((c) =>
        ["pending", "validated", "queued", "minting"].includes(c.status),
      )
        ? 5000
        : false,
  });

  const claims = claimsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My claims</h1>

      {claimsQuery.isError && (
        <Alert variant="error">Failed to load your claims.</Alert>
      )}

      {claimsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : claims.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Award className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 font-medium text-slate-700">No claims yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Scan a claim QR code at an event to receive your first credential.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <Card key={claim.id}>
              <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold text-slate-900">
                      {claim.event?.title ?? "Event credential"}
                    </h2>
                    <Badge variant={statusVariant(claim.status)}>
                      {claim.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Claimed {formatDateTime(claim.createdAt)}
                    {claim.tokenId ? ` · Token #${claim.tokenId}` : ""}
                  </p>
                  {claim.status === "failed" && claim.failureReason && (
                    <p className="mt-1 text-sm text-red-600">
                      {claim.failureReason}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  {claim.event?.slug && (
                    <Link
                      href={`/events/${claim.event.slug}`}
                      className="text-indigo-600 hover:underline"
                    >
                      View event
                    </Link>
                  )}
                  {claim.transactionHash && (
                    <a
                      href={explorerTxUrl(
                        claim.chainId ?? claim.event?.chainId ?? 84532,
                        claim.transactionHash,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Transaction <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
