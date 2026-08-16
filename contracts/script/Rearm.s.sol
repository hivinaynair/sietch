// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Desk} from "../src/Desk.sol";
import {TBill} from "../src/TBill.sol";
import {ISP1Verifier} from "../src/ISP1Verifier.sol";

/// @notice Fresh T-bill + desk for a live walk. Same receipts, empty usedTransfer.
///
/// Reusing the previous sTBILL would leave shares on 0x2222… from the last settle,
/// so idle books would already show Paul holding. A new token keeps the room at 1 / 0.
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

        vm.startBroadcast(pk);
        TBill tbill = new TBill();
        Desk desk = new Desk(
            ISP1Verifier(GATEWAY),
            vkey,
            tbill,
            CHANI_INSTITUTION,
            PAUL_INSTITUTION,
            chaniHash,
            paulHash,
            clerk,
            RECEIPT_TOKEN
        );
        tbill.mint(address(desk), 1);
        vm.stopBroadcast();

        console2.log("tbill", address(tbill));
        console2.log("desk", address(desk));
        console2.log("publisher", clerk);
    }
}
