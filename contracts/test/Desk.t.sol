// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Desk} from "../src/Desk.sol";
import {TBill} from "../src/TBill.sol";
import {MockVerifier} from "../src/MockVerifier.sol";

contract DeskTest is Test {
    address constant CHANI_INSTITUTION = address(0x1111111111111111111111111111111111111111);
    address constant PAUL_INSTITUTION = address(0x2222222222222222222222222222222222222222);
    bytes32 constant VKEY = bytes32(uint256(1));
    bytes32 constant CHANI_HASH = keccak256("outbound-v1");
    bytes32 constant PAUL_V1 = keccak256("inbound-v1");
    bytes32 constant PAUL_V2 = keccak256("inbound-v2");
    bytes32 constant TRANSFER = bytes32(uint256(0x44));
    bytes constant PROOF = hex"01";

    TBill tbill;
    MockVerifier verifier;
    Desk desk;

    function setUp() public {
        tbill = new TBill();
        verifier = new MockVerifier();
        desk = new Desk(
            verifier,
            VKEY,
            tbill,
            CHANI_INSTITUTION,
            PAUL_INSTITUTION,
            CHANI_HASH,
            PAUL_V1
        );
        tbill.mint(address(desk), 1);
    }

    function encode(
        bytes32 policyHash,
        address org,
        bool allowed,
        uint8 side
    ) internal view returns (bytes memory) {
        return abi.encode(policyHash, org, address(tbill), uint256(1), TRANSFER, side, allowed);
    }

    function chaniAllow() internal view returns (bytes memory) {
        return encode(CHANI_HASH, CHANI_INSTITUTION, true, desk.SIDE_OUTBOUND());
    }

    function paulDeny() internal view returns (bytes memory) {
        return encode(PAUL_V1, PAUL_INSTITUTION, false, desk.SIDE_INBOUND());
    }

    function paulAllowV2() internal view returns (bytes memory) {
        return encode(PAUL_V2, PAUL_INSTITUTION, true, desk.SIDE_INBOUND());
    }

    function test_paul_v1_denies_without_moving_the_share() public {
        desk.settle(PROOF, chaniAllow(), PROOF, paulDeny());
        assertEq(tbill.balanceOf(address(desk)), 1);
        assertEq(tbill.balanceOf(PAUL_INSTITUTION), 0);
    }

    function test_after_inbound_v2_same_instruction_settles_for_paul() public {
        desk.settle(PROOF, chaniAllow(), PROOF, paulDeny());

        vm.prank(PAUL_INSTITUTION);
        desk.publishInbound(PAUL_V2);

        desk.settle(PROOF, chaniAllow(), PROOF, paulAllowV2());
        assertEq(tbill.balanceOf(address(desk)), 0);
        assertEq(tbill.balanceOf(PAUL_INSTITUTION), 1);
    }

    function test_side_swap_is_rejected() public {
        bytes memory senderAsInbound =
            encode(CHANI_HASH, CHANI_INSTITUTION, true, desk.SIDE_INBOUND());
        bytes memory receiverAsOutbound =
            encode(PAUL_V1, PAUL_INSTITUTION, false, desk.SIDE_OUTBOUND());
        vm.expectRevert();
        desk.settle(PROOF, senderAsInbound, PROOF, receiverAsOutbound);
    }

    function test_replay_after_settle_is_rejected() public {
        bytes memory sender = chaniAllow();
        bytes memory receiver = paulAllowV2();
        vm.prank(PAUL_INSTITUTION);
        desk.publishInbound(PAUL_V2);
        desk.settle(PROOF, sender, PROOF, receiver);
        vm.expectRevert();
        desk.settle(PROOF, sender, PROOF, receiver);
    }

    function test_empty_proof_is_rejected() public {
        bytes memory sender = chaniAllow();
        bytes memory receiver = paulDeny();
        vm.expectRevert();
        desk.settle("", sender, PROOF, receiver);
    }

    function test_chani_cannot_publish_inbound() public {
        vm.prank(CHANI_INSTITUTION);
        vm.expectRevert();
        desk.publishInbound(PAUL_V2);
    }

    function test_directory_books_are_assigned() public view {
        assertEq(desk.bookOf(CHANI_INSTITUTION), desk.BOOK_INDIA());
        assertEq(desk.bookOf(PAUL_INSTITUTION), desk.BOOK_US());
    }
}
