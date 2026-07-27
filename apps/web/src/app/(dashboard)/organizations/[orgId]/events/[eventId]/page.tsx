"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ExternalLink,
  Pause,
  Play,
  QrCode,
  Rocket,
} from "lucide-react";
import {
  api,
  apiRequest,
  ApiError,
  type ApiEnvelope,
  type EventDetail,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventForm } from "@/components/event/EventForm";

function publishEvent(eventId: string) {
  return apiRequest<ApiEnvelope<EventDetail>>(
    `/events/${encodeURIComponent(eventId)}/publish`,
    {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {},
    },
  );
}

export default function ManageEventPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = use(params);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => (await api.events.get(eventId)).data,
  });

  const statsQuery = useQuery({
    queryKey: ["event-statistics", eventId],
    queryFn: async () => (await api.events.statistics(eventId)).data,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    void queryClient.invalidateQueries({ queryKey: ["event-statistics", eventId] });
  };

  const onError = (err: unknown) => {
    setError(err instanceof ApiError ? err.message : "Action failed");
  };

  const publishMutation = useMutation({
    mutationFn: () => publishEvent(eventId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError,
  });
  const pauseMutation = useMutation({
    mutationFn: () => api.events.pause(eventId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError,
  });
  const resumeMutation = useMutation({
    mutationFn: () => api.events.resume(eventId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError,
  });
  const archiveMutation = useMutation({
    mutationFn: () => api.events.archive(eventId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError,
  });

  const event = eventQuery.data;
  const stats = statsQuery.data;

  if (eventQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (eventQuery.isError || !event) {
    return <Alert variant="error">Event not found.</Alert>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold text-slate-900">
              {event.title}
            </h1>
            <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
          </div>
          {event.status === "published" && (
            <Link
              href={`/events/${event.slug}`}
              className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
            >
              View public page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/organizations/${orgId}/events/${eventId}/codes`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <QrCode className="h-4 w-4" />
            Claim codes
          </Link>
          {event.status === "draft" && (
            <Button
              onClick={() => publishMutation.mutate()}
              loading={publishMutation.isPending}
            >
              <Rocket className="h-4 w-4" />
              Publish
            </Button>
          )}
          {event.status === "published" && (
            <Button
              variant="outline"
              onClick={() => pauseMutation.mutate()}
              loading={pauseMutation.isPending}
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          {event.status === "paused" && (
            <Button
              onClick={() => resumeMutation.mutate()}
              loading={resumeMutation.isPending}
            >
              <Play className="h-4 w-4" />
              Resume
            </Button>
          )}
          {event.status !== "archived" && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm("Archive this event? Claims will be closed.")) {
                  archiveMutation.mutate();
                }
              }}
              loading={archiveMutation.isPending}
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : stats ? (
            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Accepted claims", value: stats.acceptedClaims },
                { label: "Confirmed mints", value: stats.confirmedMints },
                {
                  label: "Available claim codes",
                  value: stats.availableClaimCodes,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Statistics unavailable.</p>
          )}
        </CardContent>
      </Card>

      <EventForm organizationId={orgId} event={event} />
    </div>
  );
}
