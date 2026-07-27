"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ExternalLink, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);

  const orgQuery = useQuery({
    queryKey: ["organization", orgId],
    queryFn: async () => (await api.organizations.get(orgId)).data,
  });

  const eventsQuery = useQuery({
    queryKey: ["org-events", orgId],
    queryFn: async () =>
      (await api.events.list({ organizationId: orgId })).data,
  });

  const org = orgQuery.data;
  const events = eventsQuery.data ?? [];

  if (orgQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (orgQuery.isError || !org) {
    return <Alert variant="error">Organization not found.</Alert>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
          <p className="text-sm text-slate-500">/{org.slug}</p>
          {org.description && (
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {org.description}
            </p>
          )}
          {org.websiteUrl && (
            <a
              href={org.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
            >
              {org.websiteUrl} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/organizations/${orgId}/members`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Users className="h-4 w-4" />
            Members
          </Link>
          <Link
            href={`/organizations/${orgId}/events/new`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <CalendarPlus className="h-4 w-4" />
            New event
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Events</h2>
        {eventsQuery.isError && (
          <Alert variant="error">Failed to load events.</Alert>
        )}
        {eventsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-medium text-slate-700">No events yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create an event to start issuing participation credentials.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/organizations/${orgId}/events/${event.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3 pt-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold text-slate-900">
                          {event.title}
                        </h3>
                        <Badge variant={statusVariant(event.status)}>
                          {event.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {event.startsAt
                          ? formatDate(event.startsAt)
                          : "No date set"}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
