// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Desk} from "../src/Desk.sol";
import {TBill} from "../src/TBill.sol";
import {ISP1Verifier} from "../src/ISP1Verifier.sol";

/// @notice Base Sepolia Groth16 gateway. Swap in after a real program vkey exists.
contract DeployScript is Script {
    address constant GATEWAY = 0x397A5f7f3dBd538f23DE225B51f532c34448dA9B;
    address constant CHANI_INSTITUTION = address(0x1111111111111111111111111111111111111111);
    address constant PAUL_INSTITUTION = address(0x2222222222222222222222222222222222222222);

    function run() external {
        bytes32 vkey = vm.envBytes32("PROGRAM_VKEY");
        bytes32 chaniHash = vm.envBytes32("CHANI_POLICY_HASH");
        bytes32 paulHash = vm.envBytes32("PAUL_POLICY_HASH");

        vm.startBroadcast();
        TBill tbill = new TBill();
        Desk desk = new Desk(
            ISP1Verifier(GATEWAY),
            vkey,
            tbill,
            CHANI_INSTITUTION,
            PAUL_INSTITUTION,
            chaniHash,
            paulHash
        );
        tbill.mint(address(desk), 1);
        vm.stopBroadcast();

        desk;
    }
}
