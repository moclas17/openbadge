# OpenBadge API Design

**Version:** 1.0  
**Status:** Draft  
**Base path:** `/api/v1`

---

# 1. Purpose

This document defines the public HTTP API for OpenBadge Version One.

The API is the contract between:

- Frontend applications.
- Self-hosted OpenBadge installations.
- Background workers.
- External integrations.
- Administrative tools.
- Future SDKs.

The API exposes business capabilities, not database tables.

A `Credential` is returned as a composed read model built from application data, indexed blockchain events, metadata and canonical blockchain state. It is not a primary PostgreSQL entity.

---

# 2. API Principles

## 2.1 REST and JSON

The Version One API uses:

- HTTPS.
- REST-style resources.
- JSON request and response bodies.
- UTF-8 encoding.
- ISO 8601 timestamps in UTC.

Example timestamp:

```text
2026-07-19T18:30:00Z
```

## 2.2 API First

Every core action available in the official frontend must also be available through the API.

The frontend must not depend on undocumented private endpoints.

## 2.3 Stable Resource Names

API resource names must use domain language consistently:

- `organizations`
- `events`
- `claim-codes`
- `claims`
- `mint-operations`
- `credentials`
- `galleries`
- `wallets`
- `media`

Avoid exposing internal implementation names such as:

- jobs
- database rows
- token tables
- indexer tables

unless the endpoint is explicitly administrative.

## 2.4 Blockchain Independence

Business endpoints must not require callers to understand contract implementation details unless those details are necessary for verification.

## 2.5 Asynchronous Minting

Claim creation and blockchain minting are separate operations.

A successful claim request does not mean the credential has already been minted.

The API must return the claim state immediately and expose mint progress separately.

---

# 3. Base URL and Versioning

Example production URL:

```text
https://openbadge.example.com/api/v1
```

Self-hosted installations may use any domain.

All Version One endpoints begin with:

```text
/api/v1
```

Breaking changes require a new major API version.

Example:

```text
/api/v2
```

Non-breaking additions may be introduced without changing the version.

Examples of non-breaking changes:

- Adding optional response fields.
- Adding new endpoints.
- Adding new error metadata.
- Adding optional filters.

The API must not silently change the meaning of an existing field.

---

# 4. Content Types

Requests with JSON bodies must include:

```http
Content-Type: application/json
```

Clients should send:

```http
Accept: application/json
```

Successful JSON responses use:

```http
Content-Type: application/json; charset=utf-8
```

Media upload endpoints may use:

```http
multipart/form-data
```

or signed direct-upload URLs.

---

# 5. Authentication

Version One uses wallet-signature authentication.

The recommended EVM authentication format is compatible with Sign-In with Ethereum principles.

## 5.1 Authentication Flow

```text
Request challenge
        ↓
Sign challenge with wallet
        ↓
Verify signature
        ↓
Create authenticated session
        ↓
Use session cookie or bearer token
```

## 5.2 Request Authentication Challenge

```http
POST /api/v1/auth/challenges
```

### Request

```json
{
  "chainNamespace": "eip155",
  "chainId": "8453",
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### Response

```json
{
  "data": {
    "challengeId": "ach_01JZ8YQ8C1S9KM5X2PZ4H2A6KM",
    "message": "openbadge.example.com wants you to sign in with your Ethereum account...",
    "expiresAt": "2026-07-19T18:35:00Z"
  }
}
```

### Rules

- The challenge must be random.
- The challenge must expire.
- The challenge must be single use.
- The message must identify the domain.
- The message must identify the requested wallet.
- The message must identify the chain.
- The message must include an issued time.
- The message must prevent replay across domains.

## 5.3 Verify Signature

```http
POST /api/v1/auth/verify
```

### Request

```json
{
  "challengeId": "ach_01JZ8YQ8C1S9KM5X2PZ4H2A6KM",
  "signature": "0x..."
}
```

### Response

```json
{
  "data": {
    "user": {
      "id": "usr_01JZ8Z3R7S6M7F1EJ8NJP5Z6VM",
      "displayName": null,
      "status": "active"
    },
    "wallet": {
      "id": "wal_01JZ8Z4ET7NAFZ9Q1QMC6D4M13",
      "chainNamespace": "eip155",
      "chainId": "8453",
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "verifiedAt": "2026-07-19T18:31:00Z"
    },
    "session": {
      "expiresAt": "2026-07-26T18:31:00Z"
    }
  }
}
```

## 5.4 Current Session

```http
GET /api/v1/auth/session
```

Returns the current authenticated User, Wallet and effective permissions.

## 5.5 End Session

```http
DELETE /api/v1/auth/session
```

Returns:

```http
204 No Content
```

## 5.6 Authentication Transport

Browser sessions should use secure HTTP-only cookies.

Recommended cookie properties:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

Bearer tokens may be supported for programmatic clients in a future version.

Private keys must never be requested, transmitted or stored.

---

# 6. Authorization

Authentication proves wallet ownership.

Authorization determines what the authenticated User may do.

## 6.1 Roles

Version One organization roles:

- `owner`
- `organizer`
- `viewer`

Installation-wide role:

- `administrator`

## 6.2 Permission Summary

| Action | Visitor | Attendee | Viewer | Organizer | Owner | Administrator |
|---|---:|---:|---:|---:|---:|---:|
| View public Event | Yes | Yes | Yes | Yes | Yes | Yes |
| View public Gallery | Yes | Yes | Yes | Yes | Yes | Yes |
| Claim credential | No | Yes | Yes | Yes | Yes | Yes |
| View organization dashboard | No | No | Yes | Yes | Yes | Yes |
| Create Event | No | No | No | Yes | Yes | Yes |
| Edit draft Event | No | No | No | Yes | Yes | Yes |
| Publish Event | No | No | No | Yes | Yes | Yes |
| Generate Claim Codes | No | No | No | Yes | Yes | Yes |
| Export Claims | No | No | Yes | Yes | Yes | Yes |
| Manage members | No | No | No | No | Yes | Yes |
| Manage installation | No | No | No | No | No | Yes |

Every authorization check must occur server-side.

Frontend visibility is not a security boundary.

---

# 7. Common Response Format

## 7.1 Single Resource

```json
{
  "data": {
    "id": "evt_01JZ..."
  }
}
```

## 7.2 Collection

```json
{
  "data": [
    {
      "id": "evt_01JZ..."
    }
  ],
  "pagination": {
    "nextCursor": "eyJjcmVhdGVkQXQiOi...",
    "hasMore": true
  }
}
```

## 7.3 Empty Success

Use:

```http
204 No Content
```

for successful operations that do not require a response body.

## 7.4 Resource Identifiers

Public API identifiers should be opaque strings.

Recommended prefixes:

```text
org_
usr_
wal_
evt_
clc_
clm_
mop_
med_
```

Clients must not infer implementation details from IDs.

---

# 8. Error Format

All API errors use a consistent format.

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "The requested event does not exist.",
    "status": 404,
    "requestId": "req_01JZ91W0Y9E88FK2S8G3A6B8MT",
    "details": null
  }
}
```

Validation errors may include field information.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "status": 422,
    "requestId": "req_01JZ91W0Y9E88FK2S8G3A6B8MT",
    "details": {
      "fields": [
        {
          "field": "title",
          "code": "REQUIRED",
          "message": "Title is required."
        },
        {
          "field": "maximumClaims",
          "code": "MIN_VALUE",
          "message": "Maximum claims must be greater than zero."
        }
      ]
    }
  }
}
```

## 8.1 Standard HTTP Status Codes

| Status | Usage |
|---|---|
| `200` | Successful read or update |
| `201` | Resource created |
| `202` | Accepted for asynchronous processing |
| `204` | Successful operation without body |
| `400` | Malformed request |
| `401` | Authentication required or invalid |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `409` | State or uniqueness conflict |
| `410` | Resource permanently unavailable |
| `422` | Validation failure |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `502` | Upstream blockchain or storage failure |
| `503` | Temporary service unavailability |

## 8.2 Core Error Codes

```text
AUTHENTICATION_REQUIRED
INVALID_SIGNATURE
CHALLENGE_EXPIRED
CHALLENGE_ALREADY_USED
SESSION_EXPIRED
PERMISSION_DENIED

ORGANIZATION_NOT_FOUND
ORGANIZATION_SLUG_TAKEN
ORGANIZATION_OWNER_REQUIRED

EVENT_NOT_FOUND
EVENT_NOT_PUBLISHED
EVENT_PAUSED
EVENT_ARCHIVED
EVENT_CLOSED
EVENT_ALREADY_PUBLISHED
EVENT_IMMUTABLE_FIELD
MAX_CLAIMS_REACHED

CLAIM_CODE_INVALID
CLAIM_CODE_EXPIRED
CLAIM_CODE_ALREADY_USED
CLAIM_CODE_REVOKED

CLAIM_NOT_FOUND
CLAIM_ALREADY_EXISTS
CLAIM_NOT_RETRYABLE

MINT_OPERATION_NOT_FOUND
MINT_ALREADY_CONFIRMED
BLOCKCHAIN_UNAVAILABLE
TRANSACTION_SUBMISSION_FAILED
TRANSACTION_CONFIRMATION_FAILED
MINT_EVENT_NOT_FOUND
BLOCKCHAIN_STATE_MISMATCH

MEDIA_NOT_FOUND
MEDIA_TYPE_NOT_ALLOWED
MEDIA_TOO_LARGE
MEDIA_VALIDATION_FAILED

VALIDATION_ERROR
RATE_LIMIT_EXCEEDED
IDEMPOTENCY_CONFLICT
INTERNAL_ERROR
```

Messages should be safe for end users.

Sensitive infrastructure details must not be returned.

---

# 9. Pagination

Cursor pagination is required for collection endpoints.

Offset pagination should not be used for large mutable datasets.

## 9.1 Query Parameters

```text
limit
cursor
```

Example:

```http
GET /api/v1/events?limit=25&cursor=eyJjcmVhdGVkQXQiOi...
```

## 9.2 Rules

- Default `limit`: `20`
- Maximum `limit`: `100`
- Cursors are opaque.
- Cursors must not be manually constructed by clients.
- Stable sorting must include a unique tie-breaker.

## 9.3 Response

```json
{
  "data": [],
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

# 10. Filtering and Sorting

Collection endpoints may support resource-specific filters.

Common parameters:

```text
status
createdAfter
createdBefore
sort
order
```

Supported order values:

```text
asc
desc
```

Unsupported filter combinations must return `422 VALIDATION_ERROR`.

---

# 11. Idempotency

Idempotency is required for write operations where duplicate processing could create business or blockchain side effects.

Clients send:

```http
Idempotency-Key: 3c6af0d8-59de-43be-a73b-9a9aa7cf71d3
```

## 11.1 Required Endpoints

Idempotency is required for:

- Claim creation.
- Event publication.
- Claim Code batch generation.
- Mint retry requests.
- Metadata publication.

## 11.2 Rules

- Keys are scoped to authenticated User and endpoint.
- The same key with the same request returns the original result.
- The same key with a different request returns `409 IDEMPOTENCY_CONFLICT`.
- Recommended retention is at least 24 hours.
- A key must not cause two mint transactions.

---

# 12. Organizations

## 12.1 Create Organization

```http
POST /api/v1/organizations
```

### Request

```json
{
  "name": "ETH Cinco de Mayo",
  "slug": "eth-cinco-de-mayo",
  "description": "Ethereum community and event organizer in Mexico.",
  "websiteUrl": "https://example.org",
  "logoMediaId": "med_01JZ..."
}
```

### Response

```http
201 Created
```

```json
{
  "data": {
    "id": "org_01JZ...",
    "name": "ETH Cinco de Mayo",
    "slug": "eth-cinco-de-mayo",
    "description": "Ethereum community and event organizer in Mexico.",
    "websiteUrl": "https://example.org",
    "logo": {
      "mediaId": "med_01JZ...",
      "url": "https://cdn.example.org/..."
    },
    "status": "active",
    "createdAt": "2026-07-19T18:30:00Z",
    "updatedAt": "2026-07-19T18:30:00Z"
  }
}
```

The creator becomes the first `owner`.

## 12.2 List Accessible Organizations

```http
GET /api/v1/organizations
```

Returns Organizations accessible to the authenticated User.

Optional filters:

```text
status
role
```

## 12.3 Get Public Organization

```http
GET /api/v1/organizations/{organizationIdOrSlug}
```

Private administrative details must not appear in the public representation.

## 12.4 Update Organization

```http
PATCH /api/v1/organizations/{organizationId}
```

All fields are optional.

Only explicitly provided fields are changed.

## 12.5 Archive Organization

```http
POST /api/v1/organizations/{organizationId}/archive
```

Archiving an Organization does not delete Events, Claims or on-chain credentials.

## 12.6 List Organization Members

```http
GET /api/v1/organizations/{organizationId}/members
```

## 12.7 Add Organization Member

```http
POST /api/v1/organizations/{organizationId}/members
```

### Request

```json
{
  "walletAddress": "0x...",
  "chainNamespace": "eip155",
  "chainId": "8453",
  "role": "organizer"
}
```

## 12.8 Update Organization Member

```http
PATCH /api/v1/organizations/{organizationId}/members/{memberId}
```

## 12.9 Remove Organization Member

```http
DELETE /api/v1/organizations/{organizationId}/members/{memberId}
```

The last active owner cannot be removed.

---

# 13. Events

## 13.1 Create Event

```http
POST /api/v1/events
```

### Request

```json
{
  "organizationId": "org_01JZ...",
  "title": "ETH Cinco de Mayo 2027",
  "slug": "eth-cinco-de-mayo-2027",
  "description": "Annual Ethereum community event.",
  "artworkMediaId": "med_01JZ...",
  "bannerMediaId": null,
  "location": "Oaxaca, Mexico",
  "websiteUrl": "https://example.org",
  "startsAt": "2027-05-05T15:00:00Z",
  "endsAt": "2027-05-07T23:00:00Z",
  "claimStartsAt": "2027-05-05T15:00:00Z",
  "claimEndsAt": "2027-05-14T23:59:59Z",
  "chainNamespace": "eip155",
  "chainId": "8453",
  "maximumClaims": 1000,
  "visibility": "public"
}
```

### Response

```http
201 Created
```

New Events begin with:

```json
{
  "status": "draft"
}
```

Contract address, token ID and metadata URI may remain null until publication preparation.

## 13.2 List Events

```http
GET /api/v1/events
```

Public unauthenticated results include only Events that are visible to the caller.

Optional filters:

```text
organizationId
organizationSlug
status
visibility
startsAfter
startsBefore
claimable
search
```

## 13.3 Get Event

```http
GET /api/v1/events/{eventIdOrSlug}
```

Example response:

```json
{
  "data": {
    "id": "evt_01JZ...",
    "organization": {
      "id": "org_01JZ...",
      "name": "ETH Cinco de Mayo",
      "slug": "eth-cinco-de-mayo"
    },
    "title": "ETH Cinco de Mayo 2027",
    "slug": "eth-cinco-de-mayo-2027",
    "description": "Annual Ethereum community event.",
    "artwork": {
      "mediaId": "med_01JZ...",
      "url": "https://cdn.example.org/artwork.webp"
    },
    "location": "Oaxaca, Mexico",
    "startsAt": "2027-05-05T15:00:00Z",
    "endsAt": "2027-05-07T23:00:00Z",
    "claimStartsAt": "2027-05-05T15:00:00Z",
    "claimEndsAt": "2027-05-14T23:59:59Z",
    "chain": {
      "namespace": "eip155",
      "chainId": "8453"
    },
    "contractAddress": "0x...",
    "tokenId": "42",
    "metadataUri": "ipfs://...",
    "maximumClaims": 1000,
    "acceptedClaims": 521,
    "confirmedMints": 519,
    "status": "published",
    "visibility": "public",
    "claimability": {
      "isClaimable": true,
      "reason": null
    },
    "createdAt": "2026-07-19T18:30:00Z",
    "updatedAt": "2026-07-20T10:00:00Z",
    "publishedAt": "2026-07-20T10:00:00Z"
  }
}
```

`acceptedClaims` is derived from application Claims.

`confirmedMints` is derived from confirmed Mint Operations and indexed blockchain events.

## 13.4 Update Draft Event

```http
PATCH /api/v1/events/{eventId}
```

Published immutable fields must reject changes with:

```text
EVENT_IMMUTABLE_FIELD
```

## 13.5 Prepare Publication

```http
POST /api/v1/events/{eventId}/publication-preview
```

Returns the computed metadata and validation status without publishing.

Example:

```json
{
  "data": {
    "valid": true,
    "metadata": {
      "name": "ETH Cinco de Mayo 2027",
      "description": "Annual Ethereum community event.",
      "image": "ipfs://..."
    },
    "warnings": []
  }
}
```

## 13.6 Publish Event

```http
POST /api/v1/events/{eventId}/publish
```

Requires `Idempotency-Key`.

Publication may require asynchronous metadata upload or contract configuration.

### Immediate completion

```http
200 OK
```

### Asynchronous preparation

```http
202 Accepted
```

```json
{
  "data": {
    "eventId": "evt_01JZ...",
    "status": "publishing"
  }
}
```

The public Event state remains unavailable for claims until all required publication steps succeed.

## 13.7 Pause Event

```http
POST /api/v1/events/{eventId}/pause
```

Pausing stops new Claims.

Existing mint operations continue.

## 13.8 Resume Event

```http
POST /api/v1/events/{eventId}/resume
```

Only paused Events may be resumed.

## 13.9 Archive Event

```http
POST /api/v1/events/{eventId}/archive
```

Archived Events remain verifiable and visible according to their visibility policy but cannot accept new Claims.

## 13.10 Event Statistics

```http
GET /api/v1/events/{eventId}/statistics
```

Example:

```json
{
  "data": {
    "maximumClaims": 1000,
    "availableClaimCodes": 200,
    "acceptedClaims": 521,
    "pendingClaims": 2,
    "completedClaims": 519,
    "failedClaims": 0,
    "confirmedMints": 519
  }
}
```

Statistics must identify their source when values may differ temporarily.

---

# 14. Claim Codes

## 14.1 Generate Claim Codes

```http
POST /api/v1/events/{eventId}/claim-codes
```

Requires `Idempotency-Key`.

### Request

```json
{
  "quantity": 500,
  "expiresAt": "2027-05-14T23:59:59Z"
}
```

### Synchronous response for small batches

```http
201 Created
```

```json
{
  "data": {
    "batchId": "clb_01JZ...",
    "quantity": 500,
    "codes": [
      {
        "claimCodeId": "clc_01JZ...",
        "code": "D9N7-M4K2-P8Q1",
        "claimUrl": "https://openbadge.example.com/claim/D9N7-M4K2-P8Q1"
      }
    ]
  }
}
```

Plain-text codes are returned only during creation or explicit export.

The API must not later return stored plain-text codes because the database stores hashes.

### Asynchronous response for large batches

```http
202 Accepted
```

```json
{
  "data": {
    "batchId": "clb_01JZ...",
    "status": "generating",
    "quantity": 10000
  }
}
```

## 14.2 Get Claim Code Batch Status

```http
GET /api/v1/events/{eventId}/claim-code-batches/{batchId}
```

## 14.3 Download Claim Code Export

```http
GET /api/v1/events/{eventId}/claim-code-batches/{batchId}/export
```

The export may be CSV or ZIP.

The response should use a short-lived signed URL or streamed download.

## 14.4 List Claim Code Summaries

```http
GET /api/v1/events/{eventId}/claim-codes
```

Returns only safe fields:

```json
{
  "data": [
    {
      "id": "clc_01JZ...",
      "status": "available",
      "expiresAt": "2027-05-14T23:59:59Z",
      "usedAt": null,
      "createdAt": "2027-05-01T12:00:00Z"
    }
  ]
}
```

The original code must not be returned.

## 14.5 Revoke Claim Code

```http
POST /api/v1/events/{eventId}/claim-codes/{claimCodeId}/revoke
```

Used Claim Codes cannot be revoked retroactively.

## 14.6 Revoke Available Codes in Batch

```http
POST /api/v1/events/{eventId}/claim-code-batches/{batchId}/revoke
```

This affects only unused codes.

---

# 15. Claims

## 15.1 Validate Claim Code

```http
POST /api/v1/claims/validate
```

This endpoint may be called before authentication to show Event information.

### Request

```json
{
  "code": "D9N7-M4K2-P8Q1"
}
```

### Response

```json
{
  "data": {
    "valid": true,
    "event": {
      "id": "evt_01JZ...",
      "title": "ETH Cinco de Mayo 2027",
      "artworkUrl": "https://cdn.example.org/artwork.webp",
      "organizationName": "ETH Cinco de Mayo"
    },
    "requiresAuthentication": true
  }
}
```

The response must not reveal whether a specific Wallet has claimed until authentication occurs.

Rate limiting must be strict to prevent code enumeration.

## 15.2 Create Claim

```http
POST /api/v1/claims
```

Authentication and `Idempotency-Key` are required.

### Request

```json
{
  "code": "D9N7-M4K2-P8Q1",
  "recipientWalletId": "wal_01JZ..."
}
```

The recipient Wallet must belong to the authenticated User unless an authorized organizer-only issuance endpoint is introduced later.

### Response

```http
202 Accepted
```

```json
{
  "data": {
    "id": "clm_01JZ...",
    "eventId": "evt_01JZ...",
    "wallet": {
      "id": "wal_01JZ...",
      "address": "0x1234..."
    },
    "status": "queued",
    "claimedAt": "2027-05-05T18:12:00Z",
    "mint": {
      "status": "queued"
    }
  }
}
```

Claim creation is complete once the application accepts the Claim and reserves supply.

Blockchain confirmation is not required for this response.

## 15.3 Get Claim

```http
GET /api/v1/claims/{claimId}
```

Only the claimant, authorized Organization members and Administrators may view non-public Claim details.

Example:

```json
{
  "data": {
    "id": "clm_01JZ...",
    "event": {
      "id": "evt_01JZ...",
      "title": "ETH Cinco de Mayo 2027"
    },
    "wallet": {
      "address": "0x1234..."
    },
    "status": "minting",
    "claimedAt": "2027-05-05T18:12:00Z",
    "failure": null,
    "mint": {
      "latestOperationId": "mop_01JZ...",
      "status": "confirming",
      "transactionHash": "0x..."
    }
  }
}
```

## 15.4 List Current User Claims

```http
GET /api/v1/me/claims
```

Optional filters:

```text
status
eventId
organizationId
```

## 15.5 List Event Claims

```http
GET /api/v1/events/{eventId}/claims
```

Requires Organization access.

Filters:

```text
status
walletAddress
claimedAfter
claimedBefore
```

## 15.6 Retry Failed Claim Mint

```http
POST /api/v1/claims/{claimId}/retry
```

Requires `Idempotency-Key`.

Only retryable failures may be retried.

A new Mint Operation is created.

The previous operation remains immutable.

## 15.7 Export Event Claims

```http
POST /api/v1/events/{eventId}/claims/export
```

Returns `202 Accepted` for asynchronous exports.

Exports should contain only fields authorized for the requesting User.

Raw signatures, authentication challenges and secrets must never be included.

---

# 16. Mint Operations

Mint Operations expose processing status.

They must not expose signer secrets or raw internal transaction payloads.

## 16.1 Get Mint Operation

```http
GET /api/v1/mint-operations/{mintOperationId}
```

Example:

```json
{
  "data": {
    "id": "mop_01JZ...",
    "claimId": "clm_01JZ...",
    "attemptNumber": 1,
    "chain": {
      "namespace": "eip155",
      "chainId": "8453"
    },
    "contractAddress": "0x...",
    "tokenId": "42",
    "recipientAddress": "0x1234...",
    "quantity": "1",
    "status": "confirmed",
    "transactionHash": "0x...",
    "blockNumber": "33114420",
    "submittedAt": "2027-05-05T18:12:05Z",
    "confirmedAt": "2027-05-05T18:12:17Z",
    "failure": null
  }
}
```

Large blockchain integers must be represented as strings to avoid precision loss.

## 16.2 List Claim Mint Operations

```http
GET /api/v1/claims/{claimId}/mint-operations
```

## 16.3 Administrative Reconciliation

```http
POST /api/v1/admin/mint-operations/{mintOperationId}/reconcile
```

Administrator only.

This endpoint checks canonical blockchain state and updates derived operational status.

It must not invent a successful mint when the expected contract event is absent.

---

# 17. Credentials

A Credential is a composed read model.

It may combine:

- Event.
- Organization.
- Claim.
- Confirmed Mint Operation.
- Indexed contract event.
- Metadata.
- Current canonical blockchain balance or ownership state.

## 17.1 Credential Locator

Version One identifies an ERC-1155 credential using:

```text
chainNamespace
chainId
contractAddress
tokenId
walletAddress
```

Because ERC-1155 tokens are fungible within one token ID, the Wallet address is required to represent one attendee's credential holding.

## 17.2 Get Credential

```http
GET /api/v1/credentials/{chainNamespace}/{chainId}/{contractAddress}/{tokenId}/{walletAddress}
```

Example:

```http
GET /api/v1/credentials/eip155/8453/0xabc.../42/0x123...
```

### Response

```json
{
  "data": {
    "credentialId": "eip155:8453:0xabc:42:0x123",
    "type": "attendance",
    "status": "valid",
    "event": {
      "id": "evt_01JZ...",
      "title": "ETH Cinco de Mayo 2027",
      "description": "Annual Ethereum community event.",
      "startsAt": "2027-05-05T15:00:00Z",
      "endsAt": "2027-05-07T23:00:00Z",
      "location": "Oaxaca, Mexico",
      "artworkUrl": "https://cdn.example.org/artwork.webp"
    },
    "organization": {
      "id": "org_01JZ...",
      "name": "ETH Cinco de Mayo",
      "slug": "eth-cinco-de-mayo"
    },
    "holder": {
      "walletAddress": "0x123..."
    },
    "blockchain": {
      "chainNamespace": "eip155",
      "chainId": "8453",
      "contractAddress": "0xabc...",
      "tokenId": "42",
      "balance": "1",
      "transactionHash": "0x...",
      "blockNumber": "33114420",
      "mintedAt": "2027-05-05T18:12:17Z",
      "metadataUri": "ipfs://..."
    },
    "verification": {
      "verifiedAt": "2027-05-05T18:20:00Z",
      "source": "canonical_chain",
      "isCanonical": true
    }
  }
}
```

## 17.3 Credential Status

Supported API statuses:

- `pending`
- `valid`
- `revoked`
- `transferred`
- `burned`
- `not_found`
- `unknown`

Version One may support only a subset on-chain, but the API must not report `valid` without blockchain evidence.

## 17.4 Pending Credential Read Model

Before mint confirmation, the API may return a pending representation through the Claim endpoint.

The canonical Credential endpoint should normally return `404` until the expected on-chain credential exists.

---

# 18. Galleries

A Gallery is a read projection of credentials associated with a Wallet.

## 18.1 Get Wallet Gallery

```http
GET /api/v1/galleries/{chainNamespace}/{chainId}/{walletAddress}
```

Optional filters:

```text
organizationId
eventId
fromDate
toDate
status
```

### Response

```json
{
  "data": {
    "wallet": {
      "chainNamespace": "eip155",
      "chainId": "8453",
      "address": "0x123..."
    },
    "credentials": [
      {
        "credentialId": "eip155:8453:0xabc:42:0x123",
        "event": {
          "id": "evt_01JZ...",
          "title": "ETH Cinco de Mayo 2027",
          "artworkUrl": "https://cdn.example.org/artwork.webp"
        },
        "organization": {
          "name": "ETH Cinco de Mayo",
          "slug": "eth-cinco-de-mayo"
        },
        "mintedAt": "2027-05-05T18:12:17Z",
        "status": "valid"
      }
    ]
  },
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

## 18.2 Gallery Consistency

Gallery results may come from indexed projections.

The response should include freshness metadata when useful:

```json
{
  "index": {
    "lastSyncedBlock": "33114500",
    "lastSyncedAt": "2027-05-05T18:20:00Z"
  }
}
```

A Gallery must not be treated as stronger evidence than direct credential verification.

---

# 19. Verification

## 19.1 Verify Credential

```http
POST /api/v1/verification/credentials
```

### Request

```json
{
  "chainNamespace": "eip155",
  "chainId": "8453",
  "contractAddress": "0xabc...",
  "tokenId": "42",
  "walletAddress": "0x123..."
}
```

### Response

```json
{
  "data": {
    "valid": true,
    "reason": null,
    "credential": {
      "credentialId": "eip155:8453:0xabc:42:0x123",
      "status": "valid"
    },
    "checks": {
      "contractRecognized": true,
      "eventResolved": true,
      "balancePositive": true,
      "mintEventFound": true,
      "canonicalBlock": true,
      "metadataResolved": true
    },
    "verifiedAt": "2027-05-05T18:20:00Z"
  }
}
```

## 19.2 Verification Failure Reasons

```text
CONTRACT_NOT_RECOGNIZED
EVENT_NOT_RESOLVED
TOKEN_NOT_FOUND
WALLET_HAS_NO_BALANCE
MINT_EVENT_NOT_FOUND
BLOCK_NOT_CANONICAL
CREDENTIAL_REVOKED
CREDENTIAL_BURNED
BLOCKCHAIN_UNAVAILABLE
METADATA_UNAVAILABLE
```

`METADATA_UNAVAILABLE` should not automatically invalidate an otherwise valid on-chain credential.

## 19.3 Verification Assurance

The API may include:

```text
indexed
canonical_chain
```

as verification sources.

Public verification should prefer canonical blockchain queries when practical.

---

# 20. Wallets

## 20.1 List Current User Wallets

```http
GET /api/v1/me/wallets
```

## 20.2 Add Wallet

Adding a Wallet requires a new signature challenge.

```http
POST /api/v1/me/wallets
```

## 20.3 Set Primary Wallet

```http
POST /api/v1/me/wallets/{walletId}/primary
```

## 20.4 Remove Wallet Association

```http
DELETE /api/v1/me/wallets/{walletId}
```

Removing the User association does not alter blockchain ownership or historical Claims.

A Wallet involved in historical records may remain as an independent domain record.

---

# 21. Media Uploads

Version One should prefer direct uploads using signed URLs.

## 21.1 Create Upload Request

```http
POST /api/v1/media/uploads
```

### Request

```json
{
  "purpose": "event_artwork",
  "filename": "eth-cdm-2027.png",
  "mimeType": "image/png",
  "sizeBytes": 2459031
}
```

### Response

```json
{
  "data": {
    "mediaId": "med_01JZ...",
    "uploadMethod": "PUT",
    "uploadUrl": "https://storage.example.org/...",
    "headers": {
      "Content-Type": "image/png"
    },
    "expiresAt": "2026-07-19T18:40:00Z"
  }
}
```

## 21.2 Complete Upload

```http
POST /api/v1/media/{mediaId}/complete
```

The server must verify:

- Object existence.
- File size.
- MIME type using file content.
- Image dimensions.
- Checksum when available.
- Malware policy when configured.

### Response

```json
{
  "data": {
    "id": "med_01JZ...",
    "status": "available",
    "mimeType": "image/png",
    "sizeBytes": 2459031,
    "width": 1200,
    "height": 1200,
    "url": "https://cdn.example.org/..."
  }
}
```

## 21.3 Allowed Event Artwork

Version One:

- PNG.
- JPEG.
- WEBP.

SVG should not be accepted by default because active content creates additional security risk.

Maximum default size:

```text
10 MB
```

Installations may configure a lower limit.

---

# 22. Current User Endpoints

## 22.1 Get Current User

```http
GET /api/v1/me
```

## 22.2 Update Profile

```http
PATCH /api/v1/me
```

Version One editable fields:

- `displayName`
- `avatarMediaId`

## 22.3 Get Current User Notifications

```http
GET /api/v1/me/notifications
```

## 22.4 Mark Notification Read

```http
POST /api/v1/me/notifications/{notificationId}/read
```

---

# 23. Health and Installation Information

## 23.1 Liveness

```http
GET /health/live
```

Returns whether the HTTP process is running.

## 23.2 Readiness

```http
GET /health/ready
```

Checks required dependencies:

- PostgreSQL.
- Queue.
- Object storage.
- Configured blockchain RPC.

Sensitive dependency details must not be exposed publicly.

## 23.3 Public Installation Configuration

```http
GET /api/v1/config
```

Example:

```json
{
  "data": {
    "name": "OpenBadge",
    "supportedChains": [
      {
        "chainNamespace": "eip155",
        "chainId": "8453",
        "name": "Base"
      }
    ],
    "authentication": {
      "wallet": true
    },
    "maximumUploadBytes": 10485760
  }
}
```

No secrets or administrative settings may appear here.

---

# 24. Internal Worker Interfaces

Background workers should preferably consume queue jobs and shared domain services rather than public HTTP endpoints.

When internal HTTP endpoints are necessary, they must:

- Use a separate internal network.
- Require service authentication.
- Never be exposed publicly.
- Be excluded from the public OpenAPI document.

Example internal operations:

```text
Submit mint
Check transaction receipt
Index blockchain blocks
Reconcile Claims
Publish metadata
Generate exports
```

Public clients must not be able to trigger arbitrary blockchain operations.

---

# 25. Rate Limits

Rate limits must be configurable.

Recommended defaults:

| Endpoint | Limit |
|---|---:|
| Create authentication challenge | 10 per minute per IP |
| Verify signature | 10 per minute per IP |
| Validate Claim Code | 30 per minute per IP |
| Create Claim | 10 per minute per authenticated User |
| Public Event reads | 120 per minute per IP |
| Gallery reads | 60 per minute per IP |
| Credential verification | 60 per minute per IP |
| Media upload requests | 20 per hour per User |
| Claim Code generation | 10 batches per hour per Organization |

Rate-limit response:

```http
429 Too Many Requests
Retry-After: 60
```

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Try again later.",
    "status": 429,
    "requestId": "req_01JZ...",
    "details": {
      "retryAfterSeconds": 60
    }
  }
}
```

---

# 26. Security Requirements

## 26.1 Input Validation

Every endpoint must validate:

- Type.
- Length.
- Format.
- Allowed values.
- Ownership.
- State transition.
- Authorization.

## 26.2 Wallet Addresses

EVM addresses must be:

- Parsed and validated.
- Stored in normalized form.
- Returned in a consistent display form.
- Compared case-insensitively or by normalized bytes.

## 26.3 Claim Codes

- Must contain sufficient entropy.
- Must be stored as hashes.
- Must be constant-time compared where practical.
- Must not appear in logs.
- Must not appear in analytics payloads.
- Must not appear in error messages.

## 26.4 CSRF

Cookie-authenticated write requests require CSRF protection.

SameSite cookies alone are not sufficient for every deployment model.

## 26.5 CORS

CORS must default to the configured frontend origins.

Wildcard origins must not be used with authenticated requests.

## 26.6 Logging

Logs may include:

- Request ID.
- Route.
- Status.
- Duration.
- Authenticated User ID.
- Entity IDs.

Logs must exclude:

- Raw Wallet signatures.
- Authentication nonces.
- Plain-text Claim Codes.
- Private keys.
- Session tokens.
- Signed upload secrets.
- Full sensitive request bodies.

## 26.7 Blockchain Signer

The API must not directly expose the minting private key.

Signer access should be isolated behind the mint worker or a secure signing service.

## 26.8 File Security

Uploaded files must not be trusted based only on filename or declared MIME type.

---

# 27. Cache Behavior

Public read endpoints may use caching.

Recommended examples:

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

Suitable for:

- Public Organizations.
- Published Events.
- Public Galleries.
- Metadata.

Private responses must use:

```http
Cache-Control: private, no-store
```

Suitable for:

- Sessions.
- Organization administration.
- Claims.
- Claim Codes.
- Mint failure details.

Credential verification responses should have short cache lifetimes because blockchain state may change.

---

# 28. Concurrency Rules

The API must handle concurrent Claims safely.

The Claim endpoint must not rely only on an earlier validation response.

During Claim creation, the server must atomically revalidate:

- Claim Code status.
- Event status.
- Claim window.
- Remaining supply.
- Existing Wallet Claim.
- Code expiration.

Two concurrent requests using the same code must produce at most one accepted Claim.

Two concurrent requests by the same Wallet for the same Event must produce at most one accepted Claim.

---

# 29. Blockchain Number Encoding

Values that may exceed JavaScript safe integer limits must be encoded as decimal strings.

Examples:

```json
{
  "tokenId": "42",
  "blockNumber": "33114420",
  "quantity": "1"
}
```

This applies to:

- Token IDs.
- Block numbers.
- Balances.
- Quantities.
- Transaction nonces when exposed.

---

# 30. Date and Time Rules

All API timestamps use UTC and ISO 8601.

Example:

```text
2027-05-05T18:12:17Z
```

Clients are responsible for local display conversion.

Date ranges use inclusive start and exclusive end semantics unless explicitly documented otherwise.

---

# 31. Search

Version One search endpoints may include:

```http
GET /api/v1/search
```

Query parameters:

```text
q
types
limit
cursor
```

Supported public types:

- `organization`
- `event`
- `wallet`

Credential search should use the explicit credential locator or verification endpoint.

Search must not expose private Events or Organization administration data.

---

# 32. OpenAPI Requirements

The public API must publish an OpenAPI document.

Recommended endpoint:

```http
GET /api/v1/openapi.json
```

Interactive documentation may be available at:

```text
/docs/api
```

The OpenAPI document must include:

- Paths.
- Methods.
- Authentication.
- Request schemas.
- Response schemas.
- Error schemas.
- Examples.
- Enum values.
- Pagination parameters.
- Idempotency requirements.
- Rate-limit notes.

The generated OpenAPI schema must be validated in CI.

The API implementation and documentation should derive from shared schemas when practical to reduce drift.

---

# 33. API Acceptance Criteria

The Version One API is complete when:

1. A Wallet can authenticate without a password.
2. An Organizer can create and publish an Event.
3. An Organizer can generate unique Claim Codes.
4. An authenticated Wallet can create one Claim.
5. Claim creation reserves supply atomically.
6. Minting continues asynchronously.
7. A claimant can inspect Claim and mint status.
8. A confirmed credential can be reconstructed without a Credential table.
9. A public Gallery can display indexed on-chain credentials.
10. A verifier can confirm canonical blockchain state.
11. Every core write operation enforces authorization.
12. Every error uses the standard error format.
13. Collection endpoints use cursor pagination.
14. Sensitive information never appears in public responses.
15. The complete public API is documented with OpenAPI.

---

# 34. Version One Endpoint Summary

## Authentication

```text
POST   /auth/challenges
POST   /auth/verify
GET    /auth/session
DELETE /auth/session
```

## Current User

```text
GET    /me
PATCH  /me
GET    /me/wallets
POST   /me/wallets
POST   /me/wallets/{walletId}/primary
DELETE /me/wallets/{walletId}
GET    /me/claims
GET    /me/notifications
POST   /me/notifications/{notificationId}/read
```

## Organizations

```text
POST   /organizations
GET    /organizations
GET    /organizations/{organizationIdOrSlug}
PATCH  /organizations/{organizationId}
POST   /organizations/{organizationId}/archive
GET    /organizations/{organizationId}/members
POST   /organizations/{organizationId}/members
PATCH  /organizations/{organizationId}/members/{memberId}
DELETE /organizations/{organizationId}/members/{memberId}
```

## Events

```text
POST   /events
GET    /events
GET    /events/{eventIdOrSlug}
PATCH  /events/{eventId}
POST   /events/{eventId}/publication-preview
POST   /events/{eventId}/publish
POST   /events/{eventId}/pause
POST   /events/{eventId}/resume
POST   /events/{eventId}/archive
GET    /events/{eventId}/statistics
```

## Claim Codes

```text
POST   /events/{eventId}/claim-codes
GET    /events/{eventId}/claim-codes
GET    /events/{eventId}/claim-code-batches/{batchId}
GET    /events/{eventId}/claim-code-batches/{batchId}/export
POST   /events/{eventId}/claim-code-batches/{batchId}/revoke
POST   /events/{eventId}/claim-codes/{claimCodeId}/revoke
```

## Claims

```text
POST   /claims/validate
POST   /claims
GET    /claims/{claimId}
POST   /claims/{claimId}/retry
GET    /claims/{claimId}/mint-operations
GET    /events/{eventId}/claims
POST   /events/{eventId}/claims/export
```

## Mint Operations

```text
GET    /mint-operations/{mintOperationId}
POST   /admin/mint-operations/{mintOperationId}/reconcile
```

## Credentials and Galleries

```text
GET    /credentials/{chainNamespace}/{chainId}/{contractAddress}/{tokenId}/{walletAddress}
GET    /galleries/{chainNamespace}/{chainId}/{walletAddress}
POST   /verification/credentials
```

## Media

```text
POST   /media/uploads
POST   /media/{mediaId}/complete
```

## Platform

```text
GET    /config
GET    /openapi.json
GET    /health/live
GET    /health/ready
```

---

# 35. Final Principle

The API represents OpenBadge business workflows.

It must not expose PostgreSQL as if the database were the product.

Claims are application records.

Mint Operations are processing records.

Credentials are blockchain-backed read models.

Galleries are indexed projections.

Verification must always favor canonical blockchain state.
