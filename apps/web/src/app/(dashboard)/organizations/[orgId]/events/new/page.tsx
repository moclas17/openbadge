"use client";

import { use } from "react";
import { EventForm } from "@/components/event/EventForm";

export default function NewEventPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);

  return (
    <div className="mx-auto max-w-3xl">
      <EventForm organizationId={orgId} />
    </div>
  );
}
