"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ChevronDown, LogOut, Wallet as WalletIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { truncateAddress } from "@/lib/utils";

export function ConnectButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    isAuthenticated,
    isSessionLoading,
    login,
    isLoggingIn,
    logout,
    isLoggingOut,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!mounted || isSessionLoading) {
    return (
      <Button variant="outline" disabled>
        <WalletIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Wallet</span>
      </Button>
    );
  }

  if (!isConnected || !address) {
    const connector = connectors[0];
    return (
      <Button
        onClick={() => connector && connect({ connector })}
        loading={isConnecting}
        disabled={!connector}
      >
        <WalletIcon className="h-4 w-4" />
        Connect wallet
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600 sm:inline">
          {truncateAddress(address)}
        </span>
        <Button
          onClick={() => login(address, chainId ?? 8453).catch(() => undefined)}
          loading={isLoggingIn}
        >
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="outline" onClick={() => setMenuOpen((v) => !v)}>
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        <span className="font-mono text-xs">{truncateAddress(address)}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      {menuOpen && (
        <div className="absolute right-0 z-40 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setMenuOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/me/claims"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setMenuOpen(false)}
          >
            My claims
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            disabled={isLoggingOut}
            onClick={() => {
              logout();
              disconnect();
              setMenuOpen(false);
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
