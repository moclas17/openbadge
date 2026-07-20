# OpenBadge Roadmap

**Version:** 1.0  
**Status:** Draft  
**Scope:** Version One MVP

---

# 1. Purpose

This roadmap converts the OpenBadge product, domain, database, API, contract and architecture decisions into an executable development plan.

The objective of Version One is to deliver a complete open-source replacement for the core POAP experience:

- Organizers create Events.
- Organizers publish artwork and metadata.
- Organizers generate Claim Codes and QR codes.
- Attendees authenticate with a Wallet.
- Attendees claim one badge.
- Minting occurs asynchronously.
- Credentials are issued through one non-upgradeable ERC-1155 contract.
- Users can view badges in a public Gallery.
- Anyone can verify credentials from blockchain state.
- Independent operators can self-host the complete system.

Version One does not include:

- A DAO.
- A marketplace.
- Reputation scoring.
- Payments.
- Royalties.
- Governance.
- A plugin ecosystem.
- Cross-chain credential portability.
- Complex social features.

---

# 2. Roadmap Principles

## 2.1 Build Vertical Slices

Each phase should produce a working end-to-end capability.

Avoid building all database models first, all frontend pages second and all blockchain components last.

Preferred sequence:

```text
User interface
      ↓
API
      ↓
Database
      ↓
Queue
      ↓
Worker
      ↓
Contract
      ↓
Indexer
```

for one complete workflow at a time.

## 2.2 Keep Version One Small

When deciding between a simple implementation and an extensible system for hypothetical future requirements, prefer the simple implementation unless the future requirement is already unavoidable.

## 2.3 Secure Permanent Components First

The smart contract is non-upgradeable.

Contract behavior, tests, permissions and deployment scripts must be settled before production launch.

Application components may evolve more easily.

## 2.4 Blockchain Operations Are Asynchronous

No product flow should depend on keeping an HTTP request open until a transaction confirms.

## 2.5 Every Phase Must Be Demonstrable

Each milestone ends with a demo, test or deployment that proves the phase works.

---

# 3. Delivery Strategy

The recommended delivery is divided into nine phases:

```text
Phase 0 — Foundation and Decisions
Phase 1 — Contract Prototype
Phase 2 — Application Foundation
Phase 3 — Event Management
Phase 4 — Claim Codes and Claim Flow
Phase 5 — Asynchronous Minting
Phase 6 — Indexer, Gallery and Verification
Phase 7 — Hardening and Self-Hosting
Phase 8 — Testnet Release
Phase 9 — Mainnet-Ready Version One
```

---

# 4. Phase 0 — Foundation and Decisions

## Objective

Prepare the repository, development standards and implementation boundaries before feature development begins.

## Scope

- Finalize documentation.
- Select the reference stack.
- Create repository structure.
- Define coding standards.
- Establish CI.
- Establish environment strategy.
- Create initial ADRs.
- Define issue and pull request workflow.

## Deliverables

### Documentation

Complete and review:

```text
README.md
VISION.md
PRODUCT.md
SPEC.md
DOMAIN.md
DATABASE.md
API.md
CONTRACT.md
ARCHITECTURE.md
ROADMAP.md
CONTRIBUTING.md
```

### Initial ADRs

Create:

```text
ADR-001 Use ERC-1155
ADR-002 One contract per installation and network
ADR-003 Non-upgradeable contract
ADR-004 No Credential table
ADR-005 Asynchronous minting
ADR-006 Transactional outbox
ADR-007 Wallet-signature authentication
ADR-008 Indexed Gallery projections
ADR-009 Non-transferable badges
ADR-010 Content-addressed metadata
```

### Repository

Create the initial monorepo:

```text
apps/
packages/
contracts/
docs/
docker/
migrations/
```

### Tooling

Recommended baseline:

```text
Node.js
TypeScript
Next.js
PostgreSQL
Redis
Foundry
Solidity
viem
Docker
Docker Compose
```

### Quality Controls

Configure:

- Type checking.
- Linting.
- Formatting.
- Unit test runner.
- Contract tests.
- Commit checks.
- CI workflow.
- Dependency update policy.
- Secret scanning.

## Acceptance Criteria

- Repository builds from a clean checkout.
- CI passes.
- Development environment starts with one command.
- Documentation decisions do not contradict each other.
- ADRs are committed.
- No production secrets exist in the repository.

## Estimated Effort

```text
3–5 working days
```

---

# 5. Phase 1 — Contract Prototype

## Objective

Implement and validate the OpenBadge ERC-1155 contract before coupling the application to an unstable interface.

## Scope

Implement:

- ERC-1155 base.
- AccessControl roles.
- Badge creation.
- Sequential token IDs.
- Maximum supply.
- Metadata update.
- Metadata freeze.
- Individual mint.
- Lifetime duplicate prevention.
- Batch recipient mint.
- Non-transferability.
- Revocation.
- Optional holder burn.
- Pause behavior.
- Read functions.
- Custom errors.
- Custom events.

## Contract Roles

```text
DEFAULT_ADMIN_ROLE
EVENT_MANAGER_ROLE
MINTER_ROLE
PAUSER_ROLE
REVOKER_ROLE
```

## Required Tests

### Unit Tests

- Badge creation.
- Role restrictions.
- Metadata update and freeze.
- Mint before freeze rejection.
- Duplicate mint rejection.
- Supply enforcement.
- Batch atomicity.
- Transfer rejection.
- Revocation.
- Burn.
- Pause and unpause.

### Invariant Tests

- `totalMinted` never exceeds `maxSupply`.
- `totalMinted` never decreases.
- A Wallet is issued a token ID at most once.
- Frozen metadata never changes.
- Wallet-to-wallet transfers never succeed.
- Token IDs never collide.

### Fuzz Tests

- Batch sizes.
- Duplicate addresses.
- Boundary supplies.
- Unknown token IDs.
- Reentrant recipient contracts.

## Deployment Tools

Create:

- Local deployment script.
- Testnet deployment script.
- Role assignment script.
- Source verification script.
- Deployment manifest generator.

## Deliverables

```text
contracts/src/OpenBadge.sol
contracts/test/
contracts/script/
contracts/deployments/
ABI artifact
deployment manifest schema
gas snapshot
```

## Acceptance Criteria

- All unit, fuzz and invariant tests pass.
- Slither has no unresolved high-severity findings.
- Contract deploys locally.
- Contract source verifies on a public testnet.
- A test badge can be created, frozen, minted and revoked.
- Transfers between wallets revert.
- The deployment manifest is consumed by a simple script.

## Decision Gate

Before leaving this phase, explicitly decide whether holder burn remains in V1.

Recommended default:

```text
Keep holder burn.
Preserve historical issuance.
Do not allow reissuance.
```

## Estimated Effort

```text
1–2 weeks
```

---

# 6. Phase 2 — Application Foundation

## Objective

Create the application skeleton, persistence model and authentication flow.

## Scope

- Frontend shell.
- API shell.
- PostgreSQL schema.
- Database migrations.
- Configuration package.
- Wallet authentication.
- Sessions.
- User and Wallet models.
- Organization and Membership models.
- Error format.
- Logging.
- Health endpoints.
- Docker development environment.

## Database Entities

Implement:

```text
User
Wallet
Organization
OrganizationMembership
AuthenticationChallenge
Session
AuditLog
```

Prepare placeholders for:

```text
Event
Media
ClaimCodeBatch
ClaimCode
Claim
MintOperation
ContractDeployment
OutboxMessage
IndexedContractEvent
ChainSyncState
IndexedTokenBalance
```

## Authentication Flow

Implement:

```text
POST /auth/challenges
POST /auth/verify
GET /auth/session
DELETE /auth/session
```

Use a standardized EVM sign-in message format where practical.

## Organization Flow

Implement:

- Create Organization.
- Read Organization.
- Update Organization.
- List memberships.
- Invite or directly add members according to V1 policy.
- Enforce owner, organizer and viewer roles.

## Infrastructure

Docker Compose should start:

```text
web
api
postgres
redis
minio
```

Workers and indexer may be placeholder processes at this stage.

## Acceptance Criteria

- User can connect a Wallet and sign in.
- Session persists securely.
- User can create an Organization.
- Organization authorization is enforced server-side.
- Migrations run from a clean database.
- API health checks work.
- Structured logs contain request IDs.
- Development environment starts from documented instructions.

## Estimated Effort

```text
1–2 weeks
```

---

# 7. Phase 3 — Event Management

## Objective

Allow organizers to create and prepare Events before blockchain publication.

## Scope

- Event CRUD.
- Artwork upload.
- Media validation.
- Organization ownership.
- Event lifecycle.
- Draft preview.
- Supply configuration.
- Claim period configuration.
- Metadata preview.
- Contract deployment registry.

## Database Entities

Implement:

```text
Event
Media
ContractDeployment
```

## Event States

Recommended initial states:

```text
draft
publishing
published
paused
archived
publication_failed
```

Internal publication substates may be added later.

## Event Fields

Minimum:

```text
organization_id
name
slug
description
start_at
end_at
timezone
location_name
external_url
artwork_media_id
banner_media_id
max_supply
claim_start_at
claim_end_at
status
chain_namespace
chain_id
contract_address
token_id
metadata_uri
published_at
```

## Media Upload

Implement:

- Signed upload URL.
- File type restrictions.
- File size restrictions.
- Image dimension validation.
- Checksum.
- Upload confirmation.
- Media ownership.

## Metadata Preview

Before publication, show the exact metadata JSON that will be published.

## Contract Registry

Allow installation administrators to register the deployed V1 contract:

```text
chain
chain ID
contract address
deployment block
version
enabled
```

## Acceptance Criteria

- Organizer can create and edit a draft Event.
- Unauthorized users cannot modify the Event.
- Artwork upload works through object storage.
- Invalid files are rejected.
- Metadata preview is deterministic.
- Event cannot be published when required fields are missing.
- Public users cannot see draft Events.

## Estimated Effort

```text
1–2 weeks
```

---

# 8. Phase 4 — Claim Codes and Claim Flow

## Objective

Implement the attendee-facing Claim experience without blockchain minting yet.

## Scope

- Claim Code batch generation.
- Secure code hashing.
- CSV export.
- QR generation.
- Public Claim page.
- Claim validation.
- Wallet authentication.
- Duplicate prevention.
- Supply reservation.
- Claim creation.
- Claim status page.
- Transactional outbox.

## Database Entities

Implement:

```text
ClaimCodeBatch
ClaimCode
Claim
OutboxMessage
IdempotencyRecord
```

## Claim Code Rules

- Generated with cryptographically secure randomness.
- Plain text returned only during generation/export.
- Stored as hashes.
- Never logged.
- Can be single-use or multi-use according to batch policy.
- Can be revoked.
- Can expire.
- Belongs to one Event.

## Claim Transaction

In one database transaction:

```text
Lock Claim Code
Validate Event
Validate claim window
Validate Event status
Validate Wallet has no Claim
Validate available reserved supply
Create Claim
Consume Claim Code
Reserve supply
Insert Outbox Message
Commit
```

## Claim States

Recommended:

```text
pending
queued
minting
completed
failed
cancelled
```

During this phase, Claims may stop at `queued`.

## Frontend Experience

```text
Scan QR
      ↓
See Event
      ↓
Connect Wallet
      ↓
Authenticate
      ↓
Confirm Claim
      ↓
See Pending status
```

## Acceptance Criteria

- Organizer can generate a batch of codes.
- Plain codes are not recoverable from the database.
- QR claim links work on mobile.
- One Wallet cannot create two Claims for the same Event.
- Two concurrent requests cannot consume the same single-use code.
- Event supply reservation is concurrency-safe.
- Claim acceptance creates an outbox message.
- Retrying the same request with an idempotency key does not create a duplicate Claim.

## Estimated Effort

```text
1–2 weeks
```

---

# 9. Phase 5 — Asynchronous Minting

## Objective

Connect accepted Claims to the smart contract through reliable asynchronous processing.

## Scope

- Outbox dispatcher.
- Queue.
- Mint Worker.
- Secure signer.
- Mint Operation persistence.
- Transaction submission.
- Receipt polling.
- Confirmation depth.
- Error classification.
- Retry policy.
- Administrative retry.
- Event publication worker.

## Database Entities

Implement:

```text
MintOperation
QueueJob or provider mapping
OutboxMessage delivery status
```

## Mint Operation States

Recommended:

```text
created
submitting
submitted
confirming
confirmed
failed
replaced
reconciliation_required
```

## Mint Flow

```text
Claim accepted
      ↓
Outbox published
      ↓
Mint job received
      ↓
Mint Operation created
      ↓
Transaction submitted
      ↓
Receipt found
      ↓
Expected event validated
      ↓
Confirmation depth reached
      ↓
Claim completed
```

## Publication Flow

Implement asynchronous Event publication:

```text
Generate final metadata
      ↓
Publish metadata
      ↓
Call createBadge
      ↓
Store token ID
      ↓
Call freezeMetadata
      ↓
Confirm
      ↓
Mark Event published
```

## Signer

Support one reference signer mode for V1.

Recommended development mode:

```text
Encrypted local keystore
```

Recommended production mode:

```text
KMS, Vault or isolated remote signer
```

## Error Classification

Retryable:

- RPC timeout.
- Rate limit.
- Pending receipt.
- Temporary signer failure.
- Temporary queue failure.

Permanent:

- Maximum supply reached.
- Duplicate historical issuance.
- Unknown token.
- Metadata not frozen.
- Unauthorized minter.
- Reverted contract rule.

## Acceptance Criteria

- Publishing an Event creates and freezes one on-chain badge.
- An accepted Claim eventually mints exactly one badge.
- HTTP Claim response returns before blockchain confirmation.
- Worker restart does not duplicate minting.
- Queue redelivery does not duplicate minting.
- A successful mint marks Claim completed.
- A reverted mint is classified and visible.
- The minter key is unavailable to the frontend and API.
- Pending transactions can be reconciled after process restart.

## Estimated Effort

```text
2–3 weeks
```

---

# 10. Phase 6 — Indexer, Gallery and Verification

## Objective

Make issued credentials discoverable and independently verifiable.

## Scope

- Blockchain indexer.
- Chain Sync State.
- Indexed Contract Events.
- Indexed Token Balances.
- Reorganization handling.
- Public Wallet Gallery.
- Event badge holders count.
- Credential detail.
- Indexed verification.
- Canonical verification.
- Metadata caching.
- Reconciliation Worker.

## Indexed Events

At minimum:

```text
BadgeCreated
BadgeMetadataUpdated
BadgeMetadataFrozen
BadgeMinted
BadgeRevoked
TransferSingle
RoleGranted
RoleRevoked
Paused
Unpaused
```

## Indexer Requirements

- Starts from contract deployment block.
- Processes configurable block ranges.
- Uses unique transaction hash plus log index.
- Stores block hashes.
- Detects reorganizations.
- Rebuilds projections.
- Exposes sync lag.

## Gallery

Implement:

```text
GET /galleries/{chainNamespace}/{chainId}/{walletAddress}
```

Gallery response includes:

- Event.
- Organization.
- Artwork.
- Contract.
- Token ID.
- Wallet.
- Mint transaction.
- Current validity.
- Verification URL.

## Credential Verification

Implement both:

```text
Indexed verification
Canonical blockchain verification
```

Canonical verification checks:

- Contract.
- Token existence.
- Wallet balance.
- Mint event.
- Current chain.
- Burn or revocation.

## Reconciliation

Detect:

- Completed Claim without on-chain evidence.
- On-chain mint without Claim.
- Transaction receipt without expected event.
- Reorganized confirmation.
- Unexpected role change.
- Unexpected revocation.
- Unexpected contract pause.

## Acceptance Criteria

- New mints appear in the Gallery after indexing.
- Gallery is rebuilt from an empty projection database.
- Revoked or burned credentials disappear from valid balances.
- Direct verification works without a Credential table.
- Reorganization test rolls back and rebuilds affected state.
- Indexer can resume after restart.
- Verification reports whether evidence is indexed or directly checked.
- Metadata outage does not mark an on-chain credential invalid.

## Estimated Effort

```text
2–3 weeks
```

---

# 11. Phase 7 — Hardening and Self-Hosting

## Objective

Turn the working implementation into a secure, observable and maintainable self-hosted product.

## Scope

- Production Docker images.
- Docker Compose deployment.
- Reverse proxy.
- TLS documentation.
- Secret management guidance.
- Backups.
- Restore procedure.
- Rate limiting.
- Audit logs.
- Metrics.
- Alerts.
- Dead-letter tools.
- Administrative operations.
- Security review.
- Documentation.

## Deployment Package

Provide:

```text
compose.yaml
.env.example
production configuration guide
database migration command
contract deployment command
backup scripts
restore scripts
health checks
```

## Observability

Metrics:

- Claim acceptance.
- Queue depth.
- Mint latency.
- Mint failure.
- Pending transaction age.
- Indexer lag.
- RPC failure.
- Outbox backlog.
- Reorganization count.

Alerts:

- Signer unavailable.
- Queue backlog.
- Indexer stalled.
- Unexpected role change.
- Contract paused.
- Database unavailable.
- Repeated mint failures.

## Security

Implement:

- Rate limiting.
- CORS.
- CSRF protection where applicable.
- Secure cookies.
- Request body limits.
- Upload validation.
- Redacted logs.
- Dependency scanning.
- Container non-root users.
- Database least privilege.
- Network isolation.
- Admin endpoint protection.

## Backups

Document and test:

- PostgreSQL backup.
- Object storage backup.
- Contract manifest backup.
- Signer recovery.
- Restore and reconciliation.

## Acceptance Criteria

- A new operator can deploy from documentation.
- Production services restart automatically.
- Database and object storage backups restore successfully.
- Index projections rebuild from chain.
- No plaintext Claim Codes appear in logs or database.
- The API runs without the minter key.
- Monitoring exposes all critical failure states.
- Security checklist is complete.
- Self-hosted demo survives a full restart.

## Estimated Effort

```text
2 weeks
```

---

# 12. Phase 8 — Testnet Release

## Objective

Release OpenBadge publicly on a testnet and validate real event workflows.

## Scope

- Public testnet contract.
- Public reference deployment.
- Organizer onboarding.
- At least one real test Event.
- Mobile Claim testing.
- Load testing.
- Feedback collection.
- Bug triage.
- Documentation improvements.
- External contract review.

## Pilot Events

Run at least:

```text
Small Event: 20–50 Claims
Medium Event: 100–300 Claims
Stress simulation: 1,000+ Claim attempts
```

## Test Scenarios

- QR scans from multiple mobile devices.
- Concurrent claims.
- Expired code.
- Reused code.
- Duplicate Wallet.
- RPC outage.
- Queue outage.
- Worker restart.
- Indexer delay.
- Transaction replacement.
- Contract pause.
- Revocation.
- Metadata unavailability.

## Load Testing

Measure:

- Claim acceptance throughput.
- Database locking behavior.
- Queue pickup latency.
- Worker concurrency.
- RPC rate limit behavior.
- Gallery performance.
- Indexer catch-up speed.

## Feedback Areas

- Organizer setup difficulty.
- Artwork workflow.
- Claim Code export usability.
- Attendee Wallet friction.
- Pending status clarity.
- Gallery usefulness.
- Verification clarity.
- Self-hosting documentation.

## Acceptance Criteria

- At least one full Event completes successfully.
- No duplicate credential is issued.
- All failed Claims have understandable status.
- Testnet deployment is reproducible.
- Pilot issues are triaged.
- Critical and high-severity bugs are fixed.
- Contract receives an independent review or audit-ready review.
- Documentation allows a second operator to deploy independently.

## Estimated Effort

```text
2–4 weeks
```

---

# 13. Phase 9 — Mainnet-Ready Version One

## Objective

Prepare the first stable production release.

## Scope

- Final contract review.
- Production contract deployment.
- Release candidate.
- Mainnet deployment manifest.
- Versioned Docker images.
- Upgrade and migration policy.
- Support policy.
- Vulnerability disclosure policy.
- Final operator documentation.
- Release notes.

## Contract Release

Before mainnet:

- Freeze contract interface.
- Pin compiler.
- Pin OpenZeppelin version.
- Publish source commit.
- Run complete tests.
- Run static analysis.
- Complete independent review.
- Verify constructor and role assignments.
- Verify source on explorer.
- Publish ABI and bytecode hashes.

## Application Release

Publish:

```text
v1.0.0
```

Include:

- Database migrations.
- Docker image versions.
- Configuration reference.
- Deployment guide.
- Backup guide.
- Recovery guide.
- Contract addresses.
- Known limitations.
- Security contact.

## Acceptance Criteria

- Production contract is verified.
- Admin roles use multisig or documented secure equivalent.
- Minter role uses an isolated signer.
- Mainnet Event can be published.
- Claims mint correctly.
- Gallery and verification work.
- Backup and restore are tested.
- No critical or high-severity issue remains.
- Release artifacts are reproducible.
- Version One scope is complete.

## Estimated Effort

```text
1–2 weeks after testnet stabilization
```

---

# 14. Recommended Release Milestones

## Milestone 0.1 — Contract Alpha

Includes:

- Contract implementation.
- Local deployment.
- Unit tests.
- Single badge creation.
- Single mint.
- Non-transferability.

## Milestone 0.2 — Organizer Alpha

Includes:

- Wallet login.
- Organizations.
- Event drafts.
- Artwork upload.
- Metadata preview.

## Milestone 0.3 — Claim Alpha

Includes:

- Claim Codes.
- QR flow.
- Claim acceptance.
- Pending status.
- No blockchain mint yet.

## Milestone 0.4 — Mint Alpha

Includes:

- Event publication.
- Queue.
- Worker.
- Testnet mint.
- Claim completion.

## Milestone 0.5 — Gallery Alpha

Includes:

- Indexer.
- Gallery.
- Verification.
- Reconciliation.

## Milestone 0.9 — Public Testnet Beta

Includes:

- Self-hosting.
- Monitoring.
- Pilot Events.
- Bug fixes.
- Contract review.

## Milestone 1.0 — Production Release

Includes:

- Mainnet contract.
- Stable API.
- Stable database migrations.
- Operator deployment package.
- Security documentation.

---

# 15. Suggested Implementation Order

A practical issue order:

```text
1. Monorepo and CI
2. Contract implementation
3. Contract tests
4. Local deployment manifest
5. PostgreSQL migrations
6. Wallet authentication
7. Organizations
8. Event drafts
9. Media upload
10. Contract registry
11. Event publication
12. Claim Code generation
13. Public Claim page
14. Claim transaction
15. Transactional outbox
16. Queue
17. Mint Worker
18. Mint confirmation
19. Indexer
20. Gallery
21. Verification
22. Reconciliation
23. Docker production deployment
24. Monitoring
25. Testnet pilot
26. Security review
27. Mainnet release
```

---

# 16. Workstreams

Several workstreams may proceed in parallel after the contract interface stabilizes.

## Smart Contract

- Solidity implementation.
- Tests.
- Deployment.
- Security review.

## Backend

- API.
- Domain logic.
- Database.
- Queue.
- Workers.
- Indexer.

## Frontend

- Authentication.
- Organizer dashboard.
- Claim flow.
- Gallery.
- Verification.

## Infrastructure

- Docker.
- CI.
- Storage.
- Monitoring.
- Backups.
- Deployment.

## Documentation

- Operator guides.
- API examples.
- Contribution guide.
- Security guide.
- Pilot guide.

---

# 17. Minimum Team

A small experienced team could deliver Version One with:

```text
1 full-stack/backend engineer
1 frontend engineer
1 smart contract engineer
1 product/design contributor
1 DevOps/security contributor part-time
```

For a solo implementation, the same phases apply but should be completed sequentially.

---

# 18. Rough Timeline

For a small experienced team:

| Phase | Estimated Duration |
|---|---:|
| Phase 0 | 1 week |
| Phase 1 | 1–2 weeks |
| Phase 2 | 1–2 weeks |
| Phase 3 | 1–2 weeks |
| Phase 4 | 1–2 weeks |
| Phase 5 | 2–3 weeks |
| Phase 6 | 2–3 weeks |
| Phase 7 | 2 weeks |
| Phase 8 | 2–4 weeks |
| Phase 9 | 1–2 weeks |

Total estimated calendar time with some parallel work:

```text
12–18 weeks
```

For a solo developer:

```text
18–28 weeks
```

These estimates assume the Version One scope remains controlled.

---

# 19. Definition of MVP

OpenBadge reaches MVP when an independent operator can:

1. Deploy the application.
2. Deploy one OpenBadge ERC-1155 contract.
3. Register the contract.
4. Authenticate with a Wallet.
5. Create an Organization.
6. Create an Event.
7. Upload artwork.
8. Publish immutable metadata.
9. Create and freeze the Event token ID.
10. Generate Claim Codes.
11. Share a QR code.
12. Accept an attendee Claim.
13. Mint asynchronously.
14. Display the completed Claim.
15. Display the credential in a Gallery.
16. Verify it from canonical blockchain state.
17. Rebuild Gallery projections from contract logs.

---

# 20. Version One Cut Line

Features below the line are not required for Version One:

```text
----------------------------------------
Multiple badge types per Event
Transfers
Payments
Royalties
Marketplace
DAO
Reputation
Social graph
Comments
Reactions
Referral systems
Cross-chain bridging
Mobile native apps
Email marketing
Complex analytics
White-label theme marketplace
Plugin framework
Federated discovery protocol
Zero-knowledge attendance
----------------------------------------
```

Any addition below the cut line requires an explicit scope decision.

---

# 21. Risks

## 21.1 Scope Expansion

Risk:

The project becomes a generalized credential protocol before replacing the basic POAP experience.

Mitigation:

- Maintain the Version One cut line.
- Require ADR for scope expansion.
- Prioritize end-to-end Event claims.

## 21.2 Contract Defect

Risk:

The non-upgradeable contract contains an irreversible bug.

Mitigation:

- Keep contract small.
- Strong tests.
- Independent review.
- Testnet pilot.
- Deploy new version rather than proxy.

## 21.3 Signer Compromise

Risk:

An attacker obtains `MINTER_ROLE`.

Mitigation:

- Isolated signer.
- Role separation.
- Pause role.
- Monitoring.
- Multisig administration.
- Transparent revocation.

## 21.4 Duplicate Minting

Risk:

Queue retry or worker concurrency produces multiple mints.

Mitigation:

- Contract lifetime issuance guard.
- Worker idempotency.
- Database locks.
- Mint Operation tracking.
- Reconciliation.

## 21.5 RPC Dependency

Risk:

External provider outage blocks minting or verification.

Mitigation:

- Multiple endpoints.
- Retry.
- Fallback reads.
- Optional self-hosted node.
- Indexed verification.

## 21.6 Metadata Loss

Risk:

Artwork or metadata becomes unavailable.

Mitigation:

- Content-addressed storage.
- Multiple pins.
- Checksums.
- Operator backups.
- Metadata availability monitoring.

## 21.7 Indexer Errors

Risk:

Gallery state differs from blockchain.

Mitigation:

- Rebuildable projections.
- Reorganization handling.
- Canonical verification.
- Reconciliation.

## 21.8 Self-Hosting Complexity

Risk:

Independent operators cannot deploy the project reliably.

Mitigation:

- Docker Compose.
- One reference stack.
- Environment validation.
- Deployment checklist.
- Tested restore process.

---

# 22. Testing Strategy by Release Stage

## Continuous Integration

Every commit:

- Type checking.
- Lint.
- Unit tests.
- Contract tests.
- Migration validation.
- Build.
- Secret scan.

## Pull Requests

Require:

- Relevant tests.
- Documentation updates.
- Migration review.
- API compatibility review.
- Contract gas snapshot review when applicable.

## Testnet Release

Require:

- End-to-end tests.
- Load tests.
- Recovery tests.
- Reorganization tests.
- Security checklist.
- External review.

## Production Release

Require:

- Release candidate freeze.
- Complete regression test.
- Reproducible build.
- Backup verification.
- Deployment rehearsal.
- Contract verification.
- Role verification.

---

# 23. Operational Readiness Checklist

Before public production use:

```text
[ ] PostgreSQL backups configured
[ ] Object storage backups configured
[ ] Signer backup and recovery documented
[ ] Admin role uses multisig
[ ] Minter role isolated
[ ] Contract source verified
[ ] Deployment manifest published
[ ] Queue monitoring enabled
[ ] Indexer lag monitoring enabled
[ ] RPC fallback configured
[ ] Dead-letter workflow documented
[ ] Reconciliation scheduled
[ ] Rate limiting enabled
[ ] Logs redact secrets
[ ] Incident response documented
[ ] Restore test completed
[ ] Pilot Event completed
```

---

# 24. Contribution Roadmap

External contributors should be able to select work from clear labels.

Recommended issue labels:

```text
area:contract
area:api
area:web
area:database
area:indexer
area:worker
area:infra
area:docs
type:bug
type:feature
type:security
type:test
good first issue
help wanted
blocked
needs decision
```

Each roadmap phase should have a GitHub milestone.

---

# 25. Post-Version-One Candidates

After Version One is stable, evaluate:

## Near-Term

- Webhooks.
- API keys for organizers.
- Better analytics.
- Multiple contract deployments.
- Bulk attendee import.
- Email claim links.
- Embeddable Gallery widget.
- SDKs.

## Medium-Term

- Account abstraction.
- Gas sponsorship adapters.
- Additional EVM networks.
- External issuer integrations.
- Advanced revocation policies.
- Organization branding.

## Long-Term

- Non-EVM support.
- Privacy-preserving claims.
- Federated OpenBadge discovery.
- Cross-installation credential aggregation.

None of these should delay Version One.

---

# 26. Success Metrics

Version One should measure:

## Product

- Events created.
- Events published.
- Claim Codes generated.
- Claims accepted.
- Credentials minted.
- Claim completion rate.
- Median mint completion time.
- Gallery views.
- Verification requests.

## Reliability

- Mint failure rate.
- Queue delay.
- Indexer lag.
- RPC error rate.
- Reconciliation discrepancies.
- Duplicate mint attempts prevented.
- Metadata availability.

## Adoption

- Independent installations.
- Active Organizations.
- Repeat organizers.
- External API integrations.
- Contributors.
- Successful self-hosted deployments.

---

# 27. Final Delivery Sequence

```text
Documentation
      ↓
Contract
      ↓
Authentication and Organizations
      ↓
Event Drafts
      ↓
Event Publication
      ↓
Claim Codes
      ↓
Claim Acceptance
      ↓
Async Minting
      ↓
Indexer
      ↓
Gallery
      ↓
Verification
      ↓
Self-Hosting
      ↓
Testnet Pilot
      ↓
Production V1
```

---

# 28. Final Principle

OpenBadge Version One succeeds when it replaces the essential POAP workflow with a system that any community can operate independently.

The roadmap must optimize for reaching that complete workflow.

A smaller complete product is more valuable than a broad unfinished protocol.
