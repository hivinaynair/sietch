// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISP1Verifier} from "./ISP1Verifier.sol";

/// @title MockVerifier
/// @notice Test double. Accepts any non-empty proof. Not Groth16.
///
/// Real Groth16 verification costs a lot of gas and needs a genuinely proved receipt, which would
/// make the test suite slow and awkward. Standing in for it here lets the tests feed `Desk`
/// hand-written receipts and check the desk's *own* rules — sides, matching fields, policy hashes,
/// replay — which is what those tests are actually about.
///
/// It still rejects an empty proof, so `Desk.t.sol` can prove the desk really does consult a
/// verifier rather than skipping the step.
///
/// This is only ever wired up in tests. Deployments pass the live gateway address instead.
contract MockVerifier is ISP1Verifier {
    error EmptyProof();

    function verifyProof(bytes32, bytes calldata, bytes calldata proofBytes) external pure {
        if (proofBytes.length == 0) revert EmptyProof();
    }
}
