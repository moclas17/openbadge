# OpenBadge Smart Contract Design

**Version:** 1.0  
**Status:** Draft  
**Standard:** ERC-1155  
**Upgradeability:** Non-upgradeable

---

# 1. Purpose

This document defines the Version One smart contract design for OpenBadge.

The contract exists to provide a stable, verifiable and self-hostable on-chain credential layer for event participation.

The application manages:

- Organizations.
- Events.
- Claim Codes.
- Claims.
- Authentication.
- Permissions.
- Mint queues.
- Notifications.
- Galleries.
- Indexing.

The smart contract manages only:

- Badge type creation.
- Token metadata references.
- Supply limits.
- Minting.
- Duplicate prevention.
- Revocation.
- Transfer restrictions.
- Emergency pause.
- On-chain events.

---

# 2. Core Decision

OpenBadge uses one ERC-1155 contract per installation and per blockchain network.

It does not deploy one contract per Event.

```text
OpenBadgeERC1155
│
├── tokenId 1 → Event A
├── tokenId 2 → Event B
├── tokenId 3 → Event C
└── tokenId N → Event N
```

Each published Event receives one unique `tokenId`.

The canonical credential locator is:

```text
chain namespace
chain ID
contract address
token ID
wallet address
```

---

# 3. Deployment Model

The recommended deployment model is:

```text
One OpenBadge installation
        │
        ├── One contract on Base
        ├── One contract on Polygon
        └── One contract on each additional supported network
```

A deployment must not require a shared global contract controlled by the OpenBadge project.

Each self-hosted operator may deploy and manage its own contract.

This preserves:

- Independence.
- Self-hosting.
- Censorship resistance.
- Operational continuity.
- Verifiability after a hosted service disappears.

---

# 4. Why ERC-1155

ERC-1155 is appropriate because one contract can represent many Event badge types.

Each Event maps to one token ID.

Benefits:

- One deployment instead of one deployment per Event.
- Lower operational cost.
- Easier indexing.
- Easier Gallery queries.
- Simpler contract registry.
- Consistent verification.
- Batch operations.
- One stable contract interface.

Version One uses each token ID as a badge class.

Each attendee may hold at most one unit of that token ID.

---

# 5. Non-Upgradeable Design

The contract must be deployed directly.

It must not use:

- Transparent proxies.
- UUPS proxies.
- Beacon proxies.
- `delegatecall` upgrade patterns.
- Replaceable implementations.
- Upgrade administrators.

The deployed bytecode remains the permanent implementation.

Benefits:

- The audited code remains the executed code.
- Administrators cannot later replace credential rules.
- Existing badges do not depend on future upgrades.
- Contract behavior remains predictable.
- Verification remains possible without trusting an upgrade authority.

Future changes require a new contract version.

Example:

```text
OpenBadgeERC1155V1
OpenBadgeERC1155V2
```

Credentials minted by V1 remain valid and verifiable through V1.

---

# 6. Contract Scope

## 6.1 Responsibilities

The contract must:

1. Create a badge type.
2. Generate a unique token ID.
3. Associate the token ID with metadata.
4. Store an immutable maximum supply.
5. Mint one badge to a recipient.
6. Prevent duplicate ownership.
7. Support safe mint batching.
8. Restrict wallet-to-wallet transfers.
9. Support transparent revocation.
10. Support optional holder burn.
11. Emit indexable events.
12. Pause new state-changing issuance operations.

## 6.2 Explicit Non-Responsibilities

The contract must not manage:

- User profiles.
- Organizations.
- Event descriptions as structured storage.
- Event dates.
- Event locations.
- Claim Codes.
- Claim windows.
- Authentication.
- Email addresses.
- Attendee personal data.
- Payments.
- Application permissions.
- Public Galleries.
- Search.
- Analytics.
- Notifications.

These belong to the application and metadata layers.

---

# 7. Token Model

Each Event corresponds to exactly one ERC-1155 token ID.

Example:

```text
Event: ETH Cinco de Mayo 2027
Contract: 0xABC...
Token ID: 42
Maximum supply: 1,000
Wallet balance: 0 or 1
```

The contract must enforce:

```text
balanceOf(wallet, tokenId) <= 1
```

The backend must also enforce one Claim per Wallet per Event, but the contract is the final defense against duplicate minting.

---

# 8. Badge State

The contract stores minimal badge-level state.

Suggested Solidity structure:

```solidity
struct Badge {
    string metadataURI;
    uint256 maxSupply;
    uint256 totalMinted;
    bool metadataFrozen;
    bool exists;
}
```

A mapping associates token IDs with Badge records:

```solidity
mapping(uint256 => Badge) private _badges;
```

The contract also stores the next available token ID:

```solidity
uint256 private _nextTokenId = 1;
```

Token ID `0` should remain unused to simplify existence checks and integrations.

---

# 9. Token ID Assignment

The contract generates token IDs sequentially.

Recommended interface:

```solidity
function createBadge(
    string calldata metadataURI,
    uint256 maxSupply
) external returns (uint256 tokenId);
```

Creation flow:

```text
Application validates Event
        ↓
Application publishes immutable media and metadata
        ↓
Authorized account calls createBadge
        ↓
Contract assigns next token ID
        ↓
BadgeCreated event is emitted
        ↓
Application stores token ID on Event
```

Contract-generated IDs avoid:

- ID collisions.
- Off-chain race conditions.
- Manual token coordination.
- Conflicting deployments.

---

# 10. Maximum Supply

Every badge must define a fixed maximum supply greater than zero.

Validation:

```solidity
if (maxSupply == 0) revert InvalidMaxSupply();
```

The maximum supply becomes immutable when the badge is created.

Version One must not provide a function to increase or reduce it.

Benefits:

- Clear issuance guarantees.
- Predictable contract behavior.
- Reduced administrative power.
- Easier verification.

The contract must reject minting when:

```text
totalMinted + requested quantity > maxSupply
```

---

# 11. Total Minted Semantics

`totalMinted` represents the total number of successful mints ever issued for a token ID.

Revocation or holder burn should not reduce `totalMinted`.

This means:

```text
totalMinted = historical issuance count
```

not:

```text
current circulating supply
```

This distinction preserves a permanent issuance record and prevents reusing supply after revocation.

A separate current supply value may be derived from Transfer events if needed.

---

# 12. Metadata

Each token ID has one metadata URI.

Recommended URI format:

```text
ipfs://...
```

Other content-addressed storage systems may be supported.

HTTP URLs are technically possible but are less durable.

## 12.1 Metadata Structure

Recommended JSON:

```json
{
  "name": "ETH Cinco de Mayo 2027",
  "description": "Proof of attendance for ETH Cinco de Mayo 2027.",
  "image": "ipfs://bafy.../artwork.webp",
  "external_url": "https://example.org/events/eth-cinco-de-mayo-2027",
  "attributes": [
    {
      "trait_type": "Event",
      "value": "ETH Cinco de Mayo 2027"
    },
    {
      "trait_type": "Organizer",
      "value": "ETH Cinco de Mayo"
    },
    {
      "display_type": "date",
      "trait_type": "Start Date",
      "value": 1809529200
    }
  ]
}
```

## 12.2 Metadata Editing

The contract may allow metadata correction before it is frozen.

Recommended functions:

```solidity
function setMetadataURI(
    uint256 tokenId,
    string calldata newURI
) external;
```

```solidity
function freezeMetadata(
    uint256 tokenId
) external;
```

Rules:

- Only `EVENT_MANAGER_ROLE` may update metadata.
- Metadata may be updated only before it is frozen.
- Frozen metadata cannot be changed.
- Minting should require frozen metadata.
- Freezing is irreversible.

This allows organizers to correct publication errors before the first credential is issued without preserving permanent mutability.

## 12.3 URI Function

The ERC-1155 `uri` function returns token-specific metadata.

```solidity
function uri(
    uint256 tokenId
) public view override returns (string memory);
```

It must revert or return an empty result for a nonexistent token according to the implementation policy documented in tests.

Reverting is preferred because it exposes invalid token IDs clearly.

---

# 13. Roles

The contract should use OpenZeppelin `AccessControl`.

Roles must remain narrowly scoped.

## 13.1 DEFAULT_ADMIN_ROLE

Capabilities:

- Grant roles.
- Revoke roles.
- Transfer administrative control through role changes.
- Renounce its own role.

It must not automatically receive operational permissions unless explicitly granted.

## 13.2 EVENT_MANAGER_ROLE

Capabilities:

- Create badge types.
- Set metadata before freezing.
- Freeze metadata.

It must not:

- Mint.
- Revoke.
- Pause.
- Manage roles.

## 13.3 MINTER_ROLE

Capabilities:

- Mint individual badges.
- Mint safe batches.

It must not:

- Create badge types.
- Change metadata.
- Revoke badges.
- Manage roles.

## 13.4 PAUSER_ROLE

Capabilities:

- Pause.
- Unpause.

It must not automatically receive any other capability.

## 13.5 REVOKER_ROLE

Capabilities:

- Revoke an issued badge.

It must not:

- Mint.
- Change metadata.
- Manage roles.

---

# 14. Recommended Production Role Allocation

```text
DEFAULT_ADMIN_ROLE → Multisig
EVENT_MANAGER_ROLE → Multisig or controlled publication service
MINTER_ROLE → Isolated mint worker signer
PAUSER_ROLE → Multisig and emergency operations account
REVOKER_ROLE → Multisig
```

The operational mint key must have only `MINTER_ROLE`.

Compromise of the mint key must not allow an attacker to:

- Change metadata.
- Grant roles.
- Revoke credentials.
- Unpause after an emergency pause.
- Create arbitrary badge definitions.

---

# 15. Badge Creation

Suggested function:

```solidity
function createBadge(
    string calldata metadataURI,
    uint256 maxSupply
) external onlyRole(EVENT_MANAGER_ROLE) returns (uint256 tokenId);
```

Validation:

- `metadataURI` is not empty.
- `maxSupply` is greater than zero.
- Contract is not paused, if badge creation is pause-sensitive.

State changes:

1. Read `_nextTokenId`.
2. Increment `_nextTokenId`.
3. Create Badge record.
4. Emit `BadgeCreated`.
5. Emit ERC-1155 `URI`.

Suggested event:

```solidity
event BadgeCreated(
    uint256 indexed tokenId,
    string metadataURI,
    uint256 maxSupply
);
```

---

# 16. Metadata Freeze Requirement

Version One should require frozen metadata before minting.

Mint validation includes:

```solidity
if (!badge.metadataFrozen) {
    revert MetadataNotFrozen(tokenId);
}
```

This guarantees that no credential is issued while its on-chain metadata pointer remains mutable.

Publication workflow:

```text
Create badge
        ↓
Review metadata
        ↓
Freeze metadata
        ↓
Open Claims
        ↓
Mint
```

---

# 17. Individual Minting

Suggested function:

```solidity
function mint(
    address recipient,
    uint256 tokenId
) external onlyRole(MINTER_ROLE) whenNotPaused;
```

Validation:

- Badge exists.
- Metadata is frozen.
- Recipient is not the zero address.
- Recipient balance for token ID is zero.
- Historical issuance has not reached maximum supply.

State changes:

1. Increment `totalMinted`.
2. Mint quantity `1`.
3. Emit standard `TransferSingle`.
4. Emit `BadgeMinted`.

Suggested event:

```solidity
event BadgeMinted(
    uint256 indexed tokenId,
    address indexed recipient,
    address indexed operator
);
```

The custom event improves semantic indexing.

The standard event remains the canonical ERC-1155 transfer record.

---

# 18. Duplicate Prevention

The contract must reject a second mint to a Wallet that already holds the badge.

Conceptual rule:

```solidity
if (balanceOf(recipient, tokenId) != 0) {
    revert BadgeAlreadyOwned(recipient, tokenId);
}
```

A revoked or burned Wallet must not be eligible to mint the same badge again in Version One.

Balance alone is insufficient for this rule because revocation and burn reduce the balance to zero.

The contract should therefore track historical issuance:

```solidity
mapping(uint256 => mapping(address => bool)) private _wasIssued;
```

Mint validation:

```solidity
if (_wasIssued[tokenId][recipient]) {
    revert BadgeAlreadyIssued(recipient, tokenId);
}
```

On successful mint:

```solidity
_wasIssued[tokenId][recipient] = true;
```

This guarantees one lifetime issuance per Wallet per Event.

---

# 19. Batch Minting

Version One may support minting one token ID to multiple recipients.

Suggested function:

```solidity
function mintToRecipients(
    address[] calldata recipients,
    uint256 tokenId
) external onlyRole(MINTER_ROLE) whenNotPaused;
```

This differs from standard ERC-1155 `mintBatch`, which usually mints multiple token IDs to one recipient.

Validation:

- Badge exists.
- Metadata is frozen.
- Array is not empty.
- Array length does not exceed a configured constant.
- No recipient is the zero address.
- No recipient has previously been issued the badge.
- The list contains no duplicate recipients.
- Batch does not exceed maximum supply.

Recommended maximum:

```text
100 recipients per transaction
```

This is a safety limit, not a protocol guarantee.

The exact limit should be determined through gas tests on target networks.

## 19.1 Atomicity

Batch minting should be atomic.

If one recipient is invalid, the whole batch reverts.

This avoids partially processed application batches that are difficult to reconcile.

The application may split large groups into smaller transactions.

---

# 20. Transfer Policy

OpenBadge badges are non-transferable.

Allowed:

```text
address(0) → Wallet
```

Optional:

```text
Wallet → address(0)
```

Blocked:

```text
Wallet A → Wallet B
```

This preserves the badge as proof associated with the original recipient.

## 20.1 Implementation

With recent OpenZeppelin ERC-1155 versions, transfer restrictions should be enforced in the internal update function.

Conceptual rule:

```solidity
if (from != address(0) && to != address(0)) {
    revert TransfersDisabled();
}
```

The exact override depends on the selected OpenZeppelin version and must be pinned before implementation.

## 20.2 Approval Functions

ERC-1155 approval functions may remain available for interface compatibility, but approved operators still cannot transfer badges between wallets.

The contract must not rely on the frontend to enforce non-transferability.

---

# 21. Holder Burn

Version One may allow a holder to burn their own badge.

Suggested function:

```solidity
function burn(
    uint256 tokenId
) external;
```

Validation:

- Caller owns one unit.
- Badge exists.

Effects:

- Burn one unit.
- Preserve `_wasIssued`.
- Emit standard `TransferSingle`.

A holder who burns the credential cannot claim or receive the same Event badge again.

This behavior must be communicated clearly in the user interface.

Holder burn is optional for the initial release.

If omitted, the contract becomes simpler and credentials cannot be removed voluntarily.

---

# 22. Revocation

Version One supports transparent administrative revocation.

Suggested function:

```solidity
function revoke(
    address holder,
    uint256 tokenId,
    bytes32 reasonHash
) external onlyRole(REVOKER_ROLE);
```

Validation:

- Badge exists.
- Holder currently owns one unit.
- Holder is not zero address.

Effects:

- Burn one unit.
- Preserve historical issuance.
- Emit `BadgeRevoked`.
- Emit standard `TransferSingle`.

Suggested event:

```solidity
event BadgeRevoked(
    uint256 indexed tokenId,
    address indexed holder,
    address indexed operator,
    bytes32 reasonHash
);
```

## 22.1 Reason Hash

The contract stores only a `bytes32` hash.

It must not store:

- Personal information.
- Long explanations.
- Private evidence.
- URLs containing secrets.

The application may store the human-readable reason off-chain when authorized.

The hash may reference a published statement or evidence package.

## 22.2 Revocation Semantics

A revoked credential is not valid.

The historical mint and revocation remain visible on-chain.

Revocation does not permit reissuance to the same Wallet.

---

# 23. Pause Behavior

The contract uses `Pausable`.

When paused, the contract should block:

- Badge creation.
- Metadata changes.
- Metadata freezing.
- Individual minting.
- Batch minting.
- Revocation, unless emergency policy requires otherwise.
- Holder burn, depending on final policy.

Recommended policy:

```text
Pause blocks issuance and administrative mutation.
Read operations remain available.
Holder burn remains available.
```

This prevents administrators from trapping a user who wishes to remove a badge.

Transfers remain blocked regardless of pause state.

---

# 24. Contract Events

The contract emits custom and standard events.

## 24.1 Custom Events

```solidity
event BadgeCreated(
    uint256 indexed tokenId,
    string metadataURI,
    uint256 maxSupply
);
```

```solidity
event BadgeMetadataUpdated(
    uint256 indexed tokenId,
    string metadataURI
);
```

```solidity
event BadgeMetadataFrozen(
    uint256 indexed tokenId
);
```

```solidity
event BadgeMinted(
    uint256 indexed tokenId,
    address indexed recipient,
    address indexed operator
);
```

```solidity
event BadgeRevoked(
    uint256 indexed tokenId,
    address indexed holder,
    address indexed operator,
    bytes32 reasonHash
);
```

## 24.2 Standard Events

The contract also emits:

- `TransferSingle`
- `TransferBatch`, if used
- `URI`
- `ApprovalForAll`
- `RoleGranted`
- `RoleRevoked`
- `RoleAdminChanged`
- `Paused`
- `Unpaused`

## 24.3 Indexer Requirements

A confirmed Claim requires evidence of the expected mint event.

The indexer must validate:

```text
contract address matches Event
from == zero address
to == expected Wallet
token ID matches Event
quantity == 1
transaction is canonical
```

The custom `BadgeMinted` event may also be checked but must not replace validation of standard token state.

---

# 25. Read Functions

Recommended public read functions:

```solidity
function badgeInfo(
    uint256 tokenId
) external view returns (
    string memory metadataURI,
    uint256 maxSupply,
    uint256 totalMinted,
    bool metadataFrozen
);
```

```solidity
function exists(
    uint256 tokenId
) external view returns (bool);
```

```solidity
function wasIssued(
    address account,
    uint256 tokenId
) external view returns (bool);
```

Inherited read functions:

- `balanceOf`
- `balanceOfBatch`
- `uri`
- `supportsInterface`
- `hasRole`
- `getRoleAdmin`
- `paused`

No enumeration of every token or holder is required on-chain.

Enumeration belongs to indexers.

---

# 26. Proposed Contract Interface

```solidity
interface IOpenBadge {
    event BadgeCreated(
        uint256 indexed tokenId,
        string metadataURI,
        uint256 maxSupply
    );

    event BadgeMetadataUpdated(
        uint256 indexed tokenId,
        string metadataURI
    );

    event BadgeMetadataFrozen(
        uint256 indexed tokenId
    );

    event BadgeMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed operator
    );

    event BadgeRevoked(
        uint256 indexed tokenId,
        address indexed holder,
        address indexed operator,
        bytes32 reasonHash
    );

    function createBadge(
        string calldata metadataURI,
        uint256 maxSupply
    ) external returns (uint256 tokenId);

    function setMetadataURI(
        uint256 tokenId,
        string calldata newURI
    ) external;

    function freezeMetadata(
        uint256 tokenId
    ) external;

    function mint(
        address recipient,
        uint256 tokenId
    ) external;

    function mintToRecipients(
        address[] calldata recipients,
        uint256 tokenId
    ) external;

    function revoke(
        address holder,
        uint256 tokenId,
        bytes32 reasonHash
    ) external;

    function burn(
        uint256 tokenId
    ) external;

    function badgeInfo(
        uint256 tokenId
    ) external view returns (
        string memory metadataURI,
        uint256 maxSupply,
        uint256 totalMinted,
        bool metadataFrozen
    );

    function exists(
        uint256 tokenId
    ) external view returns (bool);

    function wasIssued(
        address account,
        uint256 tokenId
    ) external view returns (bool);
}
```

The final implementation may refine parameter order, naming and return types after gas and integration testing.

---

# 27. Custom Errors

Custom Solidity errors should be used instead of long revert strings.

Recommended errors:

```solidity
error BadgeNotFound(uint256 tokenId);
error InvalidMetadataURI();
error InvalidMaxSupply();
error MetadataFrozen(uint256 tokenId);
error MetadataNotFrozen(uint256 tokenId);
error ZeroAddress();
error BadgeAlreadyIssued(address account, uint256 tokenId);
error BadgeNotOwned(address account, uint256 tokenId);
error MaxSupplyReached(uint256 tokenId);
error BatchEmpty();
error BatchTooLarge(uint256 provided, uint256 maximum);
error DuplicateRecipient(address recipient);
error TransfersDisabled();
```

Custom errors reduce gas costs and improve machine-readable failure handling.

---

# 28. Interface Support

The contract must support:

- ERC-165.
- ERC-1155.
- ERC-1155 Metadata URI.
- AccessControl interface support inherited from OpenZeppelin.

The contract must not claim support for standards it does not fully implement.

Soulbound behavior should be documented explicitly.

Version One should not claim ERC-5192 compatibility because ERC-5192 is designed for ERC-721.

---

# 29. OpenZeppelin Dependencies

The implementation should use pinned OpenZeppelin Contracts dependencies.

Likely components:

```text
ERC1155
AccessControl
Pausable
ReentrancyGuard only if required by future external calls
```

The contract should avoid unnecessary inheritance.

The exact OpenZeppelin version must be pinned in the repository and lockfile.

Upgrading the dependency version after audit requires a new review and potentially a new contract deployment.

---

# 30. Reentrancy

The contract should follow checks-effects-interactions.

ERC-1155 minting to smart contracts invokes receiver callbacks.

This creates an external call.

State required for duplicate prevention and supply enforcement must be updated before receiver callbacks can reenter.

OpenZeppelin's mint flow and the contract's overrides must be reviewed specifically for:

- Reentrant mint attempts.
- Duplicate issuance.
- Supply bypass.
- Role-based reentry.

A `ReentrancyGuard` may be added to mint functions if the implementation review shows value, but it should not replace correct state ordering.

---

# 31. Smart Contract Recipients

ERC-1155 supports smart contract recipients.

A recipient contract must implement the expected receiver interface.

If it does not, minting reverts.

OpenBadge should not block contract wallets.

This enables:

- Safe multisig wallets.
- Account abstraction wallets.
- Smart accounts.
- Future identity systems.

---

# 32. Batch Gas Safety

Batch recipient limits must be tested on each supported network.

The contract should define:

```solidity
uint256 public constant MAX_BATCH_SIZE = 100;
```

The value may be lower after testing.

The constant is immutable because the contract is non-upgradeable.

The application may use a lower operational limit.

---

# 33. Application Integration

## 33.1 Event Publication

The application:

1. Validates Event configuration.
2. Uploads immutable artwork.
3. Publishes metadata.
4. Calls `createBadge`.
5. Receives the token ID from the transaction event.
6. Stores:
   - Chain namespace.
   - Chain ID.
   - Contract address.
   - Token ID.
   - Metadata URI.
7. Calls `freezeMetadata`.
8. Waits for canonical confirmation.
9. Marks the Event published.
10. Opens Claims.

The Event must not accept Claims before metadata is frozen and contract creation is confirmed.

## 33.2 Claim Mint

The worker:

1. Loads a queued Claim.
2. Confirms Event contract configuration.
3. Confirms recipient address.
4. Calls `mint`.
5. Stores transaction hash in Mint Operation.
6. Waits for receipt.
7. Validates standard mint event.
8. Waits for configured confirmation depth.
9. Marks Mint Operation confirmed.
10. Marks Claim completed.

## 33.3 Reconciliation

The application must compare PostgreSQL with on-chain events.

Blockchain state is authoritative for issued credentials.

---

# 34. Database Relationship

The Event record stores:

```text
chain_namespace
chain_id
contract_address
token_id
metadata_uri
```

Mint Operation stores:

```text
claim_id
transaction_hash
block_number
block_hash
status
submitted_at
confirmed_at
```

The database does not store a primary Credential row.

Credential responses are reconstructed from:

- Event.
- Organization.
- Claim.
- Mint Operation.
- Indexed events.
- Canonical token balance.
- Metadata.

---

# 35. Verification Rules

A credential is valid only when:

1. The contract is recognized by the installation or supplied verifier.
2. The token ID exists.
3. The token maps to the expected Event.
4. The Wallet has a positive balance.
5. The original mint event exists.
6. The mint event is in the canonical chain.
7. No later burn or revocation removed the balance.
8. Metadata resolves when display information is required.

Failure to load metadata does not erase valid token ownership.

It may produce:

```text
valid on-chain
metadata unavailable
```

---

# 36. Chain Reorganizations

The application indexer must handle chain reorganizations.

The contract itself requires no special reorganization code.

The off-chain system must:

1. Store block number and block hash.
2. Detect canonical hash changes.
3. Roll back indexed events after the last valid block.
4. Recalculate balances and statuses.
5. Reopen or reconcile affected Mint Operations.
6. Avoid marking Claims final before the configured confirmation depth.

Confirmation depth must be network-configurable.

---

# 37. Security Model

Main protected assets:

- Administrative role control.
- Minter authorization.
- Badge metadata integrity.
- Supply limits.
- Duplicate prevention.
- Revocation authority.
- Non-transferability.

Main threats:

- Compromised minter key.
- Compromised admin key.
- Duplicate minting.
- Reentrant receiver.
- Metadata replacement.
- Supply bypass.
- Unauthorized revocation.
- Incorrect indexer interpretation.
- Malicious smart contract recipient.
- Operational transaction replacement.

---

# 38. Key Compromise Response

## 38.1 Compromised MINTER_ROLE

Response:

1. Pause the contract.
2. Revoke the compromised minter role.
3. Assign a new isolated signer.
4. Audit unauthorized mints.
5. Revoke fraudulent credentials where policy permits.
6. Resume operation.

The minter key cannot modify roles or metadata.

## 38.2 Compromised EVENT_MANAGER_ROLE

Response:

1. Pause the contract.
2. Revoke the compromised role.
3. Review badges created or edited.
4. Freeze valid metadata.
5. Replace operational account.

Frozen metadata cannot be changed by the attacker.

## 38.3 Compromised DEFAULT_ADMIN_ROLE

This is the highest-risk event.

Production deployments must use a multisig.

A single externally owned account is not recommended.

---

# 39. Administration Renunciation

A deployment may eventually renounce some administrative capabilities.

Examples:

- Freeze every badge's metadata.
- Remove inactive Event Managers.
- Restrict minting to a multisig-controlled signer.
- Renounce `DEFAULT_ADMIN_ROLE`.

However, renouncing the final admin role is irreversible.

It would prevent:

- Role replacement.
- Emergency signer rotation.
- Revocation role recovery.

Version One documentation must warn operators before final renunciation.

---

# 40. No Personal Data On-Chain

The contract and metadata must not contain private attendee information by default.

Do not publish:

- Email.
- Phone number.
- Legal name without explicit need.
- Home address.
- Private ticket ID.
- Raw Claim Code.
- Authentication signature.
- IP address.
- Internal User ID.

Wallet addresses are public blockchain identifiers and should be treated accordingly.

---

# 41. Testing Requirements

The contract must include unit, integration and invariant tests.

## 41.1 Badge Creation

Test:

- Authorized creation succeeds.
- Unauthorized creation fails.
- Empty metadata fails.
- Zero supply fails.
- Token IDs increment.
- Event emitted correctly.

## 41.2 Metadata

Test:

- Authorized update before freeze succeeds.
- Unauthorized update fails.
- Freeze succeeds.
- Repeated freeze fails or remains idempotent according to policy.
- Update after freeze fails.
- Mint before freeze fails.

## 41.3 Mint

Test:

- Authorized mint succeeds.
- Unauthorized mint fails.
- Zero address fails.
- Unknown badge fails.
- Duplicate issuance fails.
- Maximum supply is enforced.
- Events contain correct values.
- Smart contract recipient callbacks behave correctly.

## 41.4 Batch Mint

Test:

- Valid batch succeeds.
- Empty batch fails.
- Oversized batch fails.
- Duplicate address in batch fails.
- Previously issued recipient fails.
- Zero address fails.
- Supply overflow fails.
- Entire batch reverts atomically.

## 41.5 Transfers

Test:

- Mint succeeds.
- Wallet-to-wallet transfer fails.
- Operator transfer fails.
- Batch transfer fails.
- Burn behavior follows policy.
- Revocation succeeds only for authorized role.

## 41.6 Pause

Test:

- Authorized pause succeeds.
- Unauthorized pause fails.
- Mint while paused fails.
- Read methods work while paused.
- Holder burn policy works while paused.

## 41.7 Roles

Test:

- Each role has only intended permissions.
- Minter cannot manage metadata.
- Event Manager cannot mint.
- Revoker cannot mint.
- Pauser cannot grant roles.

---

# 42. Invariant Tests

Required invariants:

```text
A Wallet is issued a token ID at most once.
```

```text
totalMinted never exceeds maxSupply.
```

```text
totalMinted never decreases.
```

```text
Frozen metadata never changes.
```

```text
A non-zero to non-zero transfer never succeeds.
```

```text
Only authorized roles can mutate badge state.
```

```text
Token IDs are unique and monotonically increasing.
```

```text
Revocation never resets historical issuance.
```

---

# 43. Fuzz Testing

Fuzz:

- Random recipient addresses.
- Random token IDs.
- Random batch sizes.
- Duplicate batch positions.
- Supply boundaries.
- Metadata strings.
- Repeated role changes.
- Pause and unpause sequences.
- Reentrant receiver behavior.

Special attention must be given to:

```text
maxSupply = 1
totalMinted = maxSupply - 1
batch length = remaining supply
batch length = remaining supply + 1
```

---

# 44. Static Analysis

Before deployment, run:

- Slither.
- Solidity compiler warnings at strict settings.
- Dependency vulnerability review.
- ABI diff review.
- Bytecode size checks.
- Storage layout documentation, even without proxies.
- Gas snapshots.

No unresolved high-severity static-analysis result may remain.

---

# 45. Audit Expectations

Before a production deployment with meaningful usage, the contract should receive an independent security review.

Audit scope must include:

- Role boundaries.
- Metadata freeze.
- Duplicate prevention.
- Supply enforcement.
- Transfer restrictions.
- Burn and revocation.
- Batch minting.
- Receiver callback reentrancy.
- Pause behavior.
- OpenZeppelin inheritance.
- Deployment scripts.
- Initial role assignments.

The exact audited source commit must be published.

---

# 46. Deployment Requirements

Each deployment must record:

- Chain namespace.
- Chain ID.
- Contract address.
- Deployer address.
- Constructor arguments.
- Initial role holders.
- Solidity compiler version.
- Optimization settings.
- Source commit.
- OpenZeppelin version.
- ABI hash.
- Bytecode hash.
- Deployment transaction hash.

Source code should be verified on the network's block explorer when available.

---

# 47. Constructor

Suggested constructor responsibilities:

```solidity
constructor(
    address admin,
    address eventManager,
    address minter,
    address pauser,
    address revoker
)
```

Validation:

- No required role address is zero.
- Admin is assigned `DEFAULT_ADMIN_ROLE`.
- Each operational address receives only its intended role.

The deployer should not retain roles automatically unless explicitly supplied as one of the role addresses.

This prevents accidental hidden control by the deployment account.

---

# 48. Contract Naming

Recommended contract name:

```text
OpenBadge
```

Recommended Solidity file:

```text
OpenBadge.sol
```

Versioned deployment label:

```text
OpenBadge V1
```

The contract name does not need to encode the chain or installation name.

Those belong to deployment metadata.

---

# 49. Token Collection Metadata

ERC-1155 does not define a universal collection-level metadata method.

The application may publish installation-level contract metadata off-chain.

Optional fields:

```json
{
  "name": "OpenBadge",
  "description": "Open-source event participation credentials.",
  "image": "ipfs://...",
  "external_link": "https://example.org"
}
```

This is outside the core Version One contract unless a marketplace integration requires a specific function.

---

# 50. Royalties and Payments

Version One must not include:

- ERC-2981 royalties.
- Mint fees.
- Sales.
- Marketplace fees.
- Withdrawal functions.
- Native currency handling.
- ERC-20 payment handling.

Badges are credentials, not sale assets.

Removing payment logic significantly reduces contract risk.

---

# 51. Gas Sponsorship

The application operator normally submits mint transactions and pays network gas.

Attendees should not need gas to claim.

Flow:

```text
Attendee signs authentication message
        ↓
Application accepts Claim
        ↓
Mint worker submits transaction
        ↓
Operator pays gas
```

Future versions may support account abstraction or external relayers without changing the credential contract.

---

# 52. Multiple Contracts

An installation may register multiple OpenBadge contracts over time.

Reasons:

- New contract version.
- New blockchain.
- Migration after a discovered issue.
- Operational separation.

The application must therefore never assume one global contract address.

Every Event stores its own:

```text
chain namespace
chain ID
contract address
token ID
```

---

# 53. Contract Registry

A contract registry may exist in the application database.

It may store:

- Contract address.
- Chain.
- Contract version.
- Deployment status.
- Source commit.
- Explorer URL.
- Enabled state.
- Starting block for indexers.

This registry is application infrastructure.

It is not required inside the credential contract.

---

# 54. Migration Strategy

Because V1 is non-upgradeable, migration means deploying a new contract.

Existing badges remain on the old contract.

New Events may use the new contract.

Example:

```text
Events 1–500 → OpenBadge V1
Events 501+ → OpenBadge V2
```

The Gallery and verifier aggregate credentials across registered contracts.

No token migration is required by default.

A migration contract should not be added unless a concrete future need justifies its complexity.

---

# 55. Failure Scenarios

## 55.1 Transaction Reverts

The Mint Operation becomes failed.

The Claim may be retried if the failure is operational and the on-chain badge was not minted.

## 55.2 Transaction Submitted but Receipt Unknown

The application must not immediately retry.

It should reconcile using:

- Transaction hash.
- Sender nonce.
- Chain state.
- Mint events.

This prevents duplicate replacement transactions.

## 55.3 Receipt Successful but Expected Event Missing

The Claim must not become completed.

The system records:

```text
MINT_EVENT_NOT_FOUND
```

and begins reconciliation.

## 55.4 Event Indexed Without Matching Claim

The system records an unmatched on-chain mint.

It must not delete or ignore it.

Administrators investigate whether it was:

- An authorized manual mint.
- A compromised minter.
- A database outage.
- An indexing mismatch.

---

# 56. Acceptance Criteria

The V1 smart contract is complete when:

1. One contract supports many Event badge types.
2. Each Event receives a unique token ID.
3. The contract is deployed without a proxy.
4. Maximum supply is immutable.
5. Metadata becomes permanently frozen before minting.
6. A Wallet can receive a badge only once per token ID.
7. Minting supports individual recipients.
8. Safe recipient batching is tested.
9. Wallet-to-wallet transfers always fail.
10. Revocation is role-gated and auditable.
11. Historical issuance survives burn and revocation.
12. Operational roles are isolated.
13. The contract emits sufficient events for reconstruction.
14. The application can verify credentials without a Credential table.
15. All required invariants and security tests pass.
16. Deployment information and source code are reproducible.

---

# 57. Final Decisions

```text
Standard: ERC-1155
Deployment: One contract per installation and network
Event mapping: One token ID per Event
Token ID assignment: Sequential and contract-generated
Upgradeability: None
Proxy: None
Transferability: Disabled
Wallet issuance limit: One lifetime issuance per token ID
Metadata: Editable before freeze, immutable after freeze
Mint prerequisite: Metadata must be frozen
Maximum supply: Fixed and greater than zero
Individual mint: Supported
Batch recipient mint: Supported with fixed limit
Holder burn: Supported or removable before final implementation
Revocation: Supported by separate role
Pause: Supported
Payments: Not supported
Royalties: Not supported
Credential database table: Not used
Blockchain: Source of truth for issued credentials
```

---

# 58. Final Principle

The OpenBadge contract must remain smaller than the OpenBadge application.

It should provide only the permanent rules that require blockchain enforcement.

Everything that can remain safely off-chain should remain off-chain.

The resulting contract should be simple enough to audit, stable enough to trust and independent enough to survive the disappearance of any single hosted OpenBadge service.
