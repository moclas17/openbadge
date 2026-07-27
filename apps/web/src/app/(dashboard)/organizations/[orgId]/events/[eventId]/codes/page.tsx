"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { ClaimCodeTable } from "@/components/claim/ClaimCodeTable";

export default function ClaimCodesPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = use(params);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => (await api.events.get(eventId)).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/organizations/${orgId}/events/${eventId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Claim codes
          {eventQuery.data ? ` — ${eventQuery.data.title}` : ""}
        </h1>
      </div>

      <ClaimCodeTable eventId={eventId} />
    </div>
  );
}
