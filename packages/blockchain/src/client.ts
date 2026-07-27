import {
  createPublicClient as viemCreatePublicClient,
  createWalletClient as viemCreateWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChain } from './chains.js'

export type { PublicClient, WalletClient }

export function createPublicClient(chainId: number, rpcUrl: string): PublicClient {
  const chain = getChain(chainId)
  return viemCreatePublicClient({
    chain,
    transport: http(rpcUrl),
  })
}

export function createWalletClient(
  chainId: number,
  rpcUrl: string,
  privateKey: Hex,
): WalletClient {
  const chain = getChain(chainId)
  const account = privateKeyToAccount(privateKey)
  return viemCreateWalletClient({
    chain,
    transport: http(rpcUrl),
    account,
  })
}
