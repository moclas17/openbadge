import { baseSepolia, base } from 'viem/chains'
import type { Chain } from 'viem'

export { baseSepolia, base as baseMainnet }

const SUPPORTED_CHAINS: Record<number, Chain> = {
  [baseSepolia.id]: baseSepolia,
  [base.id]: base,
}

export function getChain(chainId: number): Chain {
  const chain = SUPPORTED_CHAINS[chainId]
  if (chain === undefined) {
    throw new Error(
      `Unsupported chainId: ${chainId}. Supported chains: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`,
    )
  }
  return chain
}
