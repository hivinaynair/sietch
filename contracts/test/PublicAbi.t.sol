// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

/// @notice Rust `encode_public` must match this exact abi.encode (224 bytes).
contract PublicAbiTest is Test {
    function test_abi_layout_is_seven_words() public pure {
        bytes memory encoded = abi.encode(
            bytes32(uint256(0xaa)),
            address(0x1111111111111111111111111111111111111111),
            address(0x3333333333333333333333333333333333333333),
            uint256(1),
            bytes32(hex"4444444444444444444444444444444444444444444444444444444444444444"),
            uint8(0),
            true
        );
        assertEq(encoded.length, 224);
        (bytes32 h,,,,,, bool ok) =
            abi.decode(encoded, (bytes32, address, address, uint256, bytes32, uint8, bool));
        assertEq(h, bytes32(uint256(0xaa)));
        assertTrue(ok);
    }
}
