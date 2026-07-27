"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supportedChains } from "@/lib/wagmi";
import { truncateAddress } from "@/lib/utils";

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { isAuthenticated, isSessionLoading, login, isLoggingIn, loginError } =
    useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(next);
    }
  }, [isAuthenticated, next, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to OpenBadge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-slate-600">
          Connect your wallet and sign a message to prove ownership. No
          transaction is sent and no gas is required.
        </p>

        {loginError && <Alert variant="error">{loginError}</Alert>}

        {!isConnected || !address ? (
          <Button
            className="w-full"
            size="lg"
            loading={isConnecting}
            disabled={!connectors[0]}
            onClick={() => connectors[0] && connect({ connector: connectors[0] })}
          >
            <WalletIcon className="h-4 w-4" />
            Connect wallet
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-500">Connected as</span>
              <span className="font-mono text-sm text-slate-800">
                {truncateAddress(address)}
              </span>
            </div>
            <Button
              className="w-full"
              size="lg"
              loading={isLoggingIn || isSessionLoading}
              onClick={async () => {
                // SIWE must be signed on a supported chain: a wallet parked on
                // another network (e.g. localhost 31337) would otherwise create
                // a separate chain-scoped wallet identity and a fresh user.
                let signChainId = chainId;
                if (!supportedChains.some((c) => c.id === signChainId)) {
                  signChainId = supportedChains[0].id;
                  try {
                    await switchChainAsync({ chainId: signChainId });
                  } catch {
                    return;
                  }
                }
                login(address, signChainId!).catch(() => undefined);
              }}
            >
              Sign in with wallet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
