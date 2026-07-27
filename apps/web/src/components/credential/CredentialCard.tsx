import Link from "next/link";
import Image from "next/image";
import { Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { GalleryCredential } from "@/lib/api";

export function CredentialCard({ credential }: { credential: GalleryCredential }) {
  const eventTitle =
    credential.event?.title ?? credential.eventTitle ?? "Credential";
  const orgName =
    credential.event?.organization?.name ?? credential.organizationName ?? null;
  const imageUrl =
    credential.imageUrl ??
    credential.event?.artworkUrl ??
    credential.event?.artwork?.url ??
    null;
  const eventHref = credential.event?.slug
    ? `/events/${credential.event.slug}`
    : null;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full bg-indigo-50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={eventTitle}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Award className="h-16 w-16 text-indigo-300" aria-hidden />
          </div>
        )}
      </div>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">
              {eventHref ? (
                <Link href={eventHref} className="hover:text-indigo-600">
                  {eventTitle}
                </Link>
              ) : (
                eventTitle
              )}
            </h3>
            {orgName && (
              <p className="truncate text-sm text-slate-500">{orgName}</p>
            )}
          </div>
          <Badge variant={statusVariant("verified")}>Minted</Badge>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Minted {formatDate(credential.mintedAt)} · Token #{credential.tokenId}
        </p>
        <div className="mt-3 flex gap-3 text-xs">
          {eventHref && (
            <Link href={eventHref} className="text-indigo-600 hover:underline">
              View event
            </Link>
          )}
          <Link
            href={`/verify?chainId=${credential.chainId}&contractAddress=${credential.contractAddress}&tokenId=${credential.tokenId}`}
            className="text-indigo-600 hover:underline"
          >
            Verify
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
