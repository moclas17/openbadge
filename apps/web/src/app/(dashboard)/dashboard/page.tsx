"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const orgsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => (await api.organizations.list()).data,
  });

  const orgs = orgsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your organizations</h1>
        <Link
          href="/organizations/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New organization
        </Link>
      </div>

      {orgsQuery.isError && (
        <Alert variant="error">Failed to load your organizations.</Alert>
      )}

      {orgsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : orgs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 font-medium text-slate-700">No organizations yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create an organization to start issuing credentials for your events.
          </p>
          <Link
            href="/organizations/new"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create organization
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Link key={org.id} href={`/organizations/${org.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Building2 className="h-5 w-5" aria-hidden />
                    </span>
                    {org.role && <Badge variant="muted">{org.role}</Badge>}
                  </div>
                  <h2 className="mt-3 truncate font-semibold text-slate-900">
                    {org.name}
                  </h2>
                  <p className="truncate text-sm text-slate-500">/{org.slug}</p>
                  {org.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {org.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
