// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Desk} from "./Desk.sol";
import {ISP1Verifier} from "./ISP1Verifier.sol";
import {TBill} from "./TBill.sol";

/// @notice Clerk-owned pointer. rearm() deploys a fresh T-bill + desk so the clip can be walked again.
///
/// Receipts do not bind the desk address, so a new desk restores idle books (1 / 0) without reproving.
/// ETH sent here is a gas tank: rearm() tops the clerk up to CLIP_STIPEND so settle() can pay verifyProof.
contract ClipFactory {
    uint256 public constant CLIP_STIPEND = 0.005 ether;

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
    error FundFailed();

    event Rearmed(address desk, address tbill, uint256 fromBlock);

    constructor(
        ISP1Verifier verifier_,
        bytes32 programVKey_,
        address sendingInstitution_,
        address beneficiaryInstitution_,
        bytes32 sendingHash_,
        bytes32 inboundHash_,
        address receiptToken_
    ) payable {
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

    receive() external payable {}

    function rearm() external payable {
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
        _fundClerk();
    }

    function _fundClerk() internal {
        uint256 have = owner.balance;
        if (have >= CLIP_STIPEND) {
            return;
        }
        uint256 gap = CLIP_STIPEND - have;
        uint256 send = address(this).balance < gap ? address(this).balance : gap;
        if (send == 0) {
            return;
        }
        (bool ok,) = owner.call{value: send}("");
        if (!ok) revert FundFailed();
    }
}
