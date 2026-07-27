"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award } from "lucide-react";
import { apiRequest, type GalleryCredential, type Pagination } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CredentialCard } from "@/components/credential/CredentialCard";
import { formatDateTime, truncateAddress } from "@/lib/utils";

interface GalleryApiResponse {
  data: {
    wallet: { chainNamespace: string; chainId: string; address: string };
    credentials: Array<{
      credentialId: string;
      event: { id: string; title: string; artworkUrl: string | null };
      organization: { id: string; name: string; slug: string };
      mintedAt: string | null;
      status: "valid" | "revoked";
    }>;
  };
  pagination: Pagination;
  index?: {
    lastSyncedBlock: string | null;
    lastSyncedAt: string | null;
  };
}

function toCardCredential(
  credential: GalleryApiResponse["data"]["credentials"][number],
  chainId: number,
): GalleryCredential {
  // credentialId format: eip155:{chainId}:{contract}:{tokenId}:{wallet}
  const parts = credential.credentialId.split(":");
  return {
    id: credential.credentialId,
    tokenId: parts[3] ?? "0",
    contractAddress: parts[2] ?? "",
    chainId,
    mintedAt: credential.mintedAt,
    imageUrl: credential.event.artworkUrl,
    eventTitle: credential.event.title,
    organizationName: credential.organization.name,
  };
}

export default function GalleryPage({
  params,
}: {
  params: Promise<{ chainId: string; address: string }>;
}) {
  const { chainId, address } = use(params);
  const numericChainId = Number(chainId);

  const galleryQuery = useQuery({
    queryKey: ["gallery", chainId, address],
    queryFn: () =>
      apiRequest<GalleryApiResponse>(
        `/galleries/eip155/${encodeURIComponent(chainId)}/${encodeURIComponent(address)}`,
      ),
  });

  const gallery = galleryQuery.data;
  const credentials = gallery?.data.credentials ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Look up another wallet
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Gallery of{" "}
          <span className="font-mono text-xl">{truncateAddress(address)}</span>
        </h1>
        {gallery?.index?.lastSyncedAt && (
          <p className="mt-1 text-xs text-slate-400">
            Index last synced {formatDateTime(gallery.index.lastSyncedAt)}
            {gallery.index.lastSyncedBlock
              ? ` (block ${gallery.index.lastSyncedBlock})`
              : ""}
          </p>
        )}
      </div>

      {galleryQuery.isError && (
        <Alert variant="error">Failed to load this gallery.</Alert>
      )}

      {galleryQuery.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Award className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 font-medium text-slate-700">No credentials found</p>
          <p className="mt-1 text-sm text-slate-500">
            This wallet holds no OpenBadge credentials on this chain yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {credentials.map((credential) => (
            <div key={credential.credentialId} className="relative">
              {credential.status === "revoked" && (
                <Badge
                  variant={statusVariant("revoked")}
                  className="absolute right-3 top-3 z-10"
                >
                  Revoked
                </Badge>
              )}
              <CredentialCard
                credential={toCardCredential(credential, numericChainId)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
