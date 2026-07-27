// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IOpenBadge} from "./IOpenBadge.sol";

/// @title OpenBadge
/// @notice Non-transferable ERC-1155 credential contract for event participation badges.
/// @dev One contract per installation and network. Each event maps to one token ID.
///      Badges are soulbound: wallet-to-wallet transfers always revert.
///      Metadata must be frozen before any minting can occur.
///      Historical issuance persists through revocation and voluntary burn.
contract OpenBadge is IOpenBadge, ERC1155, AccessControl, Pausable {
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    /// @notice Can create badge types, update metadata, and freeze metadata.
    bytes32 public constant EVENT_MANAGER_ROLE = keccak256("EVENT_MANAGER_ROLE");

    /// @notice Can mint badges individually and in batches.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Can pause and unpause the contract.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Can revoke issued badges.
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Maximum number of recipients allowed in a single mintToRecipients call.
    uint256 public constant MAX_BATCH_SIZE = 500;

    // -------------------------------------------------------------------------
    // Custom Errors
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct Badge {
        string metadataURI;
        uint256 maxSupply;
        uint256 totalMinted;
        bool metadataFrozen;
        bool exists;
    }

    /// @dev Mapping from token ID to badge data.
    mapping(uint256 => Badge) private _badges;

    /// @dev Next token ID to assign. Starts at 1; token ID 0 is never used.
    uint256 private _nextTokenId = 1;

    /// @dev Tracks whether a given wallet has ever been issued a given badge.
    ///      Persists through revocation and burn to prevent re-issuance.
    mapping(uint256 => mapping(address => bool)) private _wasIssued;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice Deploys the OpenBadge contract and assigns initial roles.
    /// @dev The deployer receives no roles unless explicitly passed as one of the role addresses.
    /// @param admin        Address to receive DEFAULT_ADMIN_ROLE.
    /// @param eventManager Address to receive EVENT_MANAGER_ROLE.
    /// @param minter       Address to receive MINTER_ROLE.
    /// @param pauser       Address to receive PAUSER_ROLE.
    /// @param revoker      Address to receive REVOKER_ROLE.
    constructor(address admin, address eventManager, address minter, address pauser, address revoker)
        ERC1155("")
    {
        if (admin == address(0)) revert ZeroAddress();
        if (eventManager == address(0)) revert ZeroAddress();
        if (minter == address(0)) revert ZeroAddress();
        if (pauser == address(0)) revert ZeroAddress();
        if (revoker == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EVENT_MANAGER_ROLE, eventManager);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(REVOKER_ROLE, revoker);
    }

    // -------------------------------------------------------------------------
    // Badge Management (EVENT_MANAGER_ROLE)
    // -------------------------------------------------------------------------

    /// @inheritdoc IOpenBadge
    function createBadge(string calldata metadataURI, uint256 maxSupply)
        external
        onlyRole(EVENT_MANAGER_ROLE)
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (bytes(metadataURI).length == 0) revert InvalidMetadataURI();
        if (maxSupply == 0) revert InvalidMaxSupply();

        tokenId = _nextTokenId++;

        _badges[tokenId] = Badge({
            metadataURI: metadataURI,
            maxSupply: maxSupply,
            totalMinted: 0,
            metadataFrozen: false,
            exists: true
        });

        emit BadgeCreated(tokenId, metadataURI, maxSupply);
        emit URI(metadataURI, tokenId);
    }

    /// @inheritdoc IOpenBadge
    function setMetadataURI(uint256 tokenId, string calldata newURI)
        external
        onlyRole(EVENT_MANAGER_ROLE)
        whenNotPaused
    {
        Badge storage badge = _requireBadgeExists(tokenId);
        if (badge.metadataFrozen) revert MetadataFrozen(tokenId);
        if (bytes(newURI).length == 0) revert InvalidMetadataURI();

        badge.metadataURI = newURI;

        emit BadgeMetadataUpdated(tokenId, newURI);
        emit URI(newURI, tokenId);
    }

    /// @inheritdoc IOpenBadge
    function freezeMetadata(uint256 tokenId) external onlyRole(EVENT_MANAGER_ROLE) whenNotPaused {
        Badge storage badge = _requireBadgeExists(tokenId);
        if (badge.metadataFrozen) revert MetadataFrozen(tokenId);

        badge.metadataFrozen = true;

        emit BadgeMetadataFrozen(tokenId);
    }

    // -------------------------------------------------------------------------
    // Minting (MINTER_ROLE)
    // -------------------------------------------------------------------------

    /// @inheritdoc IOpenBadge
    function mint(address recipient, uint256 tokenId) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();

        Badge storage badge = _requireBadgeExists(tokenId);
        if (!badge.metadataFrozen) revert MetadataNotFrozen(tokenId);
        if (_wasIssued[tokenId][recipient]) revert BadgeAlreadyIssued(recipient, tokenId);

        // maxSupply check: totalMinted tracks historical issuance, never decreases.
        // maxSupply == 0 is checked at creation time (must be > 0), so this is always a real cap.
        if (badge.totalMinted >= badge.maxSupply) revert MaxSupplyReached(tokenId);

        // Update state before external call (checks-effects-interactions).
        badge.totalMinted++;
        _wasIssued[tokenId][recipient] = true;

        _mint(recipient, tokenId, 1, "");

        emit BadgeMinted(tokenId, recipient, msg.sender);
    }

    /// @inheritdoc IOpenBadge
    function mintToRecipients(address[] calldata recipients, uint256 tokenId)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        uint256 count = recipients.length;
        if (count == 0) revert BatchEmpty();
        if (count > MAX_BATCH_SIZE) revert BatchTooLarge(count, MAX_BATCH_SIZE);

        Badge storage badge = _requireBadgeExists(tokenId);
        if (!badge.metadataFrozen) revert MetadataNotFrozen(tokenId);

        // Supply check: verify remaining capacity covers the full batch atomically.
        if (badge.totalMinted + count > badge.maxSupply) revert MaxSupplyReached(tokenId);

        // Two-pass validation for atomicity and correct error reporting.
        //
        // Pass 1 (read-only): Check pre-existing issuance and zero addresses.
        //   This allows us to emit BadgeAlreadyIssued (vs DuplicateRecipient) for
        //   addresses that were issued before this call.
        for (uint256 i = 0; i < count; i++) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroAddress();
            if (_wasIssued[tokenId][recipient]) revert BadgeAlreadyIssued(recipient, tokenId);
        }

        // Pass 2 (write): Mark issuance and detect intra-batch duplicates.
        //   Since pass 1 confirmed none were pre-issued, any collision here is an
        //   intra-batch duplicate. All storage writes revert atomically on failure.
        for (uint256 i = 0; i < count; i++) {
            address recipient = recipients[i];
            if (_wasIssued[tokenId][recipient]) revert DuplicateRecipient(recipient);
            _wasIssued[tokenId][recipient] = true;
        }

        // Update total minted (all state changes before external calls).
        badge.totalMinted += count;

        // Pass 2: Mint to each recipient and emit events.
        for (uint256 i = 0; i < count; i++) {
            address recipient = recipients[i];
            _mint(recipient, tokenId, 1, "");
            emit BadgeMinted(tokenId, recipient, msg.sender);
        }
    }

    // -------------------------------------------------------------------------
    // Revocation (REVOKER_ROLE)
    // -------------------------------------------------------------------------

    /// @inheritdoc IOpenBadge
    function revoke(address holder, uint256 tokenId, bytes32 reasonHash)
        external
        onlyRole(REVOKER_ROLE)
        whenNotPaused
    {
        if (holder == address(0)) revert ZeroAddress();
        _requireBadgeExists(tokenId);

        if (balanceOf(holder, tokenId) == 0) revert BadgeNotOwned(holder, tokenId);

        // _wasIssued remains true — historical issuance persists.
        // totalMinted is NOT decremented — it tracks historical issuance, not current supply.

        _burn(holder, tokenId, 1);

        emit BadgeRevoked(tokenId, holder, msg.sender, reasonHash);
    }

    // -------------------------------------------------------------------------
    // Holder Burn (self-service)
    // -------------------------------------------------------------------------

    /// @inheritdoc IOpenBadge
    function burn(uint256 tokenId) external {
        _requireBadgeExists(tokenId);

        if (balanceOf(msg.sender, tokenId) == 0) revert BadgeNotOwned(msg.sender, tokenId);

        // _wasIssued remains true — the holder cannot re-receive this badge.
        // totalMinted is NOT decremented.

        _burn(msg.sender, tokenId, 1);
    }

    // -------------------------------------------------------------------------
    // Pause (PAUSER_ROLE)
    // -------------------------------------------------------------------------

    /// @notice Pauses minting, revocation, and badge management operations.
    /// @dev Only callable by PAUSER_ROLE.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses the contract, resuming all operations.
    /// @dev Only callable by PAUSER_ROLE.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Read Functions
    // -------------------------------------------------------------------------

    /// @inheritdoc IOpenBadge
    function badgeInfo(uint256 tokenId)
        external
        view
        returns (string memory metadataURI, uint256 maxSupply, uint256 totalMinted, bool metadataFrozen)
    {
        Badge storage badge = _requireBadgeExists(tokenId);
        return (badge.metadataURI, badge.maxSupply, badge.totalMinted, badge.metadataFrozen);
    }

    /// @inheritdoc IOpenBadge
    function exists(uint256 tokenId) external view returns (bool) {
        return _badges[tokenId].exists;
    }

    /// @inheritdoc IOpenBadge
    function wasIssued(address account, uint256 tokenId) external view returns (bool) {
        return _wasIssued[tokenId][account];
    }

    /// @notice Returns the metadata URI for the given token ID.
    /// @dev Reverts if the token ID does not exist.
    /// @param tokenId The token ID to query.
    function uri(uint256 tokenId) public view override returns (string memory) {
        Badge storage badge = _requireBadgeExists(tokenId);
        return badge.metadataURI;
    }

    // -------------------------------------------------------------------------
    // Transfer Restriction
    // -------------------------------------------------------------------------

    /// @notice Overrides the ERC-1155 update hook to enforce non-transferability.
    /// @dev Minting (from == address(0)) and burning (to == address(0)) are allowed.
    ///      Any wallet-to-wallet transfer always reverts with TransfersDisabled.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        if (from != address(0) && to != address(0)) {
            revert TransfersDisabled();
        }
        super._update(from, to, ids, values);
    }

    // -------------------------------------------------------------------------
    // Interface Support
    // -------------------------------------------------------------------------

    /// @notice Returns true if the contract supports the given interface.
    /// @dev Supports ERC-165, ERC-1155, and AccessControl interfaces.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    /// @dev Returns the Badge storage pointer for the given token ID.
    ///      Reverts with BadgeNotFound if the token ID does not exist.
    function _requireBadgeExists(uint256 tokenId) internal view returns (Badge storage badge) {
        badge = _badges[tokenId];
        if (!badge.exists) revert BadgeNotFound(tokenId);
    }
}
