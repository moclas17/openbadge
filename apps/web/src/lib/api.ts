export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Pagination {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiEnvelope<T> {
  data: T;
  pagination?: Pagination;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

export type EventStatus =
  | "draft"
  | "published"
  | "paused"
  | "archived"
  | "completed";

export type ClaimStatus =
  | "pending"
  | "validated"
  | "queued"
  | "minting"
  | "completed"
  | "failed";

export type ClaimCodeStatus = "active" | "used" | "revoked" | "expired";

export type OrgRole = "owner" | "organizer" | "viewer";

export interface Media {
  id: string;
  url: string;
  mimeType?: string;
  purpose?: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

export interface Organization extends OrganizationSummary {
  description?: string | null;
  websiteUrl?: string | null;
  role?: OrgRole;
  createdAt: string;
  updatedAt?: string;
}

export interface OrganizationMember {
  id: string;
  walletAddress: string;
  role: OrgRole;
  displayName?: string | null;
  createdAt?: string;
}

export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: EventStatus;
  chainId: number;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  artworkUrl?: string | null;
  artwork?: Media | null;
  organization?: OrganizationSummary;
}

export interface EventDetail extends EventSummary {
  websiteUrl?: string | null;
  claimStartsAt?: string | null;
  claimEndsAt?: string | null;
  maximumClaims?: number | null;
  acceptedClaims?: number;
  visibility?: "public" | "unlisted" | "private";
  organizationId?: string;
  contractAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventStatistics {
  acceptedClaims: number;
  confirmedMints: number;
  availableClaimCodes: number;
  totalClaimCodes?: number;
  pendingClaims?: number;
  failedClaims?: number;
}

export interface ClaimCode {
  id: string;
  status: ClaimCodeStatus;
  code?: string | null; // plain code — only present right after generation
  expiresAt?: string | null;
  usedAt?: string | null;
  createdAt?: string;
}

export interface ClaimValidation {
  valid: boolean;
  event: EventDetail;
  claimCodeId?: string;
  reason?: string;
}

export interface ClaimDetail {
  id: string;
  status: ClaimStatus;
  event?: EventSummary;
  eventId?: string;
  recipientWalletId?: string;
  recipientWalletAddress?: string;
  chainId?: number;
  tokenId?: string | null;
  contractAddress?: string | null;
  transactionHash?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Wallet {
  id: string;
  chainNamespace: string;
  chainId: number;
  address: string;
  isPrimary?: boolean;
}

export interface User {
  id: string;
  displayName?: string | null;
  primaryWalletAddress?: string | null;
  wallets?: Wallet[];
  createdAt?: string;
}

export interface AuthChallenge {
  challengeId: string;
  message: string;
  expiresAt: string;
}

export interface SessionInfo {
  user: User;
  wallet?: Wallet;
  expiresAt?: string;
}

export interface GalleryCredential {
  id: string;
  tokenId: string;
  contractAddress: string;
  chainId: number;
  mintedAt?: string | null;
  imageUrl?: string | null;
  event?: EventSummary;
  eventTitle?: string;
  organizationName?: string;
}

export interface GalleryResponse {
  walletAddress: string;
  chainId: number;
  credentials: GalleryCredential[];
  indexedAt?: string | null;
  lastIndexedAt?: string | null;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationResult {
  verified: boolean;
  checks: VerificationCheck[];
  credential?: GalleryCredential;
}

export interface MediaUploadTicket {
  mediaId: string;
  uploadUrl: string;
}

/* ------------------------------------------------------------------ */
/* Fetch client                                                        */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const errBody = json as ApiErrorBody | null;
    if (errBody && typeof errBody === "object" && "error" in errBody) {
      throw new ApiError(
        errBody.error.code,
        errBody.error.message,
        errBody.error.status ?? res.status,
      );
    }
    throw new ApiError("unknown_error", `Request failed (${res.status})`, res.status);
  }

  return json as T;
}

/* ------------------------------------------------------------------ */
/* API surface                                                         */
/* ------------------------------------------------------------------ */

export const api = {
  auth: {
    createChallenge: (input: {
      chainNamespace: "eip155";
      chainId: number;
      walletAddress: string;
    }) =>
      apiRequest<ApiEnvelope<AuthChallenge>>("/auth/challenges", {
        method: "POST",
        body: input,
      }),
    verify: (input: { challengeId: string; signature: string }) =>
      apiRequest<ApiEnvelope<SessionInfo>>("/auth/verify", {
        method: "POST",
        body: input,
      }),
    session: () => apiRequest<ApiEnvelope<SessionInfo>>("/auth/session"),
    logout: () =>
      apiRequest<void>("/auth/session", {
        method: "DELETE",
      }),
  },

  me: {
    get: () => apiRequest<ApiEnvelope<User>>("/me"),
    claims: (params?: { cursor?: string }) => {
      const qs = params?.cursor ? `?cursor=${encodeURIComponent(params.cursor)}` : "";
      return apiRequest<ApiEnvelope<ClaimDetail[]>>(`/me/claims${qs}`);
    },
    wallets: () => apiRequest<ApiEnvelope<Wallet[]>>("/me/wallets"),
  },

  organizations: {
    list: () => apiRequest<ApiEnvelope<Organization[]>>("/organizations"),
    get: (idOrSlug: string) =>
      apiRequest<ApiEnvelope<Organization>>(
        `/organizations/${encodeURIComponent(idOrSlug)}`,
      ),
    create: (input: {
      name: string;
      slug: string;
      description?: string;
      websiteUrl?: string;
    }) =>
      apiRequest<ApiEnvelope<Organization>>("/organizations", {
        method: "POST",
        body: input,
      }),
    members: {
      list: (orgId: string) =>
        apiRequest<ApiEnvelope<OrganizationMember[]>>(
          `/organizations/${encodeURIComponent(orgId)}/members`,
        ),
      add: (orgId: string, input: { walletAddress: string; role: OrgRole }) =>
        apiRequest<ApiEnvelope<OrganizationMember>>(
          `/organizations/${encodeURIComponent(orgId)}/members`,
          { method: "POST", body: input },
        ),
      update: (orgId: string, memberId: string, input: { role: OrgRole }) =>
        apiRequest<ApiEnvelope<OrganizationMember>>(
          `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}`,
          { method: "PATCH", body: input },
        ),
      remove: (orgId: string, memberId: string) =>
        apiRequest<void>(
          `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}`,
          { method: "DELETE" },
        ),
    },
  },

  events: {
    list: (params?: {
      status?: EventStatus;
      organizationId?: string;
      cursor?: string;
      limit?: number;
    }) => {
      const search = new URLSearchParams();
      if (params?.status) search.set("status", params.status);
      if (params?.organizationId) search.set("organizationId", params.organizationId);
      if (params?.cursor) search.set("cursor", params.cursor);
      if (params?.limit) search.set("limit", String(params.limit));
      const qs = search.toString();
      return apiRequest<ApiEnvelope<EventSummary[]>>(
        `/events${qs ? `?${qs}` : ""}`,
      );
    },
    get: (idOrSlug: string) =>
      apiRequest<ApiEnvelope<EventDetail>>(
        `/events/${encodeURIComponent(idOrSlug)}`,
      ),
    create: (input: Record<string, unknown>) =>
      apiRequest<ApiEnvelope<EventDetail>>("/events", {
        method: "POST",
        body: input,
      }),
    update: (id: string, input: Record<string, unknown>) =>
      apiRequest<ApiEnvelope<EventDetail>>(`/events/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }),
    publish: (id: string) =>
      apiRequest<ApiEnvelope<EventDetail>>(
        `/events/${encodeURIComponent(id)}/publish`,
        { method: "POST" },
      ),
    pause: (id: string) =>
      apiRequest<ApiEnvelope<EventDetail>>(
        `/events/${encodeURIComponent(id)}/pause`,
        { method: "POST" },
      ),
    resume: (id: string) =>
      apiRequest<ApiEnvelope<EventDetail>>(
        `/events/${encodeURIComponent(id)}/resume`,
        { method: "POST" },
      ),
    archive: (id: string) =>
      apiRequest<ApiEnvelope<EventDetail>>(
        `/events/${encodeURIComponent(id)}/archive`,
        { method: "POST" },
      ),
    statistics: (id: string) =>
      apiRequest<ApiEnvelope<EventStatistics>>(
        `/events/${encodeURIComponent(id)}/statistics`,
      ),
  },

  claimCodes: {
    list: (eventId: string, params?: { cursor?: string }) => {
      const qs = params?.cursor ? `?cursor=${encodeURIComponent(params.cursor)}` : "";
      return apiRequest<ApiEnvelope<ClaimCode[]>>(
        `/events/${encodeURIComponent(eventId)}/claim-codes${qs}`,
      );
    },
    create: (
      eventId: string,
      input: { quantity: number; expiresAt?: string },
    ) =>
      apiRequest<ApiEnvelope<ClaimCode[]>>(
        `/events/${encodeURIComponent(eventId)}/claim-codes`,
        {
          method: "POST",
          body: input,
          headers: { "Idempotency-Key": crypto.randomUUID() },
        },
      ),
    revoke: (eventId: string, codeId: string) =>
      apiRequest<void>(
        `/events/${encodeURIComponent(eventId)}/claim-codes/${encodeURIComponent(codeId)}/revoke`,
        { method: "POST" },
      ),
  },

  claims: {
    validate: (code: string) =>
      apiRequest<ApiEnvelope<ClaimValidation>>("/claims/validate", {
        method: "POST",
        body: { code },
      }),
    create: (input: { code: string; recipientWalletId: string }) =>
      apiRequest<ApiEnvelope<ClaimDetail>>("/claims", {
        method: "POST",
        body: input,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    get: (id: string) =>
      apiRequest<ApiEnvelope<ClaimDetail>>(`/claims/${encodeURIComponent(id)}`),
  },

  galleries: {
    get: (chainId: number | string, walletAddress: string) =>
      apiRequest<ApiEnvelope<GalleryResponse>>(
        `/galleries/eip155/${chainId}/${encodeURIComponent(walletAddress)}`,
      ),
  },

  verification: {
    verifyCredential: (input: {
      chainId: number;
      contractAddress: string;
      tokenId: string;
      walletAddress: string;
    }) =>
      apiRequest<ApiEnvelope<VerificationResult>>("/verification/credentials", {
        method: "POST",
        body: input,
      }),
  },

  media: {
    createUpload: (input: {
      purpose: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    }) =>
      apiRequest<ApiEnvelope<MediaUploadTicket>>("/media/uploads", {
        method: "POST",
        body: input,
      }),
    complete: (mediaId: string) =>
      apiRequest<ApiEnvelope<Media>>(
        `/media/${encodeURIComponent(mediaId)}/complete`,
        { method: "POST" },
      ),
  },
};
