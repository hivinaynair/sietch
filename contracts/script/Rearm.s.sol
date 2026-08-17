// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ClipFactory} from "../src/ClipFactory.sol";
import {ISP1Verifier} from "../src/ISP1Verifier.sol";

/// @title RearmScript
/// @notice Fresh T-bill + desk for a live walk. Same receipts, empty usedTransfer.
///
/// A Foundry script is not a deployed contract — it is Solidity used as a deployment tool. Foundry
/// runs `run()` locally, watches which calls happen between `startBroadcast` and `stopBroadcast`,
/// and sends exactly those to the network as real transactions. Everything else is simulation.
///
/// Two paths. With no `SIETCH_FACTORY_ADDRESS` set, it deploys `ClipFactory`, whose constructor
/// arms the first desk. With one set, it calls `factory.rearm()` instead, so the website pointer
/// stays put — no Vercel env bump, no reprove.
///
/// Do not run this by hand. `bun run rearm` (scripts/rearm.mjs) wraps it, supplies the vkey and
/// policy hashes, and writes the resulting addresses to `artifacts/demo/chain.json`.
contract RearmScript is Script {
    /// @notice Succinct's Groth16 verifier on Base Sepolia.
    address constant GATEWAY = 0x397A5f7f3dBd538f23DE225B51f532c34448dA9B;
    /// Placeholder institution addresses. The zk receipts were proved against these exact values,
    /// so they are fixed — changing one would invalidate every receipt in `artifacts/demo/`.
    address constant CHANI_INSTITUTION = address(0x1111111111111111111111111111111111111111);
    address constant PAUL_INSTITUTION = address(0x2222222222222222222222222222222222222222);
    address constant RECEIPT_TOKEN = address(0x3333333333333333333333333333333333333333);

    function run() external {
        // `vm` is Foundry's cheatcode handle — here, reading environment variables.
        bytes32 vkey = vm.envBytes32("PROGRAM_VKEY");
        bytes32 chaniHash = vm.envBytes32("CHANI_POLICY_HASH");
        bytes32 paulHash = vm.envBytes32("PAUL_POLICY_HASH");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address clerk = vm.addr(pk); // the address that private key controls
        // envOr: fall back to address(0) — meaning "no factory yet" — when unset.
        address existing = vm.envOr("SIETCH_FACTORY_ADDRESS", address(0));

        // Everything from here until stopBroadcast is sent on chain, signed by `pk`.
        vm.startBroadcast(pk);

        ClipFactory factory;
        // Seed the factory's gas tank at deploy, but only if the clerk can spare it.
        uint256 tank = clerk.balance > 0.01 ether ? 0.005 ether : 0;

        if (existing == address(0)) {
            // First run: deploy the factory. Its constructor arms desk #1.
            factory = new ClipFactory{value: tank}(
                ISP1Verifier(GATEWAY),
                vkey,
                CHANI_INSTITUTION,
                PAUL_INSTITUTION,
                chaniHash,
                paulHash,
                RECEIPT_TOKEN
            );
        } else {
            // Later runs: reuse the factory the website already points at, and rotate its desk.
            factory = ClipFactory(payable(existing));
            factory.rearm();
        }

        vm.stopBroadcast();

        // Printed for scripts/rearm.mjs and for the operator watching the terminal.
        console2.log("factory", address(factory));
        console2.log("tbill", factory.tbill());
        console2.log("desk", factory.desk());
        console2.log("fromBlock", factory.fromBlock());
        console2.log("publisher", clerk);
    }
}
