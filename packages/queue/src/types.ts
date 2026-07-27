export interface MintJobData {
  claimId: string
  mintOperationId: string
  contractAddress: string
  chainId: number
  tokenId: string
  recipientAddress: string
  attempt: number
}

export interface MetadataJobData {
  eventId: string
  metadataJson: Record<string, unknown>
}

export interface ExportJobData {
  eventId: string
  requestedByUserId: string
  filters?: {
    status?: string
  }
}

export interface ReconcileJobData {
  type: 'claim' | 'mint_operation' | 'full'
  entityId?: string
}
