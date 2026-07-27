// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {OpenBadge} from "../src/OpenBadge.sol";

/// @title Deploy
/// @notice Deploys the OpenBadge contract and writes a deployment record to the deployments directory.
///
/// Required environment variables:
///   DEPLOYER_PRIVATE_KEY    — private key of the deployer account (uint256)
///   ADMIN_ADDRESS           — address to receive DEFAULT_ADMIN_ROLE
///   EVENT_MANAGER_ADDRESS   — address to receive EVENT_MANAGER_ROLE
///   MINTER_ADDRESS          — address to receive MINTER_ROLE
///   PAUSER_ADDRESS          — address to receive PAUSER_ROLE
///   REVOKER_ADDRESS         — address to receive REVOKER_ROLE
///
/// Optional environment variables:
///   DEPLOYMENT_LABEL        — human-readable label (default: "OpenBadge V1")
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url $RPC_URL \
///     --broadcast \
///     --verify
contract Deploy is Script {
    function run() external {
        // ---- Read environment ----
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address eventManager = vm.envAddress("EVENT_MANAGER_ADDRESS");
        address minter = vm.envAddress("MINTER_ADDRESS");
        address pauser = vm.envAddress("PAUSER_ADDRESS");
        address revoker = vm.envAddress("REVOKER_ADDRESS");
        string memory label = vm.envOr("DEPLOYMENT_LABEL", string("OpenBadge V1"));

        address deployer = vm.addr(deployerKey);

        // ---- Pre-flight checks ----
        require(admin != address(0), "Deploy: ADMIN_ADDRESS is zero");
        require(eventManager != address(0), "Deploy: EVENT_MANAGER_ADDRESS is zero");
        require(minter != address(0), "Deploy: MINTER_ADDRESS is zero");
        require(pauser != address(0), "Deploy: PAUSER_ADDRESS is zero");
        require(revoker != address(0), "Deploy: REVOKER_ADDRESS is zero");

        console2.log("=== OpenBadge Deployment ===");
        console2.log("Label           :", label);
        console2.log("Chain ID        :", block.chainid);
        console2.log("Deployer        :", deployer);
        console2.log("Admin           :", admin);
        console2.log("Event Manager   :", eventManager);
        console2.log("Minter          :", minter);
        console2.log("Pauser          :", pauser);
        console2.log("Revoker         :", revoker);

        // ---- Deploy ----
        vm.startBroadcast(deployerKey);
        OpenBadge openbadge = new OpenBadge(admin, eventManager, minter, pauser, revoker);
        vm.stopBroadcast();

        address contractAddress = address(openbadge);
        console2.log("");
        console2.log("=== Deployment Complete ===");
        console2.log("Contract address:", contractAddress);
        console2.log("Block number    :", block.number);
        console2.log("Timestamp       :", block.timestamp);

        // ---- Verify role assignments ----
        require(openbadge.hasRole(openbadge.DEFAULT_ADMIN_ROLE(), admin), "Deploy: admin role not set");
        require(
            openbadge.hasRole(openbadge.EVENT_MANAGER_ROLE(), eventManager), "Deploy: eventManager role not set"
        );
        require(openbadge.hasRole(openbadge.MINTER_ROLE(), minter), "Deploy: minter role not set");
        require(openbadge.hasRole(openbadge.PAUSER_ROLE(), pauser), "Deploy: pauser role not set");
        require(openbadge.hasRole(openbadge.REVOKER_ROLE(), revoker), "Deploy: revoker role not set");
        console2.log("Role verification: PASSED");

        // ---- Save deployment record ----
        _saveDeployment(label, contractAddress, deployer, admin, eventManager, minter, pauser, revoker);
    }

    function _saveDeployment(
        string memory label,
        address contractAddress,
        address deployer,
        address admin,
        address eventManager,
        address minter,
        address pauser,
        address revoker
    ) internal {
        string memory chainId = vm.toString(block.chainid);
        string memory path = string.concat("deployments/", chainId, ".json");

        // Manual JSON construction — no forge-std serialization dependency.
        string memory json = string.concat(
            "{\n",
            '  "label": "',
            label,
            '",\n',
            '  "contractName": "OpenBadge",\n',
            '  "chainId": "',
            chainId,
            '",\n',
            '  "address": "',
            vm.toString(contractAddress),
            '",\n',
            '  "deployer": "',
            vm.toString(deployer),
            '",\n',
            '  "blockNumber": "',
            vm.toString(block.number),
            '",\n',
            '  "timestamp": "',
            vm.toString(block.timestamp),
            '",\n',
            '  "roles": {\n',
            '    "admin": "',
            vm.toString(admin),
            '",\n',
            '    "eventManager": "',
            vm.toString(eventManager),
            '",\n',
            '    "minter": "',
            vm.toString(minter),
            '",\n',
            '    "pauser": "',
            vm.toString(pauser),
            '",\n',
            '    "revoker": "',
            vm.toString(revoker),
            '"\n',
            "  },\n",
            '  "compiler": "0.8.25",\n',
            '  "optimizerRuns": 200\n',
            "}\n"
        );

        vm.writeFile(path, json);
        console2.log("Deployment record saved to:", path);
    }
}
