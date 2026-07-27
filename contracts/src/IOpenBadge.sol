// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @title IOpenBadge
/// @notice Interface for the OpenBadge ERC-1155 credential contract.
/// @dev Each token ID represents one event badge type. Badges are non-transferable
///      and require frozen metadata before minting.
interface IOpenBadge {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new badge type is created.
    /// @param tokenId  The assigned token ID.
    /// @param metadataURI The initial metadata URI.
    /// @param maxSupply   The immutable maximum supply (0 = unlimited).
    event BadgeCreated(uint256 indexed tokenId, string metadataURI, uint256 maxSupply);

    /// @notice Emitted when a badge's metadata URI is updated before freezing.
    /// @param tokenId    The token ID whose metadata was updated.
    /// @param metadataURI The new metadata URI.
    event BadgeMetadataUpdated(uint256 indexed tokenId, string metadataURI);

    /// @notice Emitted when a badge's metadata is permanently frozen.
    /// @param tokenId The token ID whose metadata was frozen.
    event BadgeMetadataFrozen(uint256 indexed tokenId);

    /// @notice Emitted when a badge is minted to a recipient.
    /// @param tokenId   The token ID that was minted.
    /// @param recipient The address that received the badge.
    /// @param operator  The address that called mint.
    event BadgeMinted(uint256 indexed tokenId, address indexed recipient, address indexed operator);

    /// @notice Emitted when a badge is administratively revoked.
    /// @param tokenId    The token ID that was revoked.
    /// @param holder     The address whose badge was revoked.
    /// @param operator   The address that called revoke.
    /// @param reasonHash A bytes32 hash referencing the off-chain revocation reason.
    event BadgeRevoked(
        uint256 indexed tokenId, address indexed holder, address indexed operator, bytes32 reasonHash
    );

    // -------------------------------------------------------------------------
    // Write functions
    // -------------------------------------------------------------------------

    /// @notice Creates a new badge type with the given metadata URI and max supply.
    /// @dev Only callable by EVENT_MANAGER_ROLE. Metadata must be frozen before minting.
    /// @param metadataURI The initial metadata URI (must not be empty).
    /// @param maxSupply   Maximum number of times this badge can be minted. 0 = unlimited.
    /// @return tokenId    The newly assigned token ID (starts at 1, increments sequentially).
    function createBadge(string calldata metadataURI, uint256 maxSupply) external returns (uint256 tokenId);

    /// @notice Updates the metadata URI for a badge that has not yet been frozen.
    /// @dev Only callable by EVENT_MANAGER_ROLE. Reverts if metadata is already frozen.
    /// @param tokenId The token ID to update.
    /// @param newURI  The new metadata URI (must not be empty).
    function setMetadataURI(uint256 tokenId, string calldata newURI) external;

    /// @notice Permanently freezes the metadata for a badge.
    /// @dev Only callable by EVENT_MANAGER_ROLE. Required before minting can begin.
    ///      Freezing is irreversible.
    /// @param tokenId The token ID to freeze.
    function freezeMetadata(uint256 tokenId) external;

    /// @notice Mints one unit of a badge to a recipient.
    /// @dev Only callable by MINTER_ROLE when not paused. Metadata must be frozen.
    ///      Each wallet may receive a given badge at most once (including post-revoke/burn).
    /// @param recipient The address to receive the badge (must not be zero address).
    /// @param tokenId   The badge token ID to mint.
    function mint(address recipient, uint256 tokenId) external;

    /// @notice Mints one unit of a badge to each address in the recipients array.
    /// @dev Only callable by MINTER_ROLE when not paused. Atomic: all or nothing.
    ///      Metadata must be frozen. No duplicate addresses or zero addresses allowed.
    /// @param recipients Array of recipient addresses (max 500).
    /// @param tokenId    The badge token ID to mint.
    function mintToRecipients(address[] calldata recipients, uint256 tokenId) external;

    /// @notice Revokes a badge from a holder, burning their token.
    /// @dev Only callable by REVOKER_ROLE when not paused. Historical issuance is preserved.
    ///      The holder cannot receive the same badge again after revocation.
    /// @param holder     The address whose badge is revoked (must currently hold the token).
    /// @param tokenId    The badge token ID to revoke.
    /// @param reasonHash A bytes32 hash referencing the off-chain reason for revocation.
    function revoke(address holder, uint256 tokenId, bytes32 reasonHash) external;

    /// @notice Allows the caller to voluntarily burn their own badge.
    /// @dev Historical issuance is preserved. The caller cannot receive the same badge again.
    /// @param tokenId The badge token ID to burn (caller must hold one unit).
    function burn(uint256 tokenId) external;

    // -------------------------------------------------------------------------
    // Read functions
    // -------------------------------------------------------------------------

    /// @notice Returns the metadata and supply information for a badge.
    /// @param tokenId The token ID to query (must exist).
    /// @return metadataURI    The current metadata URI.
    /// @return maxSupply      The immutable maximum supply (0 = unlimited).
    /// @return totalMinted    The historical total minted count (never decreases).
    /// @return metadataFrozen Whether the metadata has been permanently frozen.
    function badgeInfo(uint256 tokenId)
        external
        view
        returns (string memory metadataURI, uint256 maxSupply, uint256 totalMinted, bool metadataFrozen);

    /// @notice Returns true if the given token ID has been created.
    /// @param tokenId The token ID to check.
    function exists(uint256 tokenId) external view returns (bool);

    /// @notice Returns true if the given account has ever been issued the given badge,
    ///         including cases where the badge was later revoked or burned.
    /// @param account The wallet address to check.
    /// @param tokenId The badge token ID to check.
    function wasIssued(address account, uint256 tokenId) external view returns (bool);
}
