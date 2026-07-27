// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test, console2} from "forge-std/Test.sol";
import {OpenBadge} from "../src/OpenBadge.sol";
import {IOpenBadge} from "../src/IOpenBadge.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// ---------------------------------------------------------------------------
// Helper contracts
// ---------------------------------------------------------------------------

/// @dev A minimal ERC-1155 receiver that accepts all tokens.
contract GoodReceiver is IERC1155Receiver {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId
            || interfaceId == type(IERC165).interfaceId;
    }
}

/// @dev An ERC-1155 receiver that rejects all tokens (returns wrong selector).
contract RejectingReceiver is IERC1155Receiver {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return bytes4(0xdeadbeef); // wrong selector — causes revert
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return bytes4(0xdeadbeef);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}

/// @dev A contract that has no ERC-1155 receiver interface (will cause minting to revert).
contract NoReceiver {}

// ---------------------------------------------------------------------------
// Base test setup
// ---------------------------------------------------------------------------

contract OpenBadgeTest is Test {
    OpenBadge public badge;

    address public admin = makeAddr("admin");
    address public eventManager = makeAddr("eventManager");
    address public minter = makeAddr("minter");
    address public pauser = makeAddr("pauser");
    address public revoker = makeAddr("revoker");

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public unauthorized = makeAddr("unauthorized");

    string public constant METADATA_URI = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    string public constant METADATA_URI_2 = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi2";
    uint256 public constant MAX_SUPPLY = 100;

    // Role constants (mirrors the contract)
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant EVENT_MANAGER_ROLE = keccak256("EVENT_MANAGER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    function setUp() public virtual {
        badge = new OpenBadge(admin, eventManager, minter, pauser, revoker);
    }

    // ---- helpers ----

    /// @dev Creates a badge and returns its token ID.
    function _createBadge(uint256 maxSupply) internal returns (uint256 tokenId) {
        vm.prank(eventManager);
        tokenId = badge.createBadge(METADATA_URI, maxSupply);
    }

    /// @dev Creates and freezes a badge, returning its token ID.
    function _createAndFreezeBadge(uint256 maxSupply) internal returns (uint256 tokenId) {
        tokenId = _createBadge(maxSupply);
        vm.prank(eventManager);
        badge.freezeMetadata(tokenId);
    }

    /// @dev Mints a badge to a recipient.
    function _mint(address recipient, uint256 tokenId) internal {
        vm.prank(minter);
        badge.mint(recipient, tokenId);
    }
}

// ===========================================================================
// Deployment Tests
// ===========================================================================

contract DeploymentTest is OpenBadgeTest {
    function test_adminHasAdminRole() public view {
        assertTrue(badge.hasRole(DEFAULT_ADMIN_ROLE, admin));
    }

    function test_eventManagerHasEventManagerRole() public view {
        assertTrue(badge.hasRole(EVENT_MANAGER_ROLE, eventManager));
    }

    function test_minterHasMinterRole() public view {
        assertTrue(badge.hasRole(MINTER_ROLE, minter));
    }

    function test_pauserHasPauserRole() public view {
        assertTrue(badge.hasRole(PAUSER_ROLE, pauser));
    }

    function test_revokerHasRevokerRole() public view {
        assertTrue(badge.hasRole(REVOKER_ROLE, revoker));
    }

    function test_deployerHasNoRolesIfNotInArgs() public view {
        // The test contract is the deployer. It should have no roles.
        address deployer = address(this);
        assertFalse(badge.hasRole(DEFAULT_ADMIN_ROLE, deployer));
        assertFalse(badge.hasRole(EVENT_MANAGER_ROLE, deployer));
        assertFalse(badge.hasRole(MINTER_ROLE, deployer));
        assertFalse(badge.hasRole(PAUSER_ROLE, deployer));
        assertFalse(badge.hasRole(REVOKER_ROLE, deployer));
    }

    function test_unauthorizedAddressHasNoRoles() public view {
        assertFalse(badge.hasRole(DEFAULT_ADMIN_ROLE, unauthorized));
        assertFalse(badge.hasRole(EVENT_MANAGER_ROLE, unauthorized));
        assertFalse(badge.hasRole(MINTER_ROLE, unauthorized));
        assertFalse(badge.hasRole(PAUSER_ROLE, unauthorized));
        assertFalse(badge.hasRole(REVOKER_ROLE, unauthorized));
    }

    function test_revertIfAdminIsZeroAddress() public {
        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        new OpenBadge(address(0), eventManager, minter, pauser, revoker);
    }

    function test_revertIfEventManagerIsZeroAddress() public {
        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        new OpenBadge(admin, address(0), minter, pauser, revoker);
    }

    function test_revertIfMinterIsZeroAddress() public {
        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        new OpenBadge(admin, eventManager, address(0), pauser, revoker);
    }

    function test_revertIfPauserIsZeroAddress() public {
        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        new OpenBadge(admin, eventManager, minter, address(0), revoker);
    }

    function test_revertIfRevokerIsZeroAddress() public {
        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        new OpenBadge(admin, eventManager, minter, pauser, address(0));
    }

    function test_notPausedOnDeploy() public view {
        assertFalse(badge.paused());
    }

    function test_supportsERC1155Interface() public view {
        // ERC-1155 interface ID
        assertTrue(badge.supportsInterface(0xd9b67a26));
    }

    function test_supportsERC165Interface() public view {
        assertTrue(badge.supportsInterface(0x01ffc9a7));
    }

    function test_supportsAccessControlInterface() public view {
        // IAccessControl interface ID
        assertTrue(badge.supportsInterface(0x7965db0b));
    }
}

// ===========================================================================
// createBadge Tests
// ===========================================================================

contract CreateBadgeTest is OpenBadgeTest {
    function test_createBadgeByEventManager() public {
        vm.prank(eventManager);
        uint256 tokenId = badge.createBadge(METADATA_URI, MAX_SUPPLY);
        assertEq(tokenId, 1);
    }

    function test_createBadgeEmitsBadgeCreatedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit IOpenBadge.BadgeCreated(1, METADATA_URI, MAX_SUPPLY);

        vm.prank(eventManager);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_createBadgeEmitsURIEvent() public {
        // ERC-1155 URI event
        vm.expectEmit(false, true, false, true);
        emit IERC1155.URI(METADATA_URI, 1);

        vm.prank(eventManager);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_createBadge_tokenIdStartsAtOne() public {
        vm.prank(eventManager);
        uint256 first = badge.createBadge(METADATA_URI, MAX_SUPPLY);
        assertEq(first, 1);
    }

    function test_createBadge_tokenIdsIncrement() public {
        vm.startPrank(eventManager);
        uint256 first = badge.createBadge(METADATA_URI, MAX_SUPPLY);
        uint256 second = badge.createBadge(METADATA_URI, MAX_SUPPLY);
        uint256 third = badge.createBadge(METADATA_URI, MAX_SUPPLY);
        vm.stopPrank();

        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(third, 3);
    }

    function test_createBadge_setsExistsTrue() public {
        uint256 tokenId = _createBadge(MAX_SUPPLY);
        assertTrue(badge.exists(tokenId));
    }

    function test_createBadge_badgeInfoCorrect() public {
        uint256 tokenId = _createBadge(MAX_SUPPLY);
        (string memory uri, uint256 maxSupply, uint256 totalMinted, bool frozen) = badge.badgeInfo(tokenId);
        assertEq(uri, METADATA_URI);
        assertEq(maxSupply, MAX_SUPPLY);
        assertEq(totalMinted, 0);
        assertFalse(frozen);
    }

    function test_createBadge_revertByUnauthorized() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_createBadge_revertByMinter() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_createBadge_revertByRevoker() public {
        vm.expectRevert();
        vm.prank(revoker);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_createBadge_revertEmptyURI() public {
        vm.expectRevert(OpenBadge.InvalidMetadataURI.selector);
        vm.prank(eventManager);
        badge.createBadge("", MAX_SUPPLY);
    }

    function test_createBadge_revertZeroMaxSupply() public {
        vm.expectRevert(OpenBadge.InvalidMaxSupply.selector);
        vm.prank(eventManager);
        badge.createBadge(METADATA_URI, 0);
    }

    function test_createBadge_revertWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(eventManager);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_nonExistentTokenDoesNotExist() public view {
        assertFalse(badge.exists(0));
        assertFalse(badge.exists(999));
    }
}

// ===========================================================================
// setMetadataURI Tests
// ===========================================================================

contract SetMetadataURITest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createBadge(MAX_SUPPLY);
    }

    function test_setMetadataURI_byEventManager() public {
        vm.prank(eventManager);
        badge.setMetadataURI(tokenId, METADATA_URI_2);

        (string memory uri,,,) = badge.badgeInfo(tokenId);
        assertEq(uri, METADATA_URI_2);
    }

    function test_setMetadataURI_emitsBadgeMetadataUpdated() public {
        vm.expectEmit(true, false, false, true);
        emit IOpenBadge.BadgeMetadataUpdated(tokenId, METADATA_URI_2);

        vm.prank(eventManager);
        badge.setMetadataURI(tokenId, METADATA_URI_2);
    }

    function test_setMetadataURI_emitsURIEvent() public {
        vm.expectEmit(false, true, false, true);
        emit IERC1155.URI(METADATA_URI_2, tokenId);

        vm.prank(eventManager);
        badge.setMetadataURI(tokenId, METADATA_URI_2);
    }

    function test_setMetadataURI_revertByUnauthorized() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        badge.setMetadataURI(tokenId, METADATA_URI_2);
    }

    function test_setMetadataURI_revertByMinter() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.setMetadataURI(tokenId, METADATA_URI_2);
    }

    function test_setMetadataURI_revertEmptyURI() public {
        vm.expectRevert(OpenBadge.InvalidMetadataURI.selector);
        vm.prank(eventManager);
        badge.setMetadataURI(tokenId, "");
    }

    function test_setMetadataURI_revertAfterFreeze() public {
        vm.prank(eventManager);
        badge.freezeMetadata(tokenId);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.MetadataFrozen.selector, tokenId));
        vm.prank(eventManager);
        badge.setMetadataURI(tokenId, METADATA_URI_2);
    }

    function test_setMetadataURI_revertForNonExistentBadge() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        vm.prank(eventManager);
        badge.setMetadataURI(999, METADATA_URI_2);
    }

    function test_setMetadataURI_revertWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(eventManager);
        badge.setMetadataURI(tokenId, METADATA_URI_2);
    }

    function test_setMetadataURI_multipleUpdatesBeforeFreeze() public {
        string memory uri3 = "ipfs://third";

        vm.startPrank(eventManager);
        badge.setMetadataURI(tokenId, METADATA_URI_2);
        badge.setMetadataURI(tokenId, uri3);
        vm.stopPrank();

        (string memory uri,,,) = badge.badgeInfo(tokenId);
        assertEq(uri, uri3);
    }
}

// ===========================================================================
// freezeMetadata Tests
// ===========================================================================

contract FreezeMetadataTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createBadge(MAX_SUPPLY);
    }

    function test_freezeMetadata_byEventManager() public {
        vm.prank(eventManager);
        badge.freezeMetadata(tokenId);

        (,,, bool frozen) = badge.badgeInfo(tokenId);
        assertTrue(frozen);
    }

    function test_freezeMetadata_emitsBadgeMetadataFrozen() public {
        vm.expectEmit(true, false, false, false);
        emit IOpenBadge.BadgeMetadataFrozen(tokenId);

        vm.prank(eventManager);
        badge.freezeMetadata(tokenId);
    }

    function test_freezeMetadata_revertByUnauthorized() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        badge.freezeMetadata(tokenId);
    }

    function test_freezeMetadata_revertByMinter() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.freezeMetadata(tokenId);
    }

    function test_freezeMetadata_revertIfAlreadyFrozen() public {
        vm.prank(eventManager);
        badge.freezeMetadata(tokenId);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.MetadataFrozen.selector, tokenId));
        vm.prank(eventManager);
        badge.freezeMetadata(tokenId);
    }

    function test_freezeMetadata_revertForNonExistentBadge() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        vm.prank(eventManager);
        badge.freezeMetadata(999);
    }

    function test_freezeMetadata_revertWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(eventManager);
        badge.freezeMetadata(tokenId);
    }
}

// ===========================================================================
// mint Tests
// ===========================================================================

contract MintTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
    }

    function test_mint_byMinter() public {
        vm.prank(minter);
        badge.mint(alice, tokenId);

        assertEq(badge.balanceOf(alice, tokenId), 1);
    }

    function test_mint_emitsBadgeMinted() public {
        vm.expectEmit(true, true, true, false);
        emit IOpenBadge.BadgeMinted(tokenId, alice, minter);

        vm.prank(minter);
        badge.mint(alice, tokenId);
    }

    function test_mint_setsWasIssued() public {
        vm.prank(minter);
        badge.mint(alice, tokenId);

        assertTrue(badge.wasIssued(alice, tokenId));
    }

    function test_mint_incrementsTotalMinted() public {
        vm.prank(minter);
        badge.mint(alice, tokenId);

        (,, uint256 totalMinted,) = badge.badgeInfo(tokenId);
        assertEq(totalMinted, 1);
    }

    function test_mint_revertByUnauthorized() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        badge.mint(alice, tokenId);
    }

    function test_mint_revertByEventManager() public {
        vm.expectRevert();
        vm.prank(eventManager);
        badge.mint(alice, tokenId);
    }

    function test_mint_revertByRevoker() public {
        vm.expectRevert();
        vm.prank(revoker);
        badge.mint(alice, tokenId);
    }

    function test_mint_revertZeroAddress() public {
        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        vm.prank(minter);
        badge.mint(address(0), tokenId);
    }

    function test_mint_revertBadgeNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        vm.prank(minter);
        badge.mint(alice, 999);
    }

    function test_mint_revertMetadataNotFrozen() public {
        uint256 unfrozenId = _createBadge(MAX_SUPPLY);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.MetadataNotFrozen.selector, unfrozenId));
        vm.prank(minter);
        badge.mint(alice, unfrozenId);
    }

    function test_mint_revertDuplicate() public {
        vm.prank(minter);
        badge.mint(alice, tokenId);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeAlreadyIssued.selector, alice, tokenId));
        vm.prank(minter);
        badge.mint(alice, tokenId);
    }

    function test_mint_revertMaxSupplyReached() public {
        uint256 smallId = _createAndFreezeBadge(1);

        vm.prank(minter);
        badge.mint(alice, smallId);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.MaxSupplyReached.selector, smallId));
        vm.prank(minter);
        badge.mint(bob, smallId);
    }

    function test_mint_revertWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(minter);
        badge.mint(alice, tokenId);
    }

    function test_mint_toSmartContractGoodReceiver() public {
        GoodReceiver receiver = new GoodReceiver();

        vm.prank(minter);
        badge.mint(address(receiver), tokenId);

        assertEq(badge.balanceOf(address(receiver), tokenId), 1);
    }

    function test_mint_revertToSmartContractRejectingReceiver() public {
        RejectingReceiver receiver = new RejectingReceiver();

        vm.expectRevert();
        vm.prank(minter);
        badge.mint(address(receiver), tokenId);
    }

    function test_mint_revertToSmartContractNoReceiver() public {
        NoReceiver receiver = new NoReceiver();

        vm.expectRevert();
        vm.prank(minter);
        badge.mint(address(receiver), tokenId);
    }

    function test_mint_upToMaxSupply() public {
        uint256 limit = 3;
        uint256 id = _createAndFreezeBadge(limit);

        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        for (uint256 i = 0; i < limit; i++) {
            vm.prank(minter);
            badge.mint(recipients[i], id);
        }

        (,, uint256 totalMinted,) = badge.badgeInfo(id);
        assertEq(totalMinted, limit);
    }
}

// ===========================================================================
// mintToRecipients Tests
// ===========================================================================

contract MintToRecipientsTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
    }

    function _makeRecipients(uint256 count) internal returns (address[] memory recipients) {
        recipients = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            recipients[i] = makeAddr(string.concat("recipient_", vm.toString(i)));
        }
    }

    function test_mintToRecipients_valid() public {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);

        assertEq(badge.balanceOf(alice, tokenId), 1);
        assertEq(badge.balanceOf(bob, tokenId), 1);
        assertEq(badge.balanceOf(charlie, tokenId), 1);
    }

    function test_mintToRecipients_setsWasIssuedForAll() public {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);

        assertTrue(badge.wasIssued(alice, tokenId));
        assertTrue(badge.wasIssued(bob, tokenId));
        assertTrue(badge.wasIssued(charlie, tokenId));
    }

    function test_mintToRecipients_incrementsTotalMinted() public {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);

        (,, uint256 totalMinted,) = badge.badgeInfo(tokenId);
        assertEq(totalMinted, 3);
    }

    function test_mintToRecipients_emitsBadgeMintedForEach() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        vm.expectEmit(true, true, true, false);
        emit IOpenBadge.BadgeMinted(tokenId, alice, minter);

        vm.expectEmit(true, true, true, false);
        emit IOpenBadge.BadgeMinted(tokenId, bob, minter);

        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_mintToRecipients_revertEmpty() public {
        address[] memory recipients = new address[](0);

        vm.expectRevert(OpenBadge.BatchEmpty.selector);
        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_mintToRecipients_revertTooLarge() public {
        uint256 bigSupply = 1000;
        uint256 bigId = _createAndFreezeBadge(bigSupply);
        address[] memory recipients = _makeRecipients(501);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BatchTooLarge.selector, 501, 500));
        vm.prank(minter);
        badge.mintToRecipients(recipients, bigId);
    }

    function test_mintToRecipients_revertDuplicateInBatch() public {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = alice; // intra-batch duplicate

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.DuplicateRecipient.selector, alice));
        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_mintToRecipients_revertPreviouslyIssuedRecipient() public {
        // alice already has the badge from a previous mint
        vm.prank(minter);
        badge.mint(alice, tokenId);

        address[] memory recipients = new address[](2);
        recipients[0] = bob;
        recipients[1] = alice;

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeAlreadyIssued.selector, alice, tokenId));
        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_mintToRecipients_revertZeroAddress() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = address(0);

        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_mintToRecipients_revertBadgeNotFound() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        vm.prank(minter);
        badge.mintToRecipients(recipients, 999);
    }

    function test_mintToRecipients_revertMetadataNotFrozen() public {
        uint256 unfrozenId = _createBadge(MAX_SUPPLY);
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.MetadataNotFrozen.selector, unfrozenId));
        vm.prank(minter);
        badge.mintToRecipients(recipients, unfrozenId);
    }

    function test_mintToRecipients_revertSupplyExceeded() public {
        uint256 smallId = _createAndFreezeBadge(2);
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.MaxSupplyReached.selector, smallId));
        vm.prank(minter);
        badge.mintToRecipients(recipients, smallId);
    }

    function test_mintToRecipients_revertWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        vm.expectRevert();
        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_mintToRecipients_atomicRevert() public {
        // Bob is in the middle; alice and charlie were valid.
        // After revert, none should have been minted.
        vm.prank(minter);
        badge.mint(bob, tokenId); // pre-issue bob

        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob; // already issued — will revert
        recipients[2] = charlie;

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeAlreadyIssued.selector, bob, tokenId));
        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);

        // alice and charlie should not have received tokens
        assertEq(badge.balanceOf(alice, tokenId), 0);
        assertEq(badge.balanceOf(charlie, tokenId), 0);
        assertFalse(badge.wasIssued(alice, tokenId));
        assertFalse(badge.wasIssued(charlie, tokenId));
    }

    function test_mintToRecipients_revertByUnauthorized() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        vm.expectRevert();
        vm.prank(unauthorized);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_mintToRecipients_singleRecipient() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);

        assertEq(badge.balanceOf(alice, tokenId), 1);
    }

    function test_mintToRecipients_exactlyAtMaxBatchSize() public {
        uint256 bigId = _createAndFreezeBadge(500);
        address[] memory recipients = _makeRecipients(500);

        vm.prank(minter);
        badge.mintToRecipients(recipients, bigId);

        (,, uint256 totalMinted,) = badge.badgeInfo(bigId);
        assertEq(totalMinted, 500);
    }
}

// ===========================================================================
// revoke Tests
// ===========================================================================

contract RevokeTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
        _mint(alice, tokenId);
    }

    function test_revoke_byRevoker() public {
        vm.prank(revoker);
        badge.revoke(alice, tokenId, bytes32(0));

        assertEq(badge.balanceOf(alice, tokenId), 0);
    }

    function test_revoke_emitsBadgeRevoked() public {
        bytes32 reason = keccak256("violation of terms");

        vm.expectEmit(true, true, true, true);
        emit IOpenBadge.BadgeRevoked(tokenId, alice, revoker, reason);

        vm.prank(revoker);
        badge.revoke(alice, tokenId, reason);
    }

    function test_revoke_preservesWasIssued() public {
        vm.prank(revoker);
        badge.revoke(alice, tokenId, bytes32(0));

        assertTrue(badge.wasIssued(alice, tokenId));
    }

    function test_revoke_doesNotDecrementTotalMinted() public {
        vm.prank(revoker);
        badge.revoke(alice, tokenId, bytes32(0));

        (,, uint256 totalMinted,) = badge.badgeInfo(tokenId);
        assertEq(totalMinted, 1);
    }

    function test_revoke_revertByUnauthorized() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        badge.revoke(alice, tokenId, bytes32(0));
    }

    function test_revoke_revertByMinter() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.revoke(alice, tokenId, bytes32(0));
    }

    function test_revoke_revertByEventManager() public {
        vm.expectRevert();
        vm.prank(eventManager);
        badge.revoke(alice, tokenId, bytes32(0));
    }

    function test_revoke_revertBadgeNotOwned() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotOwned.selector, bob, tokenId));
        vm.prank(revoker);
        badge.revoke(bob, tokenId, bytes32(0));
    }

    function test_revoke_revertBadgeNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        vm.prank(revoker);
        badge.revoke(alice, 999, bytes32(0));
    }

    function test_revoke_revertZeroAddress() public {
        vm.expectRevert(OpenBadge.ZeroAddress.selector);
        vm.prank(revoker);
        badge.revoke(address(0), tokenId, bytes32(0));
    }

    function test_revoke_revertWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(revoker);
        badge.revoke(alice, tokenId, bytes32(0));
    }

    function test_revoke_preventsReissuance() public {
        vm.prank(revoker);
        badge.revoke(alice, tokenId, bytes32(0));

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeAlreadyIssued.selector, alice, tokenId));
        vm.prank(minter);
        badge.mint(alice, tokenId);
    }
}

// ===========================================================================
// burn Tests
// ===========================================================================

contract BurnTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
        _mint(alice, tokenId);
    }

    function test_burn_byHolder() public {
        vm.prank(alice);
        badge.burn(tokenId);

        assertEq(badge.balanceOf(alice, tokenId), 0);
    }

    function test_burn_preservesWasIssued() public {
        vm.prank(alice);
        badge.burn(tokenId);

        assertTrue(badge.wasIssued(alice, tokenId));
    }

    function test_burn_doesNotDecrementTotalMinted() public {
        vm.prank(alice);
        badge.burn(tokenId);

        (,, uint256 totalMinted,) = badge.badgeInfo(tokenId);
        assertEq(totalMinted, 1);
    }

    function test_burn_revertByNonHolder() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotOwned.selector, bob, tokenId));
        vm.prank(bob);
        badge.burn(tokenId);
    }

    function test_burn_revertBadgeNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        vm.prank(alice);
        badge.burn(999);
    }

    function test_burn_preventsReissuance() public {
        vm.prank(alice);
        badge.burn(tokenId);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeAlreadyIssued.selector, alice, tokenId));
        vm.prank(minter);
        badge.mint(alice, tokenId);
    }

    function test_burn_allowedWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        // Holder burn should still be allowed when paused.
        vm.prank(alice);
        badge.burn(tokenId);

        assertEq(badge.balanceOf(alice, tokenId), 0);
    }
}

// ===========================================================================
// Transfer Tests
// ===========================================================================

contract TransferTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
        _mint(alice, tokenId);
    }

    function test_safeTransferFrom_revertTransfersDisabled() public {
        vm.expectRevert(OpenBadge.TransfersDisabled.selector);
        vm.prank(alice);
        badge.safeTransferFrom(alice, bob, tokenId, 1, "");
    }

    function test_safeBatchTransferFrom_revertTransfersDisabled() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = tokenId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        vm.expectRevert(OpenBadge.TransfersDisabled.selector);
        vm.prank(alice);
        badge.safeBatchTransferFrom(alice, bob, ids, amounts, "");
    }

    function test_approvedOperatorCannotTransfer() public {
        vm.prank(alice);
        badge.setApprovalForAll(bob, true);

        vm.expectRevert(OpenBadge.TransfersDisabled.selector);
        vm.prank(bob);
        badge.safeTransferFrom(alice, charlie, tokenId, 1, "");
    }

    function test_mintSucceeds_fromZeroAddress() public {
        // Minting (from == address(0)) must succeed — this is not a transfer.
        uint256 newId = _createAndFreezeBadge(MAX_SUPPLY);
        vm.prank(minter);
        badge.mint(bob, newId);
        assertEq(badge.balanceOf(bob, newId), 1);
    }

    function test_burnSucceeds_toZeroAddress() public {
        // Burning (to == address(0)) must succeed.
        vm.prank(alice);
        badge.burn(tokenId);
        assertEq(badge.balanceOf(alice, tokenId), 0);
    }
}

// ===========================================================================
// wasIssued Tests
// ===========================================================================

contract WasIssuedTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
    }

    function test_wasIssued_falseBeforeMint() public view {
        assertFalse(badge.wasIssued(alice, tokenId));
    }

    function test_wasIssued_trueAfterMint() public {
        _mint(alice, tokenId);
        assertTrue(badge.wasIssued(alice, tokenId));
    }

    function test_wasIssued_trueAfterRevoke() public {
        _mint(alice, tokenId);

        vm.prank(revoker);
        badge.revoke(alice, tokenId, bytes32(0));

        assertTrue(badge.wasIssued(alice, tokenId));
    }

    function test_wasIssued_trueAfterBurn() public {
        _mint(alice, tokenId);

        vm.prank(alice);
        badge.burn(tokenId);

        assertTrue(badge.wasIssued(alice, tokenId));
    }

    function test_wasIssued_independentPerAddress() public {
        _mint(alice, tokenId);

        assertTrue(badge.wasIssued(alice, tokenId));
        assertFalse(badge.wasIssued(bob, tokenId));
    }

    function test_wasIssued_independentPerTokenId() public {
        uint256 tokenId2 = _createAndFreezeBadge(MAX_SUPPLY);
        _mint(alice, tokenId);

        assertTrue(badge.wasIssued(alice, tokenId));
        assertFalse(badge.wasIssued(alice, tokenId2));
    }
}

// ===========================================================================
// badgeInfo and exists Tests
// ===========================================================================

contract BadgeInfoTest is OpenBadgeTest {
    function test_exists_falseForNonExistent() public view {
        assertFalse(badge.exists(0));
        assertFalse(badge.exists(1));
        assertFalse(badge.exists(999));
    }

    function test_exists_trueAfterCreate() public {
        uint256 id = _createBadge(MAX_SUPPLY);
        assertTrue(badge.exists(id));
    }

    function test_badgeInfo_revertForNonExistent() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        badge.badgeInfo(999);
    }

    function test_badgeInfo_initialState() public {
        uint256 id = _createBadge(MAX_SUPPLY);
        (string memory uri, uint256 maxSupply, uint256 totalMinted, bool frozen) = badge.badgeInfo(id);

        assertEq(uri, METADATA_URI);
        assertEq(maxSupply, MAX_SUPPLY);
        assertEq(totalMinted, 0);
        assertFalse(frozen);
    }

    function test_badgeInfo_afterFreeze() public {
        uint256 id = _createBadge(MAX_SUPPLY);
        vm.prank(eventManager);
        badge.freezeMetadata(id);

        (,,, bool frozen) = badge.badgeInfo(id);
        assertTrue(frozen);
    }

    function test_badgeInfo_totalMintedAfterMints() public {
        uint256 id = _createAndFreezeBadge(MAX_SUPPLY);
        _mint(alice, id);
        _mint(bob, id);

        (,, uint256 totalMinted,) = badge.badgeInfo(id);
        assertEq(totalMinted, 2);
    }

    function test_uri_returnsMetadataURI() public {
        uint256 id = _createBadge(MAX_SUPPLY);
        assertEq(badge.uri(id), METADATA_URI);
    }

    function test_uri_revertForNonExistent() public {
        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeNotFound.selector, 999));
        badge.uri(999);
    }

    function test_uri_updatesAfterSetMetadataURI() public {
        uint256 id = _createBadge(MAX_SUPPLY);
        vm.prank(eventManager);
        badge.setMetadataURI(id, METADATA_URI_2);

        assertEq(badge.uri(id), METADATA_URI_2);
    }
}

// ===========================================================================
// Pause / Unpause Tests
// ===========================================================================

contract PauseTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
    }

    function test_pause_byPauser() public {
        vm.prank(pauser);
        badge.pause();
        assertTrue(badge.paused());
    }

    function test_unpause_byPauser() public {
        vm.prank(pauser);
        badge.pause();

        vm.prank(pauser);
        badge.unpause();
        assertFalse(badge.paused());
    }

    function test_pause_revertByUnauthorized() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        badge.pause();
    }

    function test_pause_revertByMinter() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.pause();
    }

    function test_pause_revertByAdmin() public {
        // Admin does not have PAUSER_ROLE by default
        vm.expectRevert();
        vm.prank(admin);
        badge.pause();
    }

    function test_unpause_revertByUnauthorized() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(unauthorized);
        badge.unpause();
    }

    function test_mintBlockedWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(minter);
        badge.mint(alice, tokenId);
    }

    function test_mintToRecipientsBlockedWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        vm.expectRevert();
        vm.prank(minter);
        badge.mintToRecipients(recipients, tokenId);
    }

    function test_revokeBlockedWhenPaused() public {
        _mint(alice, tokenId);

        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(revoker);
        badge.revoke(alice, tokenId, bytes32(0));
    }

    function test_createBadgeBlockedWhenPaused() public {
        vm.prank(pauser);
        badge.pause();

        vm.expectRevert();
        vm.prank(eventManager);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_readMethodsWorkWhenPaused() public {
        _mint(alice, tokenId);

        vm.prank(pauser);
        badge.pause();

        // These should not revert
        badge.exists(tokenId);
        badge.wasIssued(alice, tokenId);
        badge.badgeInfo(tokenId);
        badge.uri(tokenId);
        badge.balanceOf(alice, tokenId);
        badge.paused();
    }

    function test_mintWorksAfterUnpause() public {
        vm.prank(pauser);
        badge.pause();

        vm.prank(pauser);
        badge.unpause();

        vm.prank(minter);
        badge.mint(alice, tokenId);

        assertEq(badge.balanceOf(alice, tokenId), 1);
    }

    function test_holderBurnAllowedWhenPaused() public {
        _mint(alice, tokenId);

        vm.prank(pauser);
        badge.pause();

        // Holder burn should not be blocked by pause.
        vm.prank(alice);
        badge.burn(tokenId);

        assertEq(badge.balanceOf(alice, tokenId), 0);
    }
}

// ===========================================================================
// Role Isolation Tests
// ===========================================================================

contract RoleIsolationTest is OpenBadgeTest {
    uint256 public tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _createAndFreezeBadge(MAX_SUPPLY);
        _mint(alice, tokenId);
    }

    // Minter cannot manage metadata
    function test_minter_cannotCreateBadge() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_minter_cannotSetMetadataURI() public {
        uint256 unfrozenId = _createBadge(MAX_SUPPLY);
        vm.expectRevert();
        vm.prank(minter);
        badge.setMetadataURI(unfrozenId, METADATA_URI_2);
    }

    function test_minter_cannotFreezeMetadata() public {
        uint256 unfrozenId = _createBadge(MAX_SUPPLY);
        vm.expectRevert();
        vm.prank(minter);
        badge.freezeMetadata(unfrozenId);
    }

    function test_minter_cannotRevoke() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.revoke(alice, tokenId, bytes32(0));
    }

    function test_minter_cannotPause() public {
        vm.expectRevert();
        vm.prank(minter);
        badge.pause();
    }

    // Event Manager cannot mint
    function test_eventManager_cannotMint() public {
        uint256 newId = _createAndFreezeBadge(MAX_SUPPLY);
        vm.expectRevert();
        vm.prank(eventManager);
        badge.mint(alice, newId);
    }

    function test_eventManager_cannotMintToRecipients() public {
        uint256 newId = _createAndFreezeBadge(MAX_SUPPLY);
        address[] memory recipients = new address[](1);
        recipients[0] = bob;

        vm.expectRevert();
        vm.prank(eventManager);
        badge.mintToRecipients(recipients, newId);
    }

    function test_eventManager_cannotRevoke() public {
        vm.expectRevert();
        vm.prank(eventManager);
        badge.revoke(alice, tokenId, bytes32(0));
    }

    function test_eventManager_cannotPause() public {
        vm.expectRevert();
        vm.prank(eventManager);
        badge.pause();
    }

    // Revoker cannot mint
    function test_revoker_cannotMint() public {
        uint256 newId = _createAndFreezeBadge(MAX_SUPPLY);
        vm.expectRevert();
        vm.prank(revoker);
        badge.mint(bob, newId);
    }

    function test_revoker_cannotCreateBadge() public {
        vm.expectRevert();
        vm.prank(revoker);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_revoker_cannotPause() public {
        vm.expectRevert();
        vm.prank(revoker);
        badge.pause();
    }

    // Pauser cannot grant roles
    function test_pauser_cannotGrantRole() public {
        vm.expectRevert();
        vm.prank(pauser);
        badge.grantRole(MINTER_ROLE, unauthorized);
    }

    function test_pauser_cannotCreateBadge() public {
        vm.expectRevert();
        vm.prank(pauser);
        badge.createBadge(METADATA_URI, MAX_SUPPLY);
    }

    function test_pauser_cannotMint() public {
        vm.expectRevert();
        vm.prank(pauser);
        badge.mint(alice, tokenId);
    }

    // Admin can grant roles but not perform operations
    function test_admin_canGrantRole() public {
        vm.prank(admin);
        badge.grantRole(MINTER_ROLE, unauthorized);
        assertTrue(badge.hasRole(MINTER_ROLE, unauthorized));
    }

    function test_admin_canRevokeRole() public {
        vm.prank(admin);
        badge.revokeRole(MINTER_ROLE, minter);
        assertFalse(badge.hasRole(MINTER_ROLE, minter));
    }

    function test_admin_cannotMintWithoutMinterRole() public {
        vm.expectRevert();
        vm.prank(admin);
        badge.mint(alice, tokenId);
    }
}

// ===========================================================================
// Fuzz Tests
// ===========================================================================

contract FuzzTest is OpenBadgeTest {
    function test_fuzz_createBadge_maxSupplyAlwaysStored(uint256 supply) public {
        vm.assume(supply > 0);

        vm.prank(eventManager);
        uint256 id = badge.createBadge(METADATA_URI, supply);

        (, uint256 stored,,) = badge.badgeInfo(id);
        assertEq(stored, supply);
    }

    function test_fuzz_mint_randomRecipient(address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient.code.length == 0); // EOA only to avoid callback issues

        uint256 id = _createAndFreezeBadge(MAX_SUPPLY);

        vm.prank(minter);
        badge.mint(recipient, id);

        assertEq(badge.balanceOf(recipient, id), 1);
        assertTrue(badge.wasIssued(recipient, id));
    }

    function test_fuzz_duplicateMintReverts(address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient.code.length == 0);

        uint256 id = _createAndFreezeBadge(MAX_SUPPLY);

        vm.prank(minter);
        badge.mint(recipient, id);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.BadgeAlreadyIssued.selector, recipient, id));
        vm.prank(minter);
        badge.mint(recipient, id);
    }

    function test_fuzz_totalMintedNeverDecreases(uint8 mintCount) public {
        vm.assume(mintCount > 0 && mintCount <= 50);

        uint256 id = _createAndFreezeBadge(MAX_SUPPLY);
        uint256 prev = 0;

        for (uint256 i = 0; i < mintCount; i++) {
            address recipient = makeAddr(string.concat("fuzz_", vm.toString(i)));
            vm.prank(minter);
            badge.mint(recipient, id);

            (,, uint256 totalMinted,) = badge.badgeInfo(id);
            assertGe(totalMinted, prev);
            prev = totalMinted;
        }
    }

    function test_fuzz_totalMintedNeverExceedsMaxSupply(uint8 supply, uint8 mintCount) public {
        vm.assume(supply > 0);
        vm.assume(mintCount > 0 && mintCount <= 50);

        uint256 id = _createAndFreezeBadge(supply);
        uint256 minted = 0;

        for (uint256 i = 0; i < mintCount; i++) {
            address recipient = makeAddr(string.concat("fuzz2_", vm.toString(i)));
            if (minted >= supply) {
                vm.expectRevert(abi.encodeWithSelector(OpenBadge.MaxSupplyReached.selector, id));
                vm.prank(minter);
                badge.mint(recipient, id);
            } else {
                vm.prank(minter);
                badge.mint(recipient, id);
                minted++;
            }
        }

        (,, uint256 totalMinted,) = badge.badgeInfo(id);
        assertLe(totalMinted, supply);
    }

    function test_fuzz_wasIssuedPersistsAfterRevoke(address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient.code.length == 0);

        uint256 id = _createAndFreezeBadge(MAX_SUPPLY);

        vm.prank(minter);
        badge.mint(recipient, id);

        assertTrue(badge.wasIssued(recipient, id));

        vm.prank(revoker);
        badge.revoke(recipient, id, bytes32(0));

        assertTrue(badge.wasIssued(recipient, id));
    }

    function test_fuzz_frozenMetadataCannotChange(string memory initialUri, string memory newUri) public {
        vm.assume(bytes(initialUri).length > 0);
        vm.assume(bytes(newUri).length > 0);

        vm.prank(eventManager);
        uint256 id = badge.createBadge(initialUri, MAX_SUPPLY);

        vm.prank(eventManager);
        badge.freezeMetadata(id);

        vm.expectRevert(abi.encodeWithSelector(OpenBadge.MetadataFrozen.selector, id));
        vm.prank(eventManager);
        badge.setMetadataURI(id, newUri);

        // Verify unchanged
        (string memory currentUri,,,) = badge.badgeInfo(id);
        assertEq(currentUri, initialUri);
    }

    function test_fuzz_nonZeroToNonZeroTransferAlwaysReverts(address from, address to) public {
        vm.assume(from != address(0));
        vm.assume(to != address(0));
        vm.assume(from != to);
        vm.assume(from.code.length == 0);

        uint256 id = _createAndFreezeBadge(MAX_SUPPLY);

        vm.prank(minter);
        badge.mint(from, id);

        vm.expectRevert(OpenBadge.TransfersDisabled.selector);
        vm.prank(from);
        badge.safeTransferFrom(from, to, id, 1, "");
    }

    function test_fuzz_tokenIdsMonotonicallyIncreasing(uint8 count) public {
        vm.assume(count > 0 && count <= 50);

        uint256 prev = 0;
        vm.startPrank(eventManager);
        for (uint256 i = 0; i < count; i++) {
            uint256 id = badge.createBadge(METADATA_URI, MAX_SUPPLY);
            assertGt(id, prev);
            prev = id;
        }
        vm.stopPrank();
    }

    function test_fuzz_pauseUnpauseSequence(bool[10] memory actions) public {
        // actions[i] = true means pause, false means unpause
        for (uint256 i = 0; i < 10; i++) {
            if (actions[i] && !badge.paused()) {
                vm.prank(pauser);
                badge.pause();
                assertTrue(badge.paused());
            } else if (!actions[i] && badge.paused()) {
                vm.prank(pauser);
                badge.unpause();
                assertFalse(badge.paused());
            }
        }
    }
}

// ===========================================================================
// Invariant Tests
// ===========================================================================

/// @dev Handler contract used by the invariant test runner to exercise the contract.
contract OpenBadgeHandler is Test {
    OpenBadge public immutable badge;

    address public immutable eventManager;
    address public immutable minter;
    address public immutable revoker;
    address public immutable pauser;

    uint256 public lastTokenId;
    address[] internal _allRecipients;
    uint256[] internal _allTokenIds;

    function allTokenIds() external view returns (uint256[] memory) {
        return _allTokenIds;
    }

    function allRecipients() external view returns (address[] memory) {
        return _allRecipients;
    }

    constructor(OpenBadge _badge, address _eventManager, address _minter, address _revoker, address _pauser) {
        badge = _badge;
        eventManager = _eventManager;
        minter = _minter;
        revoker = _revoker;
        pauser = _pauser;
    }

    function createBadge(uint256 supply) external {
        supply = bound(supply, 1, 1000);

        vm.prank(eventManager);
        uint256 id = badge.createBadge("ipfs://test", supply);
        lastTokenId = id;
        _allTokenIds.push(id);

        vm.prank(eventManager);
        badge.freezeMetadata(id);
    }

    function mintTo(address recipient, uint256 tokenIdSeed) external {
        if (_allTokenIds.length == 0) return;
        uint256 idx = tokenIdSeed % _allTokenIds.length;
        uint256 tokenId = _allTokenIds[idx];

        if (recipient == address(0)) return;
        if (recipient.code.length > 0) return;
        if (badge.wasIssued(recipient, tokenId)) return;

        (, uint256 maxSupply, uint256 totalMinted,) = badge.badgeInfo(tokenId);
        if (totalMinted >= maxSupply) return;

        vm.prank(minter);
        badge.mint(recipient, tokenId);
        _allRecipients.push(recipient);
    }

    function revokeFrom(address holder, uint256 tokenIdSeed) external {
        if (_allTokenIds.length == 0) return;
        uint256 idx = tokenIdSeed % _allTokenIds.length;
        uint256 tokenId = _allTokenIds[idx];

        if (badge.balanceOf(holder, tokenId) == 0) return;

        vm.prank(revoker);
        badge.revoke(holder, tokenId, bytes32(0));
    }

    function holderBurn(address holder, uint256 tokenIdSeed) external {
        if (_allTokenIds.length == 0) return;
        uint256 idx = tokenIdSeed % _allTokenIds.length;
        uint256 tokenId = _allTokenIds[idx];

        if (badge.balanceOf(holder, tokenId) == 0) return;

        vm.prank(holder);
        badge.burn(tokenId);
    }

    function togglePause() external {
        if (badge.paused()) {
            vm.prank(pauser);
            badge.unpause();
        } else {
            vm.prank(pauser);
            badge.pause();
        }
    }
}

contract OpenBadgeInvariantTest is Test {
    OpenBadge public badge;
    OpenBadgeHandler public handler;

    address public admin = makeAddr("inv_admin");
    address public eventManager = makeAddr("inv_eventManager");
    address public minter = makeAddr("inv_minter");
    address public pauser = makeAddr("inv_pauser");
    address public revoker = makeAddr("inv_revoker");

    function setUp() public {
        badge = new OpenBadge(admin, eventManager, minter, pauser, revoker);
        handler = new OpenBadgeHandler(badge, eventManager, minter, revoker, pauser);

        targetContract(address(handler));
    }

    /// @notice Token IDs are assigned starting from 1 and increment monotonically.
    function invariant_tokenIdZeroNeverExists() public view {
        assertFalse(badge.exists(0));
    }

    /// @notice The badge at any existing token ID always reports exists() == true.
    function invariant_existingBadgesReportExists() public view {
        uint256[] memory ids = handler.allTokenIds();
        for (uint256 i = 0; i < ids.length; i++) {
            assertTrue(badge.exists(ids[i]));
        }
    }

    /// @notice totalMinted never exceeds maxSupply for any badge.
    function invariant_totalMintedNeverExceedsMaxSupply() public view {
        uint256[] memory ids = handler.allTokenIds();
        for (uint256 i = 0; i < ids.length; i++) {
            (, uint256 maxSupply, uint256 totalMinted,) = badge.badgeInfo(ids[i]);
            assertLe(totalMinted, maxSupply);
        }
    }

    /// @notice wasIssued tracks lifetime issuance, not current balance.
    ///         If a wallet has a positive balance, wasIssued must be true.
    function invariant_balanceImpliesWasIssued() public view {
        uint256[] memory ids = handler.allTokenIds();
        address[] memory recipients = handler.allRecipients();

        for (uint256 i = 0; i < ids.length; i++) {
            for (uint256 j = 0; j < recipients.length; j++) {
                if (badge.balanceOf(recipients[j], ids[i]) > 0) {
                    assertTrue(badge.wasIssued(recipients[j], ids[i]));
                }
            }
        }
    }
}
