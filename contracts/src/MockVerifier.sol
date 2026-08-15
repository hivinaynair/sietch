// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISP1Verifier} from "./ISP1Verifier.sol";

/// @notice Test double. Accepts any non-empty proof. Not Groth16.
contract MockVerifier is ISP1Verifier {
    error EmptyProof();

    function verifyProof(bytes32, bytes calldata, bytes calldata proofBytes) external pure {
        if (proofBytes.length == 0) revert EmptyProof();
    }
}
