// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ClipFactory} from "../src/ClipFactory.sol";
import {Desk} from "../src/Desk.sol";
import {TBill} from "../src/TBill.sol";
import {MockVerifier} from "../src/MockVerifier.sol";

contract ClipFactoryTest is Test {
    receive() external payable {}

    address constant CHANI_INSTITUTION = address(0x1111111111111111111111111111111111111111);
    address constant PAUL_INSTITUTION = address(0x2222222222222222222222222222222222222222);
    address constant RECEIPT_TOKEN = address(0x3333333333333333333333333333333333333333);
    bytes32 constant VKEY = bytes32(uint256(1));
    bytes32 constant CHANI_HASH = keccak256("outbound-v1");
    bytes32 constant PAUL_V1 = keccak256("inbound-v1");

    MockVerifier verifier;
    ClipFactory factory;

    function setUp() public {
        verifier = new MockVerifier();
        factory = new ClipFactory(
            verifier, VKEY, CHANI_INSTITUTION, PAUL_INSTITUTION, CHANI_HASH, PAUL_V1, RECEIPT_TOKEN
        );
    }

    function test_constructor_arms_a_desk_with_one_share() public view {
        address desk = factory.desk();
        address tbill = factory.tbill();
        assertTrue(desk != address(0));
        assertTrue(tbill != address(0));
        assertEq(TBill(tbill).balanceOf(desk), 1);
        assertEq(TBill(tbill).balanceOf(PAUL_INSTITUTION), 0);
        assertEq(factory.fromBlock(), block.number);
        assertEq(address(Desk(desk).tbill()), tbill);
        assertEq(Desk(desk).publisher(), address(this));
        assertEq(Desk(desk).beneficiaryInstitution(), PAUL_INSTITUTION);
    }

    function test_rearm_rotates_the_desk_and_leaves_paul_at_zero() public {
        address firstDesk = factory.desk();
        address firstTbill = factory.tbill();

        vm.roll(block.number + 10);
        factory.rearm();

        address desk = factory.desk();
        address tbill = factory.tbill();
        assertTrue(desk != firstDesk);
        assertTrue(tbill != firstTbill);
        assertEq(TBill(tbill).balanceOf(desk), 1);
        assertEq(TBill(tbill).balanceOf(PAUL_INSTITUTION), 0);
        assertEq(TBill(firstTbill).balanceOf(PAUL_INSTITUTION), 0);
        assertEq(factory.fromBlock(), block.number);
    }

    function test_non_owner_cannot_rearm() public {
        vm.prank(address(0xdead));
        vm.expectRevert(ClipFactory.NotOwner.selector);
        factory.rearm();
    }

    function test_rearm_tops_the_clerk_up_to_the_stipend() public {
        vm.deal(address(this), 0);
        vm.deal(address(factory), 0.01 ether);
        factory.rearm();
        assertEq(address(this).balance, 0.005 ether);
        assertEq(address(factory).balance, 0.005 ether);
    }

    function test_rearm_does_not_overfill_a_funded_clerk() public {
        vm.deal(address(this), 0.005 ether);
        vm.deal(address(factory), 0.01 ether);
        factory.rearm();
        assertEq(address(this).balance, 0.005 ether);
        assertEq(address(factory).balance, 0.01 ether);
    }

    function test_rearm_sends_whatever_the_factory_has_if_short() public {
        vm.deal(address(this), 0);
        vm.deal(address(factory), 0.001 ether);
        factory.rearm();
        assertEq(address(this).balance, 0.001 ether);
        assertEq(address(factory).balance, 0);
    }
}
