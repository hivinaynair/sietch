// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISP1Verifier
/// @notice The one thing the desk needs from a proof system: a way to ask "is this proof real?".
///
/// An `interface` is a contract's shape with no code behind it — a promise that whatever address you
/// point at has this function. It lets `Desk` be written against proof verification in the abstract
/// and be handed a different implementation depending on where it runs: Succinct's real Groth16
/// gateway on Base Sepolia, `MockVerifier` in tests.
interface ISP1Verifier {
    /// @notice Reverts if the proof is invalid. Returns nothing when it is valid — there is no
    /// boolean to accidentally ignore, so a failed check can never be treated as a pass.
    /// @param programVKey  Fingerprint of the zk program the proof must have come from.
    /// @param publicValues The facts the program committed to — the receipt.
    /// @param proofBytes   The proof itself.
    function verifyProof(
        bytes32 programVKey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}
