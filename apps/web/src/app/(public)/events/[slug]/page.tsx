import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Globe, MapPin, Ticket, Users } from "lucide-react";
import {
  API_URL,
  type ApiEnvelope,
  type EventDetail,
  type EventStatistics,
} from "@/lib/api";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/utils";
import { chainName } from "@/lib/wagmi";

async function getEvent(slug: string): Promise<EventDetail | null> {
  try {
    const res = await fetch(`${API_URL}/events/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<EventDetail>;
    return json.data;
  } catch {
    return null;
  }
}

async function getStatistics(id: string): Promise<EventStatistics | null> {
  try {
    const res = await fetch(
      `${API_URL}/events/${encodeURIComponent(id)}/statistics`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<EventStatistics>;
    return json.data;
  } catch {
    return null;
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const stats = await getStatistics(event.id);
  const imageUrl = event.artworkUrl ?? event.artwork?.url ?? null;
  const accepted = stats?.acceptedClaims ?? event.acceptedClaims ?? 0;

  const now = new Date();
  const claimOpen =
    (!event.claimStartsAt || new Date(event.claimStartsAt) <= now) &&
    (!event.claimEndsAt || new Date(event.claimEndsAt) >= now);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
          <Badge variant="muted">{chainName(event.chainId)}</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{event.title}</h1>
        {event.organization && (
          <p className="mt-1 text-slate-500">
            Hosted by{" "}
            <span className="font-medium text-slate-700">
              {event.organization.name}
            </span>
          </p>
        )}

        {event.description && (
          <p className="mt-6 whitespace-pre-line text-slate-700">
            {event.description}
          </p>
        )}

        <div className="mt-8 space-y-3 text-sm text-slate-600">
          {(event.startsAt || event.endsAt) && (
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
              {formatDate(event.startsAt)}
              {event.endsAt ? ` – ${formatDate(event.endsAt)}` : ""}
            </p>
          )}
          {event.location && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
              {event.location}
            </p>
          )}
          {event.websiteUrl && (
            <p className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-400" aria-hidden />
              <a
                href={event.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {event.websiteUrl}
              </a>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="relative aspect-square w-full bg-indigo-50">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={event.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 33vw"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Ticket className="h-16 w-16 text-indigo-300" aria-hidden />
              </div>
            )}
          </div>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-500">
                <Users className="h-4 w-4" aria-hidden />
                Claimed
              </span>
              <span className="font-semibold text-slate-900">
                {accepted}
                {event.maximumClaims ? ` / ${event.maximumClaims}` : ""}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-700">Claim window</p>
              <p className="mt-1 text-slate-500">
                {event.claimStartsAt
                  ? `Opens ${formatDateTime(event.claimStartsAt)}`
                  : "Open now"}
                {event.claimEndsAt
                  ? ` · closes ${formatDateTime(event.claimEndsAt)}`
                  : ""}
              </p>
              <p
                className={
                  claimOpen
                    ? "mt-2 font-medium text-emerald-600"
                    : "mt-2 font-medium text-amber-600"
                }
              >
                {claimOpen ? "Claims are open" : "Claims are currently closed"}
              </p>
            </div>

            <p className="text-xs text-slate-400">
              Have a claim code or QR? Scan it or open your claim link to receive
              this credential.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
