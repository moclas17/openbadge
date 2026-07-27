import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { EventSummary } from "@/lib/api";

export function EventCard({
  event,
  href,
}: {
  event: EventSummary;
  href?: string;
}) {
  const link = href ?? `/events/${event.slug}`;
  const imageUrl = event.artworkUrl ?? event.artwork?.url ?? null;

  return (
    <Link href={link} className="group block">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/3] w-full bg-indigo-50">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={event.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Ticket className="h-12 w-12 text-indigo-300" aria-hidden />
            </div>
          )}
          <div className="absolute right-3 top-3">
            <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
          </div>
        </div>
        <CardContent>
          <h3 className="line-clamp-1 font-semibold text-slate-900 group-hover:text-indigo-600">
            {event.title}
          </h3>
          {event.organization && (
            <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
              {event.organization.name}
            </p>
          )}
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            {event.startsAt && (
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {formatDate(event.startsAt)}
                {event.endsAt ? ` – ${formatDate(event.endsAt)}` : ""}
              </p>
            )}
            {event.location && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                <span className="line-clamp-1">{event.location}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
