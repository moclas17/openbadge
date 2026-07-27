"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CHAINS = [
  { id: 8453, name: "Base" },
  { id: 84532, name: "Base Sepolia" },
];

export default function GalleryLookupPage() {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();

  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(84532);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const target = address.trim();
    if (!target) return;
    router.push(`/gallery/${chainId}/${encodeURIComponent(target)}`);
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Browse a credential gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm text-slate-600">
            Enter any wallet address to see the participation credentials it
            holds on Base.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="gallery-address">Wallet address</Label>
              <Input
                id="gallery-address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x…"
                className="font-mono"
              />
              {connectedAddress && (
                <button
                  type="button"
                  onClick={() => setAddress(connectedAddress)}
                  className="mt-1 text-xs text-indigo-600 hover:underline"
                >
                  Use my connected wallet
                </button>
              )}
            </div>
            <div>
              <Label htmlFor="gallery-chain">Chain</Label>
              <select
                id="gallery-chain"
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
            <Button type="submit" className="w-full">
              <Search className="h-4 w-4" />
              View gallery
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
