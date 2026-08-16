// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {console2} from "forge-std/console2.sol";
import {Desk} from "../src/Desk.sol";

/// @notice Broadcast the clip: settle (pending) → publish v2 → settle (for Paul).
contract ClipScript is Script {
    using stdJson for string;

    function run() external {
        Desk desk = Desk(vm.envAddress("DESK"));
        bytes32 paulV2 = vm.envBytes32("PAUL_POLICY_HASH_V2");

        (bytes memory chaniOut, bytes memory chaniPub) = _receipt("chani-outbound");
        (bytes memory paulV1, bytes memory paulV1Pub) = _receipt("paul-inbound-v1");
        (bytes memory chaniRetry, bytes memory chaniRetryPub) = _receipt("chani-outbound-retry");
        (bytes memory paulV2Proof, bytes memory paulV2Pub) = _receipt("paul-inbound-v2");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        desk.settle(chaniOut, chaniPub, paulV1, paulV1Pub);
        desk.publishInbound(paulV2);
        desk.settle(chaniRetry, chaniRetryPub, paulV2Proof, paulV2Pub);
        vm.stopBroadcast();

        console2.log("desk", address(desk));
        console2.log("paul books", desk.tbill().balanceOf(desk.beneficiaryInstitution()));
    }

    function _receipt(string memory slug) internal view returns (bytes memory proof, bytes memory publics) {
        string memory path = string.concat(vm.projectRoot(), "/../artifacts/demo/", slug, ".groth16.json");
        string memory raw = vm.readFile(path);
        proof = raw.readBytes(".proof");
        publics = raw.readBytes(".publicValues");
    }
}
