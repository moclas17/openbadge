export interface IpfsConfig {
  apiUrl: string
  gatewayUrl: string
}

interface KuboAddResponse {
  Name: string
  Hash: string
  Size: string
}

export async function uploadMetadata(
  config: IpfsConfig,
  metadata: Record<string, unknown>,
): Promise<string> {
  const json = JSON.stringify(metadata)
  const content = Buffer.from(json, 'utf-8')
  return uploadFile(config, content, 'metadata.json')
}

export async function uploadFile(
  config: IpfsConfig,
  content: Buffer,
  filename: string,
): Promise<string> {
  const apiUrl = config.apiUrl.replace(/\/$/, '')
  const url = `${apiUrl}/api/v0/add`

  const formData = new FormData()
  const blob = new Blob([content])
  formData.append('file', blob, filename)

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`IPFS upload failed: ${response.status} ${response.statusText} — ${text}`)
  }

  const data = (await response.json()) as KuboAddResponse
  return `ipfs://${data.Hash}`
}

export function ipfsToGatewayUrl(ipfsUri: string, gatewayUrl: string): string {
  if (!ipfsUri.startsWith('ipfs://')) {
    throw new Error(`Invalid IPFS URI: ${ipfsUri}`)
  }
  const cid = ipfsUri.slice('ipfs://'.length)
  const base = gatewayUrl.replace(/\/$/, '')
  return `${base}/ipfs/${cid}`
}
