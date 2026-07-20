# OpenBadge Database Design

**Version:** 1.1  
**Status:** Draft

---

# 1. Purpose

This document defines the logical data model of OpenBadge.

It describes:

- Persistent business entities.
- Relationships.
- Ownership rules.
- Operational records.
- Blockchain synchronization.
- Data integrity requirements.

The database supports the product workflow, but it is not the definitive source of truth for issued credentials.

Once minted, a Credential exists on-chain.

---

# 2. Source of Truth

OpenBadge uses different authoritative sources depending on the type of data.

## PostgreSQL

PostgreSQL is the source of truth for:

- Users.
- Wallets.
- Organizations.
- Events.
- Claim Codes.
- Claims.
- Mint operations.
- Application permissions.
- Audit records.

## Blockchain

The blockchain is the source of truth for:

- Issued credentials.
- Credential ownership.
- Token identifiers.
- Contract addresses.
- Mint transactions.
- On-chain credential state.
- Transfer history, when transfers are enabled.

## Object Storage

Object storage is the source of truth for:

- Event artwork.
- Organization logos.
- Event banners.
- Generated metadata files.

The database stores references and integrity information for those files.

---

# 3. Core Principle

A Credential is a domain concept, but it is not a primary PostgreSQL entity.

The application reconstructs a Credential using:

- Event information from PostgreSQL.
- Claim information from PostgreSQL.
- Mint operation information from PostgreSQL.
- Token and ownership data from the blockchain.
- Indexed blockchain events when available.

This avoids maintaining two competing authoritative credential records.

---

# 4. Data Categories

OpenBadge separates persisted data into four categories.

## 4.1 Business Data

Critical application information:

- Organizations.
- Users.
- Wallets.
- Events.
- Claim Codes.
- Claims.

## 4.2 Blockchain Operations

Records required to submit and monitor blockchain transactions:

- Mint Operations.
- Chain Sync State.
- Indexed Contract Events.

## 4.3 Operational Data

Temporary or supporting information:

- Sessions.
- Queue Jobs.
- Internal Notifications.
- Rate-limit records.
- Temporary uploads.

## 4.4 Assets

Binary content stored outside PostgreSQL:

- Artwork.
- Logos.
- Banners.
- Metadata JSON.

---

# 5. Domain Relationships

```text
Organization
    │
    └── owns
	    │
	    ▼
	  Event
	    │
	    ├── defines
	    │    ▼
	    │  Claim Code
	    │
	    └── receives
		    ▼
		  Claim
		    │
		    └── triggers
			    ▼
		    Mint Operation
			    │
			    └── produces
				    ▼
		    On-chain Credential
				    │
				    └── owned by
					    ▼
					  Wallet
```

---

# 6. Organization

## Purpose

Represents the entity responsible for creating and managing Events.

An Organization may represent:

- A community.
- A company.
- A university.
- A conference.
- A meetup group.
- An individual organizer.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `name` | Public organization name |
| `slug` | Unique URL-safe identifier |
| `description` | Optional public description |
| `website_url` | Optional website |
| `logo_media_id` | Optional logo reference |
| `status` | Current organization status |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |
| `deleted_at` | Soft-deletion timestamp |

## Status Values

- `active`
- `disabled`
- `archived`

## Relationships

One Organization has many Events.

Future versions may allow many Users to belong to one Organization.

## Deletion

Organizations use soft deletion.

Deleting an Organization must not remove:

- Events.
- Claims.
- Mint Operations.
- Existing on-chain credentials.

---

# 7. User

## Purpose

Represents a person with an OpenBadge application account.

A User is an application identity. It is not the same as a Wallet.

Version One authenticates Users using verified blockchain wallets.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `display_name` | Optional public name |
| `avatar_media_id` | Optional avatar |
| `status` | Account status |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |
| `deleted_at` | Soft-deletion timestamp |

## Status Values

- `active`
- `disabled`
- `deleted`

## Relationships

One User may have many Wallets.

One User may manage Events through organization permissions.

## Deletion

Users use soft deletion.

Removing a User must never remove historical Claims or blockchain records.

---

# 8. Wallet

## Purpose

Represents a verified blockchain account.

A Wallet may be used to:

- Authenticate a User.
- Receive an on-chain credential.
- Claim an Event credential.
- Display a public Gallery.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `user_id` | Optional associated User |
| `chain_namespace` | Blockchain family, such as `eip155` |
| `chain_id` | Network identifier |
| `address` | Normalized wallet address |
| `is_primary` | Whether this is the User's primary wallet |
| `verified_at` | Ownership verification timestamp |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

## Constraints

The combination below must be unique:

```text
chain_namespace
chain_id
address
```

Addresses must be stored in a normalized format.

For EVM networks, comparisons must not depend on letter casing.

## Relationships

One Wallet may have many Claims.

On-chain credentials may be owned by the Wallet, but those credentials are not stored as primary database rows.

---

# 9. Event

## Purpose

Represents an Event capable of issuing one participation credential.

The Event is the central business entity in OpenBadge.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `organization_id` | Owning Organization |
| `created_by_user_id` | User who created the Event |
| `title` | Public Event title |
| `slug` | Event URL identifier |
| `description` | Event description |
| `artwork_media_id` | Main credential artwork |
| `banner_media_id` | Optional banner |
| `location` | Physical or virtual location |
| `website_url` | Optional external URL |
| `starts_at` | Event start timestamp |
| `ends_at` | Event end timestamp |
| `claim_starts_at` | Claim window start |
| `claim_ends_at` | Claim window end |
| `chain_namespace` | Blockchain family |
| `chain_id` | Selected network |
| `contract_address` | Credential contract |
| `token_id` | ERC-1155 token identifier |
| `metadata_uri` | Published token metadata URI |
| `maximum_claims` | Maximum successful Claims |
| `status` | Event lifecycle state |
| `visibility` | Public visibility setting |
| `published_at` | Publication timestamp |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |
| `deleted_at` | Soft-deletion timestamp |

## Status Values

- `draft`
- `published`
- `paused`
- `archived`
- `deleted`

## Visibility Values

- `public`
- `unlisted`
- `private`

## Relationships

One Event belongs to one Organization.

One Event has many Claim Codes.

One Event has many Claims.

One Event may have many Mint Operations.

One Event corresponds to one ERC-1155 token ID in Version One.

## Business Rules

After publication, these values must become immutable:

- `chain_namespace`
- `chain_id`
- `contract_address`
- `token_id`
- Published artwork
- Published metadata URI

Administrative information may remain editable when it does not change the on-chain credential definition.

## Deletion

Events use soft deletion.

Deleting an Event must never destroy:

- Claims.
- Mint Operations.
- Blockchain history.
- Credential verification data.

---

# 10. Claim Code

## Purpose

Represents an authorization mechanism that allows one Wallet to create a Claim.

A Claim Code may be transported through:

- A URL.
- A QR code.
- Plain text.

The QR code itself is not stored as a business entity. It is a visual representation of a Claim Code or claim URL.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `event_id` | Associated Event |
| `code_hash` | Secure hash of the original code |
| `status` | Current code status |
| `expires_at` | Optional expiration timestamp |
| `used_at` | Successful-use timestamp |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

## Status Values

- `available`
- `reserved`
- `used`
- `expired`
- `revoked`

## Security Rule

Plain-text Claim Codes must not be stored after generation.

The database stores a secure hash.

The original code is shown or exported only when generated.

## Relationships

One Event has many Claim Codes.

One Claim Code may authorize at most one successful Claim.

## Constraints

`code_hash` must be unique.

A used or revoked Claim Code cannot be reused.

---

# 11. Claim

## Purpose

Represents a Wallet's accepted request to receive an Event credential.

A Claim exists before minting and remains as the application record of the issuance workflow.

A Claim is not the final Credential.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `event_id` | Claimed Event |
| `wallet_id` | Recipient Wallet |
| `claim_code_id` | Used Claim Code |
| `status` | Claim workflow status |
| `claimed_at` | Claim acceptance timestamp |
| `expires_at` | Optional workflow expiration |
| `failure_code` | Last known failure code |
| `failure_message` | Sanitized failure description |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

## Status Values

- `pending`
- `validated`
- `queued`
- `minting`
- `completed`
- `failed`
- `expired`
- `cancelled`

## Relationships

One Claim belongs to one Event.

One Claim belongs to one Wallet.

One Claim may reference one Claim Code.

One Claim may have multiple Mint Operations because failed minting can be retried.

Only one Mint Operation may ultimately complete successfully for a Claim.

## Constraints

Version One must enforce one successful Claim per Wallet per Event.

The following combination must be unique:

```text
event_id
wallet_id
```

This uniqueness may be implemented directly or through a partial unique constraint based on active statuses.

## Deletion

Claims must not be hard deleted.

Claims form part of the permanent issuance audit trail.

---

# 12. Mint Operation

## Purpose

Tracks one attempt to submit and confirm a blockchain mint transaction.

A Mint Operation is operational evidence of blockchain processing.

It is not the Credential itself.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `claim_id` | Associated Claim |
| `attempt_number` | Sequential attempt number |
| `chain_namespace` | Blockchain family |
| `chain_id` | Network identifier |
| `contract_address` | Target contract |
| `token_id` | ERC-1155 token identifier |
| `recipient_address` | Recipient Wallet address |
| `quantity` | Mint amount, normally `1` |
| `status` | Operation state |
| `transaction_hash` | Blockchain transaction hash |
| `transaction_nonce` | Optional account nonce |
| `block_number` | Confirmation block |
| `block_hash` | Confirmation block hash |
| `submitted_at` | Submission timestamp |
| `confirmed_at` | Confirmation timestamp |
| `last_checked_at` | Last receipt check |
| `failure_code` | Machine-readable failure |
| `failure_message` | Sanitized error details |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

## Status Values

- `queued`
- `preparing`
- `submitted`
- `confirming`
- `confirmed`
- `failed`
- `replaced`
- `cancelled`

## Relationships

One Claim may have many Mint Operations.

One confirmed Mint Operation corresponds to one credential issuance transaction.

## Constraints

The following combination must be unique when a transaction hash exists:

```text
chain_namespace
chain_id
transaction_hash
```

Only one Mint Operation for a Claim may have the `confirmed` status.

`attempt_number` must be unique within each Claim.

## Business Rules

A Claim becomes `completed` only after a Mint Operation is confirmed and the expected contract event is observed.

A successful transaction receipt alone is not enough. The system must validate the expected mint event.

---

# 13. On-Chain Credential

## Definition

An On-Chain Credential is reconstructed from blockchain state and related application data.

It is not stored as a primary PostgreSQL row.

## Reconstructed Properties

A credential representation may contain:

| Property | Source |
|---|---|
| Event | PostgreSQL Event |
| Organization | PostgreSQL Organization |
| Recipient | Blockchain ownership or mint event |
| Contract | Event and blockchain |
| Token ID | Event and blockchain |
| Transaction hash | Confirmed Mint Operation |
| Block number | Confirmed Mint Operation or blockchain |
| Mint timestamp | Blockchain block |
| Metadata URI | Smart contract or Event |
| Artwork | Event metadata |
| Status | Blockchain state |
| Verification result | Blockchain query |

## Credential Identifier

A Credential must be globally identified using:

```text
chain_namespace
chain_id
contract_address
token_id
owner_address
```

When one Wallet may hold more than one unit, quantity must also be considered.

Version One should mint a quantity of exactly one credential per successful Claim.

---

# 14. Indexed Contract Event

## Purpose

Provides a local searchable projection of relevant blockchain events.

This table is an index and cache.

It must never override blockchain truth.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal identifier |
| `chain_namespace` | Blockchain family |
| `chain_id` | Network identifier |
| `contract_address` | Contract that emitted the event |
| `event_name` | Decoded event name |
| `transaction_hash` | Source transaction |
| `block_number` | Source block |
| `block_hash` | Source block hash |
| `log_index` | Event position inside transaction |
| `token_id` | Optional decoded token ID |
| `from_address` | Optional transfer source |
| `to_address` | Optional transfer destination |
| `quantity` | Optional token quantity |
| `payload` | Additional decoded fields |
| `observed_at` | Indexing timestamp |
| `created_at` | Record timestamp |

## Constraints

The following combination must be unique:

```text
chain_namespace
chain_id
transaction_hash
log_index
```

## Usage

Indexed events may support:

- Public galleries.
- Wallet credential searches.
- Event claim counts.
- Verification pages.
- Recovery after application outages.
- Reconciliation between Claims and blockchain state.

## Rebuildability

This table must be fully rebuildable from the blockchain.

It must not contain exclusive business information.

---

# 15. Chain Sync State

## Purpose

Tracks blockchain indexer progress.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal identifier |
| `chain_namespace` | Blockchain family |
| `chain_id` | Network identifier |
| `contract_address` | Indexed contract |
| `last_processed_block` | Latest fully processed block |
| `last_processed_block_hash` | Hash used for reorganization checks |
| `status` | Sync worker status |
| `last_synced_at` | Latest successful synchronization |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

## Status Values

- `idle`
- `syncing`
- `error`
- `paused`

## Reorganization Handling

The indexer must account for blockchain reorganizations.

It must be able to:

1. Detect that a stored block hash no longer matches the canonical chain.
2. Roll back indexed events after the last valid block.
3. Reprocess affected blocks.
4. Reconcile affected Mint Operations and Claims.

---

# 16. Media

## Purpose

Stores metadata about uploaded files.

Binary file content lives in object storage.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal unique identifier |
| `storage_provider` | Storage implementation |
| `bucket` | Storage bucket or container |
| `object_key` | File location |
| `original_filename` | Sanitized original filename |
| `mime_type` | Validated media type |
| `size_bytes` | File size |
| `width` | Optional image width |
| `height` | Optional image height |
| `checksum` | Content checksum |
| `status` | Upload state |
| `created_by_user_id` | Uploading User |
| `created_at` | Creation timestamp |
| `deleted_at` | Deletion timestamp |

## Status Values

- `pending`
- `available`
- `rejected`
- `deleted`

## Deletion

A Media object may be physically deleted only when:

- No active entity references it.
- It is not part of published immutable metadata.
- The configured retention period has passed.

---

# 17. Organization Membership

Although organization management should remain simple in Version One, permissions require an explicit relationship between Users and Organizations.

## Purpose

Associates a User with an Organization and defines their role.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal identifier |
| `organization_id` | Organization |
| `user_id` | Member User |
| `role` | Membership role |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

## Role Values

- `owner`
- `organizer`
- `viewer`

## Constraints

The combination below must be unique:

```text
organization_id
user_id
```

Every Organization must have at least one active owner.

---

# 18. Session

## Purpose

Stores authenticated application sessions.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Session identifier |
| `user_id` | Authenticated User |
| `expires_at` | Expiration timestamp |
| `last_activity_at` | Last activity |
| `ip_hash` | Optional privacy-preserving IP hash |
| `user_agent` | Optional client information |
| `created_at` | Creation timestamp |

## Deletion

Sessions may be hard deleted after expiration.

---

# 19. Authentication Challenge

## Purpose

Stores one-time wallet-signature challenges.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal identifier |
| `wallet_address` | Requested Wallet |
| `chain_namespace` | Blockchain family |
| `chain_id` | Requested network |
| `nonce_hash` | Hashed random challenge |
| `message` | Message that must be signed |
| `expires_at` | Challenge expiration |
| `used_at` | Successful-use timestamp |
| `created_at` | Creation timestamp |

## Business Rules

Challenges must:

- Expire quickly.
- Be single use.
- Contain domain and origin information.
- Prevent replay attacks.

Expired challenges may be hard deleted.

---

# 20. Internal Notification

## Purpose

Stores application notifications.

Version One includes internal notifications only.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal identifier |
| `user_id` | Recipient |
| `type` | Notification category |
| `title` | Notification title |
| `body` | Notification content |
| `read_at` | Read timestamp |
| `created_at` | Creation timestamp |

Notifications are not part of credential truth.

They may be removed according to retention policy.

---

# 21. Audit Log

## Purpose

Stores security-sensitive and administrative activity.

## Example Actions

- Wallet authentication.
- Organization creation.
- Event creation.
- Event publication.
- Event pause.
- Claim Code generation.
- Claim acceptance.
- Mint submission.
- Mint confirmation.
- Mint failure.
- Permission change.
- Administrative deletion.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal identifier |
| `actor_user_id` | Optional acting User |
| `actor_wallet_id` | Optional acting Wallet |
| `action` | Machine-readable action |
| `entity_type` | Affected entity |
| `entity_id` | Affected entity identifier |
| `metadata` | Sanitized contextual data |
| `ip_hash` | Optional privacy-preserving IP hash |
| `user_agent` | Optional client information |
| `created_at` | Event timestamp |

## Deletion

Audit Logs must not be modified.

Retention duration must be configurable.

Sensitive secrets, wallet signatures and raw Claim Codes must never appear in audit metadata.

---

# 22. Queue Job

## Purpose

Tracks asynchronous application work when the selected queue implementation requires database visibility.

Examples:

- Submit mint.
- Check transaction.
- Reconcile Claim.
- Index blockchain blocks.
- Generate Claim Code exports.
- Publish metadata.

## Attributes

| Attribute | Description |
|---|---|
| `id` | Internal identifier |
| `type` | Job type |
| `entity_type` | Related entity type |
| `entity_id` | Related entity |
| `status` | Job status |
| `attempts` | Number of executions |
| `available_at` | Earliest execution time |
| `started_at` | Processing start |
| `completed_at` | Completion time |
| `failure_code` | Last failure |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

Job payloads must not contain private keys or secrets.

---

# 23. Ownership Model

The ownership and authority model is:

```text
Organization owns Event configuration.

Event defines Claim eligibility.

Wallet initiates a Claim.

Claim triggers one or more Mint Operations.

Confirmed blockchain state proves the Credential.

Wallet owns the on-chain Credential.

Gallery displays an indexed blockchain projection.
```

The database does not own or redefine the Credential.

---

# 24. Claim and Mint Transaction Boundaries

The claim workflow must use database transactions and row-level concurrency protection.

## Atomic Claim Creation

The following actions must happen atomically:

1. Lock the applicable Claim Code.
2. Validate code availability.
3. Validate Event availability.
4. Validate Event supply.
5. Validate that the Wallet has not already claimed.
6. Create the Claim.
7. Mark the Claim Code as reserved or used.
8. Reserve one unit of available supply.
9. Enqueue the mint workflow.

If any step fails, the entire transaction must roll back.

## Supply Calculation

Application supply is calculated using accepted Claims, not only confirmed blockchain mints.

This prevents multiple concurrent requests from exceeding `maximum_claims`.

## Claim Completion

The Claim becomes `completed` only when:

- A Mint Operation is confirmed.
- The correct blockchain contract event is indexed.
- The recipient, token ID and quantity match the expected values.

---

# 25. Credential Reconstruction

When the API requests a Credential, the application should:

1. Locate the Event using contract address and token ID.
2. Query indexed blockchain events.
3. Confirm canonical blockchain state when required.
4. Resolve the current Wallet owner or balance.
5. Load Event and Organization metadata.
6. Return a unified Credential representation.

The response is a read model assembled from multiple sources.

It is not a direct database entity.

---

# 26. Gallery Projection

A Gallery is generated using indexed blockchain state.

For an ERC-1155 implementation, the indexer should maintain sufficient information to calculate Wallet balances by:

```text
chain
contract
token_id
wallet
```

The Gallery may use a cached balance projection for performance, provided that:

- It is derived entirely from indexed blockchain events.
- It can be rebuilt.
- It is not treated as the definitive ownership record.
- Verification may query the blockchain directly when stronger assurance is required.

A future implementation may add a table such as `indexed_token_balances`, but it remains an operational projection rather than a business entity.

---

# 27. Deletion Strategy

## Soft Delete

Use soft deletion for:

- Organizations.
- Users.
- Events.
- Media referenced by unpublished content.

## Hard Delete

Hard deletion is allowed for:

- Expired Sessions.
- Expired Authentication Challenges.
- Temporary uploads.
- Old completed Queue Jobs.
- Notifications past retention.

## Never Hard Delete

Do not hard delete:

- Claims.
- Mint Operations.
- Confirmed blockchain event references.
- Audit records required by retention policy.

On-chain credentials cannot be deleted by PostgreSQL.

---

# 28. Indexing Strategy

At minimum, create indexes for:

## Organization

- `slug`
- `status`

## Wallet

- `chain_namespace`, `chain_id`, `address`
- `user_id`

## Event

- `organization_id`
- `slug`
- `status`
- `visibility`
- `starts_at`
- `claim_starts_at`
- `claim_ends_at`
- `chain_id`, `contract_address`, `token_id`

## Claim Code

- `event_id`
- `code_hash`
- `status`
- `expires_at`

## Claim

- `event_id`
- `wallet_id`
- `status`
- `created_at`
- `event_id`, `wallet_id`

## Mint Operation

- `claim_id`
- `status`
- `transaction_hash`
- `chain_id`, `contract_address`
- `last_checked_at`

## Indexed Contract Event

- `chain_id`, `contract_address`, `block_number`
- `transaction_hash`, `log_index`
- `token_id`
- `to_address`
- `from_address`

---

# 29. Data Integrity Rules

The database must enforce the following whenever technically possible:

- Every Event belongs to one Organization.
- Every Claim belongs to one Event and one Wallet.
- Every Mint Operation belongs to one Claim.
- One Wallet cannot successfully claim the same Event twice.
- One Claim Code cannot authorize multiple successful Claims.
- Only one Mint Operation may confirm successfully per Claim.
- Published blockchain configuration cannot be changed.
- Confirmed Mint Operations cannot be edited as ordinary records.
- Claim Codes must be stored as hashes.
- Wallet addresses must be normalized.
- All timestamps must use UTC.

---

# 30. Reconciliation

The system must periodically reconcile PostgreSQL with blockchain state.

The reconciliation worker should detect:

- Submitted transactions that were never confirmed.
- Confirmed transactions without indexed contract events.
- Indexed mint events without matching Claims.
- Claims marked completed without canonical mint events.
- Blockchain reorganizations.
- Duplicate or unexpected mint events.
- Recipient or token mismatches.

Reconciliation must favor blockchain truth while preserving all operational evidence for investigation.

---

# 31. Backup and Recovery

Database backups alone are not sufficient for complete system recovery.

A complete OpenBadge backup strategy includes:

- PostgreSQL backups.
- Object storage backups.
- Smart contract addresses.
- Deployment chain configuration.
- Metadata files.
- Encryption and signing-key backups.
- Indexer checkpoints.

Blockchain event projections do not require permanent backup because they can be rebuilt, although backing them up may reduce recovery time.

Private keys must never be stored directly in ordinary database tables.

---

# 32. Scalability Targets

The logical model should support:

- Millions of Claims.
- Millions of Mint Operations.
- Millions of indexed blockchain events.
- Hundreds of thousands of Events.
- Large public Wallet galleries.
- Multiple OpenBadge contracts.
- Additional networks in future versions.

Large tables should support:

- Time-based retention where applicable.
- Cursor pagination.
- Background archival.
- Partitioning when operationally necessary.

---

# 33. Future Extensions

Future versions may add:

- Multiple credential types per Event.
- Team and advanced permissions.
- Email authentication.
- Certificates.
- Revocation registries.
- Multiple blockchain networks.
- Non-blockchain credential providers.
- Transfer restrictions.
- Attestations.
- Analytics.
- Webhooks.
- External indexers.

These additions must not change the principle that an on-chain Credential is authoritative on the blockchain.

---

# 34. Final Database Principles

- PostgreSQL manages the application workflow.
- Blockchain manages issued credential truth.
- Object storage manages media and metadata files.
- Claims are persistent business records.
- Mint Operations are persistent processing records.
- Credentials are reconstructed read models.
- Indexed events are replaceable projections.
- No cache may override canonical blockchain state.
- Every projection must be rebuildable.
- The system must remain recoverable without relying on OpenBadge-hosted infrastructure.