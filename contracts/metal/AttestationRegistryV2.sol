// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AttestationRegistryV2
/// @notice Publishes a commitment to a compliance decision. The decision record
/// and its salt live off-chain; holders of both can verify against `commitment`.
/// Deliberately omits payer, paymentHash, amount, and identity status.
/// The USDC Transfer is still public — this hides the compliance book, not the payment.
/// See docs/plans/2026-08-16-privacy-primitive.md.
contract AttestationRegistryV2 {
    event AttestedCommitment(bytes32 indexed commitment, uint64 timestamp);

    function attest(bytes32 commitment) external {
        emit AttestedCommitment(commitment, uint64(block.timestamp));
    }
}
