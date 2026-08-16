// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ClipFactory} from "../src/ClipFactory.sol";
import {ISP1Verifier} from "../src/ISP1Verifier.sol";

/// @notice Fresh T-bill + desk for a live walk. Same receipts, empty usedTransfer.
///
/// Deploys ClipFactory on first run (constructor arms a desk). Later runs call factory.rearm()
/// so the website pointer stays put — no Vercel env bump, no reprove.
contract RearmScript is Script {
    address constant GATEWAY = 0x397A5f7f3dBd538f23DE225B51f532c34448dA9B;
    address constant CHANI_INSTITUTION = address(0x1111111111111111111111111111111111111111);
    address constant PAUL_INSTITUTION = address(0x2222222222222222222222222222222222222222);
    address constant RECEIPT_TOKEN = address(0x3333333333333333333333333333333333333333);

    function run() external {
        bytes32 vkey = vm.envBytes32("PROGRAM_VKEY");
        bytes32 chaniHash = vm.envBytes32("CHANI_POLICY_HASH");
        bytes32 paulHash = vm.envBytes32("PAUL_POLICY_HASH");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address clerk = vm.addr(pk);
        address existing = vm.envOr("SIETCH_FACTORY_ADDRESS", address(0));

        vm.startBroadcast(pk);
        ClipFactory factory;
        if (existing == address(0)) {
            factory = new ClipFactory(
                ISP1Verifier(GATEWAY),
                vkey,
                CHANI_INSTITUTION,
                PAUL_INSTITUTION,
                chaniHash,
                paulHash,
                RECEIPT_TOKEN
            );
        } else {
            factory = ClipFactory(existing);
            factory.rearm();
        }
        vm.stopBroadcast();

        console2.log("factory", address(factory));
        console2.log("tbill", factory.tbill());
        console2.log("desk", factory.desk());
        console2.log("fromBlock", factory.fromBlock());
        console2.log("publisher", clerk);
    }
}
