// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Succinct ISP1Verifier. Mock implements this; later the Base Sepolia gateway does.
interface ISP1Verifier {
    function verifyProof(
        bytes32 programVKey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}
