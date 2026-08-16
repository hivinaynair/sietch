// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Desk} from "./Desk.sol";
import {ISP1Verifier} from "./ISP1Verifier.sol";
import {TBill} from "./TBill.sol";

/// @notice Clerk-owned pointer. rearm() deploys a fresh T-bill + desk so the clip can be walked again.
///
/// Receipts do not bind the desk address, so a new desk restores idle books (1 / 0) without reproving.
contract ClipFactory {
    address public immutable owner;
    ISP1Verifier public immutable verifier;
    bytes32 public immutable programVKey;
    address public immutable sendingInstitution;
    address public immutable beneficiaryInstitution;
    bytes32 public immutable sendingHash;
    bytes32 public immutable inboundHash;
    address public immutable receiptToken;

    address public desk;
    address public tbill;
    uint256 public fromBlock;

    error NotOwner();

    event Rearmed(address desk, address tbill, uint256 fromBlock);

    constructor(
        ISP1Verifier verifier_,
        bytes32 programVKey_,
        address sendingInstitution_,
        address beneficiaryInstitution_,
        bytes32 sendingHash_,
        bytes32 inboundHash_,
        address receiptToken_
    ) {
        owner = msg.sender;
        verifier = verifier_;
        programVKey = programVKey_;
        sendingInstitution = sendingInstitution_;
        beneficiaryInstitution = beneficiaryInstitution_;
        sendingHash = sendingHash_;
        inboundHash = inboundHash_;
        receiptToken = receiptToken_;
        _rearm();
    }

    function rearm() external {
        if (msg.sender != owner) revert NotOwner();
        _rearm();
    }

    function _rearm() internal {
        TBill newTbill = new TBill();
        Desk newDesk = new Desk(
            verifier,
            programVKey,
            newTbill,
            sendingInstitution,
            beneficiaryInstitution,
            sendingHash,
            inboundHash,
            owner,
            receiptToken
        );
        newTbill.mint(address(newDesk), 1);
        desk = address(newDesk);
        tbill = address(newTbill);
        fromBlock = block.number;
        emit Rearmed(desk, tbill, fromBlock);
    }
}
