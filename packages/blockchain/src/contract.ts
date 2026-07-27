import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
  decodeEventLog,
} from 'viem'
import { OPEN_BADGE_ABI } from './abi.js'

export interface BadgeInfo {
  metadataUri: string
  maxSupply: bigint
  totalMinted: bigint
  metadataFrozen: boolean
}

export async function getBadgeInfo(
  client: PublicClient,
  contractAddress: Address,
  tokenId: bigint,
): Promise<BadgeInfo> {
  const result = await client.readContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'badgeInfo',
    args: [tokenId],
  })
  const [metadataUri, maxSupply, totalMinted, metadataFrozen] = result as [
    string,
    bigint,
    bigint,
    boolean,
  ]
  return { metadataUri, maxSupply, totalMinted, metadataFrozen }
}

export async function badgeExists(
  client: PublicClient,
  contractAddress: Address,
  tokenId: bigint,
): Promise<boolean> {
  return client.readContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'exists',
    args: [tokenId],
  }) as Promise<boolean>
}

export async function wasIssued(
  client: PublicClient,
  contractAddress: Address,
  account: Address,
  tokenId: bigint,
): Promise<boolean> {
  return client.readContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'wasIssued',
    args: [account, tokenId],
  }) as Promise<boolean>
}

export async function getBalance(
  client: PublicClient,
  contractAddress: Address,
  account: Address,
  tokenId: bigint,
): Promise<bigint> {
  return client.readContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'balanceOf',
    args: [account, tokenId],
  }) as Promise<bigint>
}

export async function mintCredential(
  walletClient: WalletClient,
  publicClient: PublicClient,
  contractAddress: Address,
  recipient: Address,
  tokenId: bigint,
): Promise<Hash> {
  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'mint',
    args: [recipient, tokenId],
    account: walletClient.account,
  })
  return walletClient.writeContract(request)
}

export async function mintToRecipients(
  walletClient: WalletClient,
  publicClient: PublicClient,
  contractAddress: Address,
  recipients: Address[],
  tokenId: bigint,
): Promise<Hash> {
  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'mintToRecipients',
    args: [recipients, tokenId],
    account: walletClient.account,
  })
  return walletClient.writeContract(request)
}

export async function createBadge(
  walletClient: WalletClient,
  publicClient: PublicClient,
  contractAddress: Address,
  metadataUri: string,
  maxSupply: bigint,
): Promise<{ hash: Hash; tokenId: bigint }> {
  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'createBadge',
    args: [metadataUri, maxSupply],
    account: walletClient.account,
  })
  const hash = await walletClient.writeContract(request)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  let tokenId = 0n
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: OPEN_BADGE_ABI,
        data: log.data,
        topics: log.topics,
        eventName: 'BadgeCreated',
      })
      tokenId = decoded.args.tokenId
      break
    } catch {
      // not a BadgeCreated log, continue
    }
  }

  return { hash, tokenId }
}

export async function freezeMetadata(
  walletClient: WalletClient,
  publicClient: PublicClient,
  contractAddress: Address,
  tokenId: bigint,
): Promise<Hash> {
  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi: OPEN_BADGE_ABI,
    functionName: 'freezeMetadata',
    args: [tokenId],
    account: walletClient.account,
  })
  return walletClient.writeContract(request)
}
