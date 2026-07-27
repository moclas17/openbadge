import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const chains = [base, baseSepolia] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

export const supportedChains = [
  { id: baseSepolia.id, name: "Base Sepolia" },
  { id: base.id, name: "Base" },
] as const;

export function chainName(chainId: number): string {
  const found = supportedChains.find((c) => c.id === chainId);
  return found?.name ?? `Chain ${chainId}`;
}

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
