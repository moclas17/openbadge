# OpenBadge Architecture

**Version:** 1.0  
**Status:** Draft  
**Scope:** Version One

---

# 1. Purpose

This document defines the technical architecture of OpenBadge Version One.

It explains how the following components work together:

- Web application.
- Public API.
- Authentication.
- PostgreSQL.
- Queue.
- Background workers.
- Object storage.
- Smart contract.
- Blockchain RPC.
- Indexer.
- Credential verification.
- Public Gallery.
- Self-hosted deployment.

The architecture is designed to support an open-source replacement for POAP while remaining:

- Simple.
- Self-hostable.
- API First.
- Blockchain-backed.
- Operationally recoverable.
- Independent from any single hosted service.

---

# 2. Architecture Principles

## 2.1 Event First

The Event is the central product concept.

All primary workflows begin with an Event:

```text
Organization
    ↓
Event
    ↓
Claim Code
    ↓
Claim
    ↓
Mint Operation
    ↓
On-chain Credential
```

## 2.2 Self Hosted

An OpenBadge installation must be deployable by an independent operator.

A self-hosted installation should control:

- Its database.
- Its object storage.
- Its queue.
- Its API.
- Its frontend.
- Its worker.
- Its blockchain signer.
- Its smart contract deployment.
- Its indexer.

## 2.3 API First

The official frontend is a client of the same documented API available to external integrations.

Business logic must not exist exclusively in frontend code.

## 2.4 Asynchronous Blockchain Operations

Blockchain confirmation must not block the attendee experience.

Claiming and minting are separate operations.

```text
Claim accepted
      ↓
Queued
      ↓
Transaction submitted
      ↓
Transaction confirmed
      ↓
Event indexed
      ↓
Claim completed
```

## 2.5 Blockchain as Credential Truth

PostgreSQL is not the source of truth for issued credentials.

The blockchain is authoritative for:

- Credential issuance.
- Token ownership.
- Token balance.
- Revocation or burn.
- Canonical transaction history.

## 2.6 Replaceable Infrastructure

Infrastructure adapters should be replaceable where practical.

Examples:

- S3 or MinIO.
- Redis or a database-backed queue.
- Different EVM RPC providers.
- Local or managed PostgreSQL.
- Different frontend hosting platforms.

## 2.7 Minimal Smart Contract

The smart contract enforces only permanent blockchain rules.

The application manages flexible product workflows.

---

# 3. System Context

```text
                         ┌─────────────────────┐
                         │     Organizer       │
                         └──────────┬──────────┘
                                    │
                                    ▼
┌──────────────┐          ┌─────────────────────┐
│   Attendee   │─────────▶│    Web Frontend     │
└──────────────┘          └──────────┬──────────┘
                                    │ HTTPS / JSON
                                    ▼
                         ┌─────────────────────┐
                         │     Public API      │
                         └───────┬─────┬───────┘
                                 │     │
                         SQL     │     │ Jobs
                                 ▼     ▼
                       ┌────────────┐  ┌────────────┐
                       │ PostgreSQL │  │   Queue    │
                       └────────────┘  └─────┬──────┘
                                            │
                                            ▼
                                      ┌────────────┐
                                      │   Worker   │
                                      └─────┬──────┘
                                            │ RPC / Sign
                                            ▼
                                      ┌────────────┐
                                      │ Blockchain │
                                      │  Contract  │
                                      └─────┬──────┘
                                            │ Events
                                            ▼
                                      ┌────────────┐
                                      │  Indexer   │
                                      └─────┬──────┘
                                            │
                                            ▼
                                      ┌────────────┐
                                      │ PostgreSQL │
                                      │ Projections│
                                      └────────────┘

                         ┌─────────────────────┐
                         │   Object Storage    │
                         │ Artwork + Metadata  │
                         └─────────────────────┘
```

---

# 4. Main Components

Version One contains the following logical components:

1. Web Frontend.
2. Public API.
3. Authentication Module.
4. Domain Services.
5. PostgreSQL.
6. Queue.
7. Mint Worker.
8. Metadata Worker.
9. Blockchain Indexer.
10. Reconciliation Worker.
11. Object Storage.
12. Smart Contract.
13. Blockchain RPC.
14. Signer.
15. Observability stack.

These may initially run in fewer physical processes.

For example, the API and several workers may share one codebase while running as separate process types.

---

# 5. Web Frontend

## 5.1 Purpose

The frontend provides the user interface for:

- Wallet authentication.
- Organization management.
- Event creation.
- Artwork upload.
- Claim Code generation.
- Event publication.
- QR claim flow.
- Claim status.
- Public Events.
- Public Galleries.
- Credential verification.

## 5.2 Responsibilities

The frontend may:

- Render application state.
- Validate obvious input constraints.
- Connect to Wallet providers.
- Request authentication signatures.
- Poll or subscribe to Claim status.
- Display pending mint states.
- Render QR codes from Claim URLs.
- Display blockchain explorer links.

## 5.3 Non-Responsibilities

The frontend must not:

- Decide authorization.
- Mark Claims completed.
- Store private keys.
- Mint directly using privileged roles.
- Validate Claim Code uniqueness.
- Enforce maximum supply.
- Decide blockchain finality.
- Treat local state as credential truth.

## 5.4 Recommended Structure

A single web application may contain:

```text
Public pages
Organizer dashboard
Attendee claim flow
Wallet Gallery
Credential verification
Installation administration
```

Mobile-first behavior is important because most attendees will claim through QR codes on phones.

---

# 6. Public API

## 6.1 Purpose

The Public API exposes all product capabilities.

It is the main boundary between clients and the domain.

## 6.2 Responsibilities

The API handles:

- Request validation.
- Authentication.
- Authorization.
- Idempotency.
- Domain commands.
- Database transactions.
- Query responses.
- Queue publication.
- Error normalization.
- Rate limiting.
- Audit logging.
- Public read models.

## 6.3 Internal Structure

Recommended logical layers:

```text
HTTP Controller
      ↓
Application Service
      ↓
Domain Rules
      ↓
Repository / Adapter
      ↓
PostgreSQL, Queue, Storage, Blockchain Reader
```

Controllers should remain thin.

Business workflows belong in application and domain services.

## 6.4 Statelessness

API processes should be stateless except for short-lived in-process caches.

Persistent state belongs in:

- PostgreSQL.
- Queue.
- Object storage.
- Blockchain.

This allows horizontal scaling.

---

# 7. Domain Services

Recommended application services:

```text
AuthenticationService
OrganizationService
EventService
PublicationService
ClaimCodeService
ClaimService
MintService
CredentialService
GalleryService
VerificationService
MediaService
ReconciliationService
```

## 7.1 ClaimService

Responsible for:

- Validating Event claimability.
- Locking Claim Codes.
- Preventing duplicate Claims.
- Reserving Event supply.
- Creating Claims.
- Enqueuing mint work.

## 7.2 PublicationService

Responsible for:

- Validating Event completeness.
- Publishing artwork and metadata.
- Creating the on-chain badge type.
- Freezing metadata.
- Persisting contract and token information.
- Transitioning Event to published.

## 7.3 CredentialService

Responsible for assembling a Credential read model from:

- Event.
- Organization.
- Claim.
- Mint Operation.
- Indexed blockchain events.
- Current blockchain state.
- Metadata.

It does not load a Credential database row.

## 7.4 VerificationService

Responsible for:

- Resolving the contract and token.
- Checking current balance.
- Confirming canonical events.
- Checking burn or revocation.
- Returning assurance and failure reasons.

---

# 8. PostgreSQL

## 8.1 Purpose

PostgreSQL stores application and operational state.

Primary business records:

- Users.
- Wallets.
- Organizations.
- Organization Memberships.
- Events.
- Claim Codes.
- Claims.
- Mint Operations.
- Media references.

Operational and projection records:

- Authentication Challenges.
- Sessions.
- Queue Jobs when applicable.
- Indexed Contract Events.
- Chain Sync State.
- Optional Indexed Token Balances.
- Notifications.
- Audit Logs.

## 8.2 Transaction Boundaries

The database must provide atomicity for Claim acceptance.

The following actions occur in one transaction:

```text
Lock Claim Code
Validate Event state
Validate claim period
Validate available supply
Validate no prior Wallet Claim
Create Claim
Consume or reserve Claim Code
Reserve supply
Create queue outbox record
Commit
```

## 8.3 PostgreSQL Is Not Credential Truth

PostgreSQL may store mint evidence and indexed projections.

It must not override canonical blockchain ownership.

## 8.4 Outbox Pattern

To prevent a database commit from succeeding while queue publication fails, Version One should use a transactional outbox.

Example:

```text
Database transaction
    ├── Create Claim
    ├── Update Claim Code
    └── Insert Outbox Message
            ↓
Outbox Dispatcher
            ↓
Queue
```

This guarantees that committed Claims eventually produce mint jobs.

The outbox record is marked delivered only after successful queue publication.

---

# 9. Queue

## 9.1 Purpose

The queue decouples user-facing requests from slow or unreliable work.

Job categories:

- Publish Event metadata.
- Create badge on-chain.
- Freeze metadata.
- Submit mint.
- Check mint transaction.
- Reconcile mint.
- Index blockchain blocks.
- Generate Claim Code exports.
- Generate claim QR archives.
- Send notifications.

## 9.2 Requirements

The queue must support:

- At-least-once delivery.
- Retry with backoff.
- Dead-letter handling.
- Delayed jobs.
- Job visibility.
- Idempotent consumers.
- Concurrency controls.

## 9.3 Delivery Semantics

Exactly-once delivery should not be assumed.

Workers must be idempotent.

A repeated job must not produce a repeated mint.

## 9.4 Queue Options

Supported implementations may include:

- Redis-backed queue.
- PostgreSQL-backed queue.
- RabbitMQ.
- Managed cloud queue.

Version One may select one default while keeping a queue adapter boundary.

---

# 10. Mint Worker

## 10.1 Purpose

The Mint Worker submits and tracks badge mint transactions.

It holds or accesses the operational signer through a secure boundary.

## 10.2 Mint Flow

```text
Receive Claim mint job
        ↓
Load Claim and Event
        ↓
Acquire Claim processing lock
        ↓
Check whether mint already exists
        ↓
Validate on-chain badge configuration
        ↓
Create Mint Operation
        ↓
Build transaction
        ↓
Sign and submit
        ↓
Store transaction hash
        ↓
Schedule confirmation check
```

## 10.3 Confirmation Flow

```text
Load submitted Mint Operation
        ↓
Query transaction receipt
        ↓
If pending: reschedule
        ↓
If reverted: mark failed
        ↓
If successful: validate expected events
        ↓
Wait required confirmation depth
        ↓
Mark Mint Operation confirmed
        ↓
Mark Claim completed
```

## 10.4 Idempotency

Before submitting, the worker must check:

- Whether Claim is already completed.
- Whether a confirmed Mint Operation exists.
- Whether a submitted transaction already exists.
- Whether the recipient is already historically issued on-chain.
- Whether the current signer nonce has a pending transaction.

## 10.5 Concurrency

Only one worker may actively submit a mint for a Claim.

Recommended mechanisms:

- Row-level locking.
- Advisory locks.
- Queue-level unique job keys.
- A combination of these.

## 10.6 Signer Isolation

The API must not hold the minter private key.

Recommended architecture:

```text
API
 │
 └── Queue
      │
      ▼
 Mint Worker
      │
      ▼
 Secure Signer
```

Signer options:

- Encrypted local keystore.
- Hardware wallet integration.
- Cloud KMS.
- Vault signing service.
- External remote signer.

---

# 11. Event Publication Worker

## 11.1 Purpose

Event publication may require multiple asynchronous steps.

## 11.2 Publication State Machine

Recommended Event publication states:

```text
draft
preparing_metadata
creating_badge
freezing_metadata
published
publication_failed
```

The public API may simplify these into product-facing states while retaining detailed internal status.

## 11.3 Publication Flow

```text
Organizer requests publish
        ↓
Validate Event
        ↓
Upload final artwork
        ↓
Generate metadata JSON
        ↓
Publish metadata to durable storage
        ↓
Call createBadge
        ↓
Read BadgeCreated token ID
        ↓
Persist contract and token ID
        ↓
Call freezeMetadata
        ↓
Wait for confirmation
        ↓
Mark Event published
```

## 11.4 Failure Handling

If metadata publishes but badge creation fails:

- Keep the Event unpublished.
- Preserve published metadata reference.
- Allow retry.

If badge creation succeeds but local persistence fails:

- Reconcile using transaction hash and `BadgeCreated` event.

If metadata freeze fails:

- Event remains unavailable for Claims.
- Retry freeze.
- Do not mint.

---

# 12. Object Storage

## 12.1 Purpose

Object storage contains:

- Event artwork.
- Organization logos.
- Event banners.
- Metadata JSON.
- Generated Claim Code exports.
- Generated QR archives.
- Optional cached media derivatives.

## 12.2 Supported Providers

Recommended adapter interface supports:

- Amazon S3.
- S3-compatible providers.
- MinIO.
- Local filesystem for development.

## 12.3 Direct Uploads

The preferred upload flow:

```text
Frontend requests signed upload
        ↓
API validates upload intent
        ↓
API returns signed URL
        ↓
Frontend uploads directly
        ↓
Frontend confirms upload
        ↓
API validates object
```

This prevents large files from passing through API processes.

## 12.4 Immutable Published Assets

Once an Event is published:

- Published artwork should be content-addressed.
- Metadata should be content-addressed.
- Published references must not be silently replaced.
- Database deletion must not remove immutable published assets.

## 12.5 Local Development

Local filesystem storage may be used for development but should not be the recommended production default unless properly backed up.

---

# 13. Metadata

## 13.1 Metadata Generation

Metadata is generated from Event and Organization data.

The metadata generator should be deterministic for the same input.

## 13.2 Metadata Publication

Recommended default:

```text
IPFS-compatible content-addressed storage
```

Alternative durable object storage may be supported, but operators should understand that mutable HTTP URLs provide weaker permanence.

## 13.3 Metadata Integrity

Before badge creation, the application stores:

- Metadata checksum.
- Artwork checksum.
- Published URI.
- Publication timestamp.

## 13.4 Metadata Retrieval

The API may proxy or cache metadata for display.

Verification must distinguish:

```text
Token valid
Metadata available
```

from:

```text
Token valid
Metadata temporarily unavailable
```

---

# 14. Smart Contract

## 14.1 Deployment

One non-upgradeable ERC-1155 contract is deployed per installation and network.

## 14.2 Contract Responsibilities

The contract:

- Creates token IDs.
- Stores metadata URI.
- Freezes metadata.
- Enforces maximum supply.
- Enforces one lifetime issuance per Wallet.
- Mints.
- Prevents transfers.
- Supports revocation.
- Emits events.
- Supports emergency pause.

## 14.3 Application Contract Registry

The application should maintain a registry of known contract deployments.

Suggested fields:

```text
chain_namespace
chain_id
contract_address
contract_version
deployment_block
deployment_transaction_hash
source_commit
enabled
```

## 14.4 Multiple Versions

The architecture must support multiple contract versions.

```text
OpenBadge V1
OpenBadge V2
```

New Events may use the latest enabled deployment.

Old credentials remain attached to their original contracts.

---

# 15. Blockchain RPC

## 15.1 Purpose

RPC providers support:

- Reading contract state.
- Estimating gas.
- Submitting transactions.
- Reading receipts.
- Reading logs.
- Verification.
- Indexing.

## 15.2 Provider Abstraction

The application should use a chain adapter.

Example interface:

```text
getBlock
getBlockHash
getTransactionReceipt
getLogs
readContract
estimateGas
submitTransaction
getBalance
```

## 15.3 Redundancy

Production installations should support more than one RPC endpoint per network.

Recommended behavior:

- Primary provider for writes.
- Fallback provider for reads.
- Health tracking.
- Temporary circuit breaking.
- Provider-specific rate limiting.

## 15.4 Trust

RPC responses are not independently verified by default.

High-assurance deployments may use:

- Their own node.
- Multiple-provider comparison.
- Light-client verification in future versions.

---

# 16. Blockchain Indexer

## 16.1 Purpose

The indexer converts contract logs into searchable local projections.

It supports:

- Public Galleries.
- Event mint counts.
- Credential lookup.
- Reconciliation.
- Verification acceleration.
- Recovery after application outages.

## 16.2 Indexed Events

At minimum:

```text
BadgeCreated
BadgeMetadataUpdated
BadgeMetadataFrozen
BadgeMinted
BadgeRevoked
TransferSingle
TransferBatch
RoleGranted
RoleRevoked
Paused
Unpaused
```

## 16.3 Indexing Flow

```text
Read Chain Sync State
        ↓
Fetch next block range
        ↓
Fetch logs for registered contracts
        ↓
Validate block hashes
        ↓
Decode logs
        ↓
Store Indexed Contract Events
        ↓
Update balance projection
        ↓
Update Chain Sync State
```

## 16.4 Starting Block

Every registered contract stores its deployment block.

The indexer begins there rather than scanning the entire chain.

## 16.5 Batch Size

Block range size must be configurable because RPC providers impose different limits.

## 16.6 Idempotency

Indexed events use a unique key:

```text
chain
transaction hash
log index
```

Reprocessing the same block range must not duplicate events.

---

# 17. Blockchain Reorganizations

## 17.1 Detection

The indexer stores:

- Last processed block number.
- Last processed block hash.

Before continuing, it compares the stored hash with the current canonical chain.

## 17.2 Recovery

When a mismatch occurs:

```text
Find last common canonical block
        ↓
Delete or invalidate projections after that block
        ↓
Reprocess affected blocks
        ↓
Recalculate balances
        ↓
Reconcile Mint Operations and Claims
```

## 17.3 Finality

Each network has a configurable confirmation depth.

A transaction may be:

```text
submitted
confirmed
finalized
```

Version One may expose only `confirming` and `confirmed` publicly, while internally tracking finality depth.

Claims should not become completed until the configured confirmation requirement is met.

---

# 18. Indexed Token Balances

## 18.1 Purpose

A local balance projection accelerates Gallery queries.

Suggested logical key:

```text
chain_namespace
chain_id
contract_address
token_id
wallet_address
```

Suggested values:

```text
balance
last_block_number
last_transaction_hash
updated_at
```

## 18.2 Projection Status

This table is:

- Rebuildable.
- Derived.
- Not authoritative.
- Safe to delete and regenerate.

## 18.3 Balance Updates

For each standard Transfer event:

```text
Subtract from `from` when non-zero
Add to `to` when non-zero
```

For OpenBadge V1, balances should remain zero or one.

Any balance greater than one indicates:

- A contract bug.
- An unsupported contract version.
- An indexing bug.
- Corrupt data.

The system must flag it for reconciliation.

---

# 19. Reconciliation Worker

## 19.1 Purpose

The reconciliation worker compares application records with blockchain state.

## 19.2 Checks

It detects:

- Submitted transactions without receipts.
- Successful receipts without expected events.
- Confirmed Mint Operations missing indexed events.
- Indexed mints without Claims.
- Completed Claims without current on-chain evidence.
- Token ID mismatches.
- Recipient mismatches.
- Duplicate issuance attempts.
- Reorganized blocks.
- Unexpected revocations.
- Unexpected role changes.

## 19.3 Source of Truth

When application state and blockchain state conflict:

- Preserve application history.
- Correct derived status.
- Favor canonical blockchain evidence.
- Create an audit record.
- Surface the issue to administrators.

## 19.4 Scheduling

Recommended:

- Frequent checks for pending transactions.
- Periodic full reconciliation.
- Immediate reconciliation after indexer reorganization.
- Manual administrative reconciliation endpoint.

---

# 20. Authentication Architecture

## 20.1 Wallet Authentication

Version One uses wallet-signature authentication.

Flow:

```text
Client requests challenge
        ↓
API creates short-lived nonce
        ↓
Wallet signs message
        ↓
API verifies signature
        ↓
API creates or resolves User and Wallet
        ↓
API creates session
```

## 20.2 Sessions

Browser sessions use secure HTTP-only cookies.

Session data may be stored in PostgreSQL or Redis.

## 20.3 User and Wallet Separation

A Wallet is a blockchain identity.

A User is an application account.

One User may control multiple Wallets.

Historical Claims remain associated with the original Wallet even if the User later removes that Wallet from their profile.

## 20.4 Service Authentication

Internal workers must not use user sessions.

They should use:

- Queue credentials.
- Internal service credentials.
- Network isolation.
- Short-lived service tokens when internal HTTP is necessary.

---

# 21. Authorization Architecture

Authorization is based on Organization Membership.

Roles:

```text
owner
organizer
viewer
```

Installation-wide administrators are separate.

Authorization checks belong in application services.

Example:

```text
User requests Event publication
        ↓
Load Event Organization
        ↓
Resolve active membership
        ↓
Check organizer or owner permission
        ↓
Apply publication command
```

The API must never trust a client-provided role.

---

# 22. Claim Flow

## 22.1 User Experience

```text
Attendee scans QR
        ↓
Claim page loads Event
        ↓
Attendee connects Wallet
        ↓
Wallet authenticates
        ↓
Attendee confirms Claim
        ↓
API accepts Claim
        ↓
UI shows Pending
        ↓
Worker mints
        ↓
UI shows Completed
```

## 22.2 Technical Sequence

```text
Frontend
   │ POST /claims
   ▼
API
   │ begin transaction
   ├── lock Claim Code
   ├── validate Event
   ├── validate duplicate
   ├── reserve supply
   ├── create Claim
   ├── insert outbox message
   │ commit
   ▼
Outbox Dispatcher
   │
   ▼
Queue
   │
   ▼
Mint Worker
   │
   ▼
Smart Contract
   │
   ▼
Indexer
   │
   ▼
PostgreSQL Projection
```

## 22.3 Status Delivery

Version One may use polling:

```http
GET /api/v1/claims/{claimId}
```

Recommended polling interval:

```text
2–5 seconds while pending
```

Future versions may use:

- Server-Sent Events.
- WebSockets.
- Push notifications.

Polling is simpler for the first release.

---

# 23. Claim Code Architecture

## 23.1 Generation

Claim Codes are generated using a cryptographically secure random source.

Plain-text codes are returned once.

The database stores only hashes.

## 23.2 QR Codes

A QR code contains a claim URL.

Example:

```text
https://openbadge.example.com/claim/D9N7-M4K2-P8Q1
```

The QR image itself need not be persisted.

It may be generated:

- Client-side.
- Server-side on demand.
- In bulk for downloadable archives.

## 23.3 Code Validation

Validation must be repeated inside the Claim transaction.

A successful earlier validation does not reserve the code.

## 23.4 Enumeration Protection

Controls:

- High-entropy codes.
- Rate limiting.
- Generic invalid responses.
- No sequential values.
- No logging.
- Optional CAPTCHA after suspicious activity.

---

# 24. Gallery Architecture

## 24.1 Read Model

The Gallery is assembled from:

- Indexed Token Balances.
- Event.
- Organization.
- Metadata.
- Optional current chain checks.

## 24.2 Query Path

```text
Wallet address
        ↓
Indexed balances
        ↓
Contract + token IDs
        ↓
Event records
        ↓
Organization records
        ↓
Metadata and artwork
        ↓
Gallery response
```

## 24.3 Freshness

Gallery responses should include index freshness.

The frontend may show:

```text
Synced through block 33,114,500
```

when appropriate.

## 24.4 Verification Link

Every Gallery item should link to direct credential verification.

---

# 25. Credential Verification Architecture

## 25.1 Fast Verification

Uses:

- Indexed events.
- Indexed balances.
- Known contract registry.
- Cached metadata.

This is fast but depends on index freshness.

## 25.2 Canonical Verification

Queries the blockchain directly.

Checks:

- Contract code.
- Token existence.
- Wallet balance.
- Mint event.
- Current canonical block.
- Revocation or burn effects.

## 25.3 Verification Response

The response should identify assurance:

```text
indexed
canonical_chain
```

## 25.4 Availability Tradeoff

If blockchain RPC is temporarily unavailable:

- Indexed verification may still be returned.
- It must be labeled as indexed.
- The system must not claim a new canonical check was performed.

---

# 26. Event Publication Consistency

Event publication spans database, storage and blockchain systems.

It cannot be one distributed ACID transaction.

The architecture therefore uses a state machine and reconciliation.

## 26.1 Saga Pattern

```text
Prepare metadata
        ↓
Publish metadata
        ↓
Create badge
        ↓
Persist token ID
        ↓
Freeze metadata
        ↓
Mark Event published
```

Every step is:

- Idempotent.
- Retryable where possible.
- Persisted.
- Audited.

## 26.2 Compensation

Published immutable metadata cannot always be deleted.

Compensation means:

- Keep the Event unpublished.
- Stop the workflow.
- Allow a corrected retry.
- Preserve evidence of previous attempts.

It does not mean rewriting blockchain history.

---

# 27. Failure Handling

## 27.1 Database Unavailable

- API returns `503`.
- Workers pause or retry.
- No transaction submission should occur if Mint Operation state cannot be persisted safely.

## 27.2 Queue Unavailable

- API commits Claim and outbox message.
- Outbox dispatcher retries later.
- Claim remains queued.

## 27.3 Object Storage Unavailable

- Upload or publication fails safely.
- Event remains draft or publication failed.
- No badge should be created with missing metadata.

## 27.4 RPC Unavailable

- Reads may use fallback RPC.
- Mint jobs retry.
- Claim remains queued or minting.
- API must not mark mint failed immediately for temporary provider errors.

## 27.5 Signer Unavailable

- Mint jobs retry with backoff.
- No private key fallback should be embedded in the API.

## 27.6 Indexer Delayed

- Mint Worker may validate receipts directly.
- Gallery freshness is exposed.
- Reconciliation catches delayed projections.

## 27.7 Application Restart

Persistent queue, outbox and database state allow processing to continue.

No critical workflow should depend only on process memory.

---

# 28. Retry Strategy

Retryable errors:

- RPC timeout.
- RPC rate limit.
- Temporary storage failure.
- Queue connectivity failure.
- Pending transaction receipt.
- Temporary signer service failure.

Non-retryable errors:

- Invalid recipient.
- Badge does not exist.
- Metadata not frozen.
- Maximum supply reached.
- Duplicate historical issuance.
- Unauthorized role.
- Transaction reverted due to permanent contract rule.

Use exponential backoff with jitter.

Example:

```text
10 seconds
30 seconds
2 minutes
5 minutes
15 minutes
1 hour
```

Maximum retries depend on job type.

Failed jobs move to a dead-letter queue for inspection.

---

# 29. Idempotency Architecture

## 29.1 API Writes

The API stores:

```text
Idempotency key
Authenticated actor
Route
Request hash
Response status
Response body reference
Expiration
```

## 29.2 Worker Jobs

Jobs use natural idempotency keys.

Examples:

```text
mint:claim:{claimId}
publish:event:{eventId}
index:{chainId}:{contract}:{fromBlock}:{toBlock}
```

## 29.3 Blockchain Submission

A Mint Operation must exist before or atomically with transaction submission state.

The system should track:

- Signer address.
- Nonce.
- Transaction hash.
- Replacement transaction hash.
- Submission timestamp.

---

# 30. Observability

## 30.1 Logs

Structured logs should include:

- Request ID.
- Job ID.
- Claim ID.
- Event ID.
- Mint Operation ID.
- Chain ID.
- Transaction hash.
- Worker name.
- Duration.
- Error code.

Logs must not include:

- Plain Claim Codes.
- Private keys.
- Raw session tokens.
- Wallet signatures.
- Authentication nonces.
- Storage signed URLs after use.

## 30.2 Metrics

Recommended metrics:

```text
HTTP request count
HTTP latency
HTTP error rate
Claims accepted
Claims rejected
Mint jobs queued
Mint submissions
Mint confirmations
Mint failures
Pending transaction age
Indexer block lag
Reorganization count
RPC error rate
Queue depth
Dead-letter count
Outbox backlog
Storage upload failures
Verification latency
```

## 30.3 Alerts

Recommended alerts:

- Queue backlog above threshold.
- Pending mint older than threshold.
- Indexer lag above threshold.
- Repeated RPC failures.
- Signer unavailable.
- Database connection exhaustion.
- Unexpected role changes.
- Contract paused.
- Unauthorized on-chain mint observed.
- Reorganization affecting confirmed Claims.

## 30.4 Tracing

Distributed tracing is optional for initial deployment but useful across:

```text
API
Queue
Worker
RPC
Indexer
```

Use correlation IDs even without full tracing.

---

# 31. Security Boundaries

## 31.1 Public Boundary

Internet-accessible:

- Frontend.
- Public API.
- Public media.
- Public metadata.
- Optional public verification endpoints.

## 31.2 Private Boundary

Not publicly accessible:

- PostgreSQL.
- Redis or queue.
- Signer.
- Worker administrative endpoints.
- Internal object storage control plane.
- Monitoring dashboards.
- Database backups.

## 31.3 Blockchain Boundary

Public but untrusted input:

- Contract logs.
- Wallet addresses.
- Transaction input.
- Metadata URIs.
- Smart contract recipient callbacks.

Every value must be validated.

---

# 32. Secret Management

Secrets include:

- Database credentials.
- Queue credentials.
- Session signing keys.
- Object storage credentials.
- RPC API keys.
- Signer credentials.
- Encryption keys.

Requirements:

- Never commit secrets.
- Use environment injection or secret manager.
- Separate development and production secrets.
- Rotate credentials.
- Restrict worker signer permissions.
- Back up signer material securely.
- Avoid exposing secrets to frontend build processes.

---

# 33. Network Architecture

Recommended production network segmentation:

```text
Public Network
    ├── Reverse Proxy
    ├── Frontend
    └── API

Private Application Network
    ├── Workers
    ├── Queue
    ├── PostgreSQL
    ├── Signer
    └── Monitoring

External Services
    ├── Blockchain RPC
    ├── Object Storage
    └── Optional IPFS pinning
```

Only required ports should be open.

---

# 34. Reverse Proxy

A reverse proxy should provide:

- TLS termination.
- HTTP compression.
- Request body limits.
- Rate limiting.
- Security headers.
- Routing.
- Static asset caching.
- Health checks.

Supported options:

- Nginx.
- Caddy.
- Traefik.
- Cloud load balancer.

---

# 35. Recommended Initial Deployment

A practical first self-hosted deployment:

```text
Docker Compose
├── frontend
├── api
├── worker
├── indexer
├── postgres
├── redis
├── minio
└── reverse-proxy
```

External dependencies:

```text
EVM RPC endpoint
Production signer or KMS
Optional IPFS pinning provider
```

This topology is sufficient for small and medium installations.

---

# 36. Horizontal Scaling

## 36.1 Frontend

Static or server-rendered frontend processes scale horizontally.

## 36.2 API

API processes scale horizontally because persistent state is external.

## 36.3 Workers

Workers scale by queue type.

Example:

```text
mint worker concurrency: low and controlled
metadata worker concurrency: medium
export worker concurrency: medium
indexer concurrency: one leader per contract range
```

## 36.4 Indexer

Only one active processor should own a specific:

```text
chain + contract + block range
```

Leader election or advisory locking prevents overlap.

---

# 37. Performance Targets

Initial targets:

| Operation | Target |
|---|---:|
| Public Event read | p95 under 300 ms |
| Claim validation | p95 under 500 ms |
| Claim acceptance | p95 under 800 ms |
| Gallery read from index | p95 under 700 ms |
| Indexed verification | p95 under 500 ms |
| Canonical verification | p95 under 3 seconds |
| Claim Code batch of 1,000 | background completion under 1 minute |
| Mint queue pickup | under 10 seconds during normal operation |

Blockchain confirmation time is network-dependent and excluded from HTTP latency targets.

---

# 38. Caching

## 38.1 Cacheable

- Public Organizations.
- Published Events.
- Public Galleries.
- Metadata.
- Chain configuration.

## 38.2 Not Cacheable

- Authentication.
- Claim Codes.
- Claim acceptance.
- Private Claims.
- Mint failure details.
- Organization administration.
- Idempotency responses beyond controlled storage.

## 38.3 Cache Invalidation

Event publication, pause and archive should invalidate relevant public cache entries.

Gallery caches may use short TTLs and index freshness keys.

---

# 39. Data Retention

Permanent or long-term:

- Organizations.
- Events.
- Claims.
- Mint Operations.
- Contract registry.
- Audit records according to policy.
- Published metadata references.

Expirable:

- Sessions.
- Authentication Challenges.
- Temporary uploads.
- Completed queue jobs.
- Notifications.
- Idempotency records.
- Generated exports.

Rebuildable:

- Indexed Contract Events.
- Indexed Token Balances.
- Search indexes.
- Public caches.

---

# 40. Backup and Recovery

## 40.1 Required Backups

- PostgreSQL.
- Object storage.
- Signer configuration and secure key backup.
- Contract deployment manifest.
- Environment configuration.
- Published metadata.

## 40.2 Rebuildable Data

Indexer projections can be rebuilt from:

- Registered contract addresses.
- Deployment blocks.
- Blockchain logs.

## 40.3 Recovery Order

```text
Restore PostgreSQL
        ↓
Restore object storage
        ↓
Restore secrets and signer
        ↓
Start API
        ↓
Start queue and workers
        ↓
Start indexer from checkpoint
        ↓
Run reconciliation
        ↓
Open public traffic
```

## 40.4 Recovery Verification

After recovery:

- Verify registered contract code.
- Verify Event token mappings.
- Reconcile completed Claims.
- Check queue backlog.
- Check indexer lag.
- Verify metadata availability.

---

# 41. Local Development Architecture

Recommended local environment:

```text
Frontend development server
API development server
Worker process
Indexer process
PostgreSQL container
Redis container
MinIO container
Local EVM node
```

Suggested local blockchain tools:

- Anvil.
- Hardhat Network.
- Foundry local node.

Local development should support resetting chain and database state together.

---

# 42. Environments

Recommended environments:

```text
development
test
staging
production
```

Each environment must use separate:

- Database.
- Queue.
- Storage buckets.
- Session secrets.
- Signer.
- Contract deployment.
- RPC configuration.

A staging contract must never share the production minter.

---

# 43. Configuration

Configuration categories:

## Application

```text
Public URL
API URL
Allowed origins
Session expiration
Upload limits
Default pagination
```

## Database

```text
Connection URL
Pool limits
Migration policy
```

## Queue

```text
Provider
Connection
Concurrency
Retry policy
```

## Blockchain

```text
Chain namespace
Chain ID
RPC endpoints
Confirmation depth
Contract address
Deployment block
Gas policy
```

## Signer

```text
Signer type
Signer address
KMS or keystore reference
```

## Storage

```text
Provider
Bucket
Public URL
Signed URL expiration
```

Configuration must be validated at startup.

---

# 44. Database Migrations

Database schema changes must use versioned migrations.

Requirements:

- Migrations are committed to the repository.
- Production migrations are reviewed.
- Destructive changes require backup.
- Large table changes avoid prolonged locks.
- Application versions document required schema version.

Credential projections may be rebuilt rather than migrated when that is safer.

---

# 45. Contract Deployment Artifacts

The repository should produce:

```text
ABI
bytecode
deployment script
deployment manifest
verified source metadata
compiler settings
contract addresses by environment
```

The application consumes a deployment manifest rather than hardcoding addresses in source code.

Example:

```json
{
  "version": "1.0.0",
  "chainNamespace": "eip155",
  "chainId": "8453",
  "contractAddress": "0x...",
  "deploymentBlock": "33110000",
  "deploymentTransactionHash": "0x...",
  "sourceCommit": "..."
}
```

---

# 46. Technology Boundaries

The architecture does not require one mandatory application language.

However, one installation should preferably use a coherent stack.

A reference implementation may use:

```text
Frontend: Next.js
API: Node.js / TypeScript
Database: PostgreSQL
Queue: Redis
Workers: Node.js / TypeScript
Contract: Solidity
Contract tooling: Foundry
Storage: S3 / MinIO
RPC client: viem
Containers: Docker
```

Equivalent implementations are acceptable if they preserve the documented API and contract behavior.

---

# 47. Repository Structure

Recommended monorepo:

```text
openbadge/
├── apps/
│   ├── web/
│   ├── api/
│   ├── worker/
│   └── indexer/
├── packages/
│   ├── domain/
│   ├── database/
│   ├── api-schema/
│   ├── blockchain/
│   ├── storage/
│   ├── queue/
│   └── config/
├── contracts/
│   ├── src/
│   ├── test/
│   ├── script/
│   └── deployments/
├── docs/
│   ├── README.md
│   ├── VISION.md
│   ├── PRODUCT.md
│   ├── SPEC.md
│   ├── DOMAIN.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── CONTRACT.md
│   └── ARCHITECTURE.md
├── docker/
├── migrations/
└── compose.yaml
```

---

# 48. Deployment Modes

## 48.1 Local Single-Host

Best for:

- Development.
- Testing.
- Small communities.
- Early production.

Uses Docker Compose on one server.

## 48.2 Managed Infrastructure

Best for larger installations.

Possible topology:

```text
Managed PostgreSQL
Managed Redis
Object storage
Container platform
External RPC providers
KMS signer
CDN
```

## 48.3 Fully Independent

Best for operators seeking maximum independence.

May include:

- Self-hosted PostgreSQL.
- Self-hosted MinIO.
- Self-hosted blockchain node.
- Hardware-backed signer.
- Self-hosted IPFS.
- Self-hosted monitoring.

The application architecture supports all three modes.

---

# 49. Multi-Tenancy

Version One supports multiple Organizations in one installation.

Data isolation is logical rather than database-per-tenant.

Every organization-owned query must scope by:

```text
organization_id
```

Authorization must be checked before accessing private data.

Future high-isolation deployments may use one installation per Organization without changing the contract model.

---

# 50. Privacy

OpenBadge should minimize private data collection.

Version One does not require:

- Email.
- Legal name.
- Phone number.
- Physical address.

Public data includes:

- Wallet address.
- On-chain mint.
- Event metadata.
- Contract events.

Operators must communicate that wallet participation is publicly observable.

---

# 51. Abuse Prevention

Recommended protections:

- Rate limiting.
- Claim Code entropy.
- Claim Code hashing.
- One claim per wallet.
- Contract duplicate prevention.
- Maximum supply.
- Batch limits.
- Wallet signature authentication.
- Audit logs.
- Administrative pause.
- Role isolation.
- Suspicious activity metrics.

Optional later protections:

- CAPTCHA.
- Device risk scoring.
- Allow lists.
- Geographic restrictions.
- Organizer approval queues.

---

# 52. Architectural Decision Records

Important architecture decisions should be recorded as ADRs.

Recommended initial ADRs:

```text
ADR-001 Use ERC-1155
ADR-002 One contract per installation and network
ADR-003 Non-upgradeable contracts
ADR-004 No Credential table
ADR-005 Asynchronous minting
ADR-006 Transactional outbox
ADR-007 Indexed blockchain projections
ADR-008 Wallet-signature authentication
ADR-009 Non-transferable credentials
ADR-010 Content-addressed published metadata
```

Each ADR should include:

- Context.
- Decision.
- Alternatives.
- Consequences.
- Status.

---

# 53. Version One Simplifications

To keep Version One manageable:

- One badge type per Event.
- One network per Event.
- One contract deployment selected per Event.
- One Claim per Wallet per Event.
- One unit per Wallet.
- No transfer.
- No payments.
- No royalties.
- No DAO.
- No reputation.
- No marketplace.
- No plugin system.
- Polling instead of WebSockets.
- One default queue implementation.
- One reference application stack.

---

# 54. Future Extensions

The architecture may later support:

- Multiple badge types per Event.
- Email or social authentication.
- Account abstraction.
- Gas relayers.
- Multiple credential standards.
- Non-EVM chains.
- Webhooks.
- Public SDKs.
- External issuer APIs.
- Organization SSO.
- Advanced analytics.
- Revocation registries.
- Private or zero-knowledge credentials.
- Cross-installation discovery.
- Federated Galleries.

These must not be added to Version One unless required for the core replacement.

---

# 55. Architecture Acceptance Criteria

The Version One architecture is complete when:

1. The frontend uses the documented API.
2. Claim acceptance does not wait for blockchain confirmation.
3. Database and queue consistency use an outbox or equivalent reliable pattern.
4. Workers are idempotent.
5. The signer is isolated from the public API.
6. One contract supports many Events.
7. Credentials can be reconstructed without a Credential table.
8. Gallery data is rebuildable from blockchain events.
9. The indexer handles reorganizations.
10. Reconciliation detects application-chain mismatches.
11. Published metadata is durable.
12. The system can recover from process restarts.
13. A complete installation can run through Docker Compose.
14. Production components can scale independently.
15. Secrets remain outside source code.
16. Public and private network boundaries are defined.
17. Contract deployments are reproducible.
18. Core operations are observable.
19. The installation remains useful without a central OpenBadge service.
20. The architecture stays focused on Event participation credentials.

---

# 56. Final Architecture

```text
                            USERS
                   ┌──────────┴──────────┐
                   │                     │
              Organizer              Attendee
                   │                     │
                   └──────────┬──────────┘
                              ▼
                       Web Frontend
                              │
                              ▼
                          Public API
          ┌───────────────────┼────────────────────┐
          │                   │                    │
          ▼                   ▼                    ▼
     PostgreSQL          Object Storage        Outbox
          ▲                                        │
          │                                        ▼
          │                                      Queue
          │                                        │
          │                         ┌──────────────┼─────────────┐
          │                         │              │             │
          │                         ▼              ▼             ▼
          │                    Mint Worker   Metadata Worker  Export Worker
          │                         │
          │                         ▼
          │                    Secure Signer
          │                         │
          │                         ▼
          │                    Blockchain RPC
          │                         │
          │                         ▼
          │                 OpenBadge ERC-1155
          │                         │
          │                         ▼
          │                       Logs
          │                         │
          │                         ▼
          └──────────────────── Blockchain Indexer
                                    │
                                    ▼
                              Read Projections
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                       Gallery           Verification
```

---

# 57. Final Principle

OpenBadge must remain operable even when individual components fail temporarily.

The API manages workflows.

PostgreSQL manages application state.

The queue manages asynchronous delivery.

Workers manage long-running operations.

Object storage manages media and metadata.

The smart contract enforces permanent credential rules.

The blockchain preserves issued credentials.

The indexer makes blockchain state usable.

Reconciliation keeps every layer honest.
