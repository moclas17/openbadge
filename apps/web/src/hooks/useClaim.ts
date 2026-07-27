"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type ClaimDetail, type ClaimStatus } from "@/lib/api";

const IN_PROGRESS_STATUSES: ClaimStatus[] = [
  "pending",
  "validated",
  "queued",
  "minting",
];

export function isClaimInProgress(status: ClaimStatus | undefined): boolean {
  return !!status && IN_PROGRESS_STATUSES.includes(status);
}

export function useCreateClaim() {
  return useMutation({
    mutationFn: async (input: { code: string; recipientWalletId: string }) => {
      const res = await api.claims.create(input);
      return res.data;
    },
  });
}

export function useClaimStatus(claimId: string | null | undefined) {
  return useQuery<ClaimDetail>({
    queryKey: ["claim", claimId],
    queryFn: async () => {
      const res = await api.claims.get(claimId!);
      return res.data;
    },
    enabled: !!claimId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || isClaimInProgress(status)) {
        return 3000;
      }
      return false;
    },
  });
}
