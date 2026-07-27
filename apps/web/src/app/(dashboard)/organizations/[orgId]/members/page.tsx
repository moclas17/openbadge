"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { api, ApiError, type OrgRole } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils";

const ROLES: OrgRole[] = ["viewer", "organizer", "owner"];

const selectClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

export default function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const queryClient = useQueryClient();

  const [walletAddress, setWalletAddress] = useState("");
  const [role, setRole] = useState<OrgRole>("viewer");
  const [error, setError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: async () => (await api.organizations.members.list(orgId)).data,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });

  const onError = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Action failed");

  const addMutation = useMutation({
    mutationFn: (input: { walletAddress: string; role: OrgRole }) =>
      api.organizations.members.add(orgId, input),
    onSuccess: () => {
      setError(null);
      setWalletAddress("");
      invalidate();
    },
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      api.organizations.members.update(orgId, memberId, { role }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.organizations.members.remove(orgId, memberId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError,
  });

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!walletAddress) return;
    addMutation.mutate({ walletAddress, role });
  };

  const members = membersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/organizations/${orgId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organization
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Members</h1>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Add member</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onAdd}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <Label htmlFor="member-address">Wallet address</Label>
              <Input
                id="member-address"
                required
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value.trim())}
                placeholder="0x…"
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="member-role">Role</Label>
              <select
                id="member-role"
                value={role}
                onChange={(e) => setRole(e.target.value as OrgRole)}
                className={`${selectClass} w-full sm:w-40`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" loading={addMutation.isPending}>
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All members</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {membersQuery.isLoading ? (
            <div className="space-y-2 px-5 pb-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No members yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="px-5 py-3">Member</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">
                          {member.displayName ?? "Unnamed"}
                        </p>
                        <p className="font-mono text-xs text-slate-500">
                          {truncateAddress(member.walletAddress)}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateMutation.mutate({
                                memberId: member.id,
                                role: e.target.value as OrgRole,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className={selectClass}
                            aria-label="Member role"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          {member.role === "owner" && (
                            <Badge variant="default">owner</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Remove this member?")) {
                                removeMutation.mutate(member.id);
                              }
                            }}
                            disabled={removeMutation.isPending}
                            className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            aria-label="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
