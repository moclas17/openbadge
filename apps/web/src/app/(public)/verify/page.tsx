"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VerifyApiResponse {
  data: {
    valid: boolean;
    reason: string | null;
    credential: { credentialId: string; status: string };
    checks: {
      contractRecognized: boolean;
      eventResolved: boolean;
      balancePositive: boolean;
      mintEventFound: boolean;
      canonicalBlock: boolean;
      metadataResolved: boolean;
    };
    verifiedAt: string;
  };
}

const CHECK_LABELS: Record<keyof VerifyApiResponse["data"]["checks"], string> = {
  contractRecognized: "Contract recognized by this installation",
  eventResolved: "Event resolved for this token",
  balancePositive: "Wallet holds a positive balance",
  mintEventFound: "Mint event found in the index",
  canonicalBlock: "Confirmed against the canonical chain",
  metadataResolved: "Metadata resolved",
};

const REASON_MESSAGES: Record<string, string> = {
  CONTRACT_NOT_RECOGNIZED: "This contract is not recognized by OpenBadge.",
  EVENT_NOT_RESOLVED: "No event could be resolved for this token.",
  CREDENTIAL_REVOKED: "This credential has been revoked by the issuer.",
  CREDENTIAL_BURNED: "This credential was burned and is no longer held.",
  WALLET_HAS_NO_BALANCE: "This wallet does not hold this credential.",
  BLOCKCHAIN_UNAVAILABLE:
    "The blockchain is currently unavailable and no indexed evidence exists.",
  METADATA_UNAVAILABLE:
    "The credential is valid, but its metadata is currently unavailable.",
};

const CHAINS = [
  { id: 8453, name: "Base" },
  { id: 84532, name: "Base Sepolia" },
];

function VerifyForm() {
  const searchParams = useSearchParams();

  const [chainId, setChainId] = useState(
    Number(searchParams.get("chainId")) || 84532,
  );
  const [contractAddress, setContractAddress] = useState(
    searchParams.get("contractAddress") ?? "",
  );
  const [tokenId, setTokenId] = useState(searchParams.get("tokenId") ?? "");
  const [walletAddress, setWalletAddress] = useState(
    searchParams.get("walletAddress") ?? "",
  );

  const verifyMutation = useMutation({
    mutationFn: () =>
      apiRequest<VerifyApiResponse>("/verification/credentials", {
        method: "POST",
        body: {
          chainNamespace: "eip155",
          chainId,
          contractAddress: contractAddress.trim(),
          tokenId: tokenId.trim(),
          walletAddress: walletAddress.trim(),
        },
      }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    verifyMutation.mutate();
  };

  const result = verifyMutation.data?.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden />
            Verify a credential
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm text-slate-600">
            Check the authenticity and current ownership of any OpenBadge
            credential directly against the blockchain.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="verify-chain">Chain</Label>
                <select
                  id="verify-chain"
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="verify-token">Token ID</Label>
                <Input
                  id="verify-token"
                  required
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="verify-contract">Contract address</Label>
              <Input
                id="verify-contract"
                required
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x…"
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="verify-wallet">Wallet address</Label>
              <Input
                id="verify-wallet"
                required
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x…"
                className="font-mono"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              loading={verifyMutation.isPending}
            >
              Verify credential
            </Button>
          </form>
        </CardContent>
      </Card>

      {verifyMutation.isError && (
        <Alert variant="error">
          {verifyMutation.error instanceof ApiError
            ? verifyMutation.error.message
            : "Verification request failed."}
        </Alert>
      )}

      {result && (
        <Card>
          <CardContent className="pt-5">
            {result.valid ? (
              <Alert variant="success" title="Credential is valid">
                This wallet holds an authentic OpenBadge credential.
                {result.reason && (
                  <span className="mt-1 block">
                    {REASON_MESSAGES[result.reason] ?? result.reason}
                  </span>
                )}
              </Alert>
            ) : (
              <Alert variant="error" title="Credential is not valid">
                {result.reason
                  ? (REASON_MESSAGES[result.reason] ?? result.reason)
                  : "This credential could not be verified."}
              </Alert>
            )}

            <ul className="mt-5 space-y-2">
              {(
                Object.keys(CHECK_LABELS) as Array<
                  keyof VerifyApiResponse["data"]["checks"]
                >
              ).map((key) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  {result.checks[key] ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                  ) : (
                    <XCircle
                      className="h-4 w-4 shrink-0 text-red-400"
                      aria-hidden
                    />
                  )}
                  <span
                    className={
                      result.checks[key] ? "text-slate-700" : "text-slate-400"
                    }
                  >
                    {CHECK_LABELS[key]}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 break-all font-mono text-xs text-slate-400">
              {result.credential.credentialId}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
