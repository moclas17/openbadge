"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useConnect } from "wagmi";
import {
  Award,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PartyPopper,
  Ticket,
  Wallet as WalletIcon,
} from "lucide-react";
import {
  api,
  ApiError,
  type ClaimValidation,
  type Wallet,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useClaimStatus, useCreateClaim, isClaimInProgress } from "@/hooks/useClaim";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CredentialStatus } from "@/components/credential/CredentialStatus";
import { chainName } from "@/lib/wagmi";
import { explorerTxUrl, formatDate, truncateAddress } from "@/lib/utils";

export function ClaimFlow({ code }: { code: string }) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const {
    isAuthenticated,
    isSessionLoading,
    login,
    isLoggingIn,
    loginError,
  } = useAuth();

  const [claimId, setClaimId] = useState<string | null>(null);

  /* 1. Validate the code */
  const validation = useQuery<ClaimValidation, Error>({
    queryKey: ["claim-validate", code],
    queryFn: async () => (await api.claims.validate(code)).data,
    retry: false,
  });

  /* Resolve the recipient wallet id once authenticated */
  const wallets = useQuery<Wallet[]>({
    queryKey: ["me-wallets"],
    queryFn: async () => (await api.me.wallets()).data,
    enabled: isAuthenticated,
  });

  const recipientWallet = useMemo(() => {
    const list = wallets.data ?? [];
    if (!list.length) return null;
    if (address) {
      const match = list.find(
        (w) => w.address.toLowerCase() === address.toLowerCase(),
      );
      if (match) return match;
    }
    return list.find((w) => w.isPrimary) ?? list[0];
  }, [wallets.data, address]);

  /* 3. Submit the claim */
  const createClaim = useCreateClaim();
  const claimStatus = useClaimStatus(claimId);

  useEffect(() => {
    if (createClaim.data?.id) setClaimId(createClaim.data.id);
  }, [createClaim.data]);

  /* ---------------- render states ---------------- */

  if (validation.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-xl" />
        <Skeleton className="mx-auto h-6 w-2/3" />
        <Skeleton className="mx-auto h-4 w-1/2" />
      </div>
    );
  }

  if (validation.isError || !validation.data?.valid) {
    const message =
      validation.error instanceof ApiError
        ? validation.error.message
        : validation.data?.reason ?? "This claim code is invalid, expired, or already used.";
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Ticket className="mx-auto h-12 w-12 text-slate-300" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold text-slate-900">
            This code can&apos;t be claimed
          </h2>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            Browse events
          </Link>
        </CardContent>
      </Card>
    );
  }

  const event = validation.data.event;
  const imageUrl = event.artworkUrl ?? event.artwork?.url ?? null;

  /* Success state */
  const finalStatus = claimStatus.data?.status ?? createClaim.data?.status;
  const isDone = finalStatus === "completed";
  const galleryChainId = claimStatus.data?.chainId ?? event.chainId;

  return (
    <div className="space-y-6">
      {/* Event card */}
      <Card className="overflow-hidden">
        <div className="relative aspect-square w-full bg-indigo-50 sm:aspect-[2/1]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={event.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 640px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Award className="h-16 w-16 text-indigo-300" aria-hidden />
            </div>
          )}
        </div>
        <CardContent className="text-center">
          <Badge variant="muted">{chainName(event.chainId)}</Badge>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{event.title}</h1>
          {event.organization && (
            <p className="mt-1 text-sm text-slate-500">
              by {event.organization.name}
            </p>
          )}
          {event.startsAt && (
            <p className="mt-1 text-xs text-slate-400">
              {formatDate(event.startsAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Flow */}
      {claimId || createClaim.data ? (
        <Card>
          <CardContent className="py-6">
            {isDone ? (
              <div className="text-center">
                <PartyPopper className="mx-auto h-12 w-12 text-indigo-500" aria-hidden />
                <h2 className="mt-3 text-xl font-bold text-slate-900">
                  Credential claimed!
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your credential has been minted to your wallet.
                </p>
                {claimStatus.data?.transactionHash && (
                  <a
                    href={explorerTxUrl(
                      galleryChainId,
                      claimStatus.data.transactionHash,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                  >
                    View transaction <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {address && (
                  <div className="mt-6">
                    <Link
                      href={`/gallery/${galleryChainId}/${address}`}
                      className="inline-flex h-12 items-center gap-2 rounded-lg bg-indigo-600 px-6 font-medium text-white hover:bg-indigo-700"
                    >
                      View my gallery
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="mb-6 text-center text-lg font-semibold text-slate-900">
                  {finalStatus === "failed"
                    ? "Something went wrong"
                    : "Minting your credential…"}
                </h2>
                <CredentialStatus
                  status={finalStatus ?? "pending"}
                  failureReason={claimStatus.data?.failureReason}
                />
                {isClaimInProgress(finalStatus) && (
                  <p className="mt-6 text-center text-xs text-slate-400">
                    This usually takes under a minute. You can keep this page open.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-6">
            <ol className="space-y-4">
              {/* Step 1: connect */}
              <li className="flex items-center gap-3">
                {isConnected ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    1
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">Connect your wallet</p>
                  {isConnected && address && (
                    <p className="font-mono text-xs text-slate-500">
                      {truncateAddress(address)}
                    </p>
                  )}
                </div>
                {!isConnected && (
                  <Button
                    size="sm"
                    onClick={() =>
                      connectors[0] && connect({ connector: connectors[0] })
                    }
                    loading={isConnecting}
                  >
                    <WalletIcon className="h-4 w-4" />
                    Connect
                  </Button>
                )}
              </li>

              {/* Step 2: sign in */}
              <li className="flex items-center gap-3">
                {isAuthenticated ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    2
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">Sign in</p>
                  <p className="text-xs text-slate-500">
                    Sign a message to prove wallet ownership. No gas needed.
                  </p>
                </div>
                {isConnected && !isAuthenticated && (
                  <Button
                    size="sm"
                    onClick={() =>
                      address &&
                      login(address, chainId ?? event.chainId).catch(() => undefined)
                    }
                    loading={isLoggingIn || isSessionLoading}
                  >
                    Sign in
                  </Button>
                )}
              </li>

              {/* Step 3: claim */}
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">Claim your credential</p>
                </div>
              </li>
            </ol>

            {loginError && <Alert variant="error">{loginError}</Alert>}
            {createClaim.isError && (
              <Alert variant="error">
                {createClaim.error instanceof ApiError
                  ? createClaim.error.message
                  : "Failed to submit claim. Please try again."}
              </Alert>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!isAuthenticated || !recipientWallet}
              loading={createClaim.isPending || (isAuthenticated && wallets.isLoading)}
              onClick={() => {
                if (!recipientWallet) return;
                createClaim.mutate({
                  code,
                  recipientWalletId: recipientWallet.id,
                });
              }}
            >
              {createClaim.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Claiming…
                </>
              ) : (
                "Claim credential"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
