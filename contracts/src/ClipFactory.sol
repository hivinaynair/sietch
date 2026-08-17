// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Desk} from "./Desk.sol";
import {ISP1Verifier} from "./ISP1Verifier.sol";
import {TBill} from "./TBill.sol";

/// @title ClipFactory
/// @notice A reset button for the demo, plus a stable address for the website to point at.
///
/// The problem it solves: a `Desk` is single-use. Once a transfer settles, `usedTransfer` remembers
/// it and the share sits on Paul's books — so the clip cannot be walked a second time. The fix is a
/// brand new desk. But if the website pointed straight at a desk, every reset would mean editing an
/// environment variable in Vercel and redeploying.
///
/// So the website points *here* instead, and reads `factory.desk()` to find the current desk.
/// `rearm()` mints a fresh T-bill, stands up a fresh desk, and updates that pointer. The address the
/// website knows never changes, and the receipts in `artifacts/demo/` are still valid — a receipt
/// commits to the institutions, the asset and the transfer id, but never to a desk address, so
/// nothing has to be re-proved.
///
/// It is also a gas tank. ETH sent to this contract is forwarded to the clerk on each re-arm, so the
/// account that submits `settle()` can always afford to pay for proof verification.
contract ClipFactory {
    /// @notice Target balance for the clerk. Enough for several `settle()` calls on Base Sepolia.
    uint256 public constant CLIP_STIPEND = 0.005 ether;

    // ─── Settings, fixed at deploy time ────────────────────────────────────────
    // Everything a `Desk` needs in its constructor, held here so re-arming needs no arguments.

    /// @notice Whoever deployed this factory. The only account that may re-arm, and the account
    /// that gets topped up and seated as the desk's demo clerk.
    address public immutable owner;
    ISP1Verifier public immutable verifier;
    bytes32 public immutable programVKey;
    address public immutable sendingInstitution;
    address public immutable beneficiaryInstitution;
    bytes32 public immutable sendingHash;
    bytes32 public immutable inboundHash;
    address public immutable receiptToken;

    // ─── The pointer ───────────────────────────────────────────────────────────

    /// @notice The desk currently in play. This is what the website reads.
    address public desk;
    /// @notice The T-bill that desk holds a share of.
    address public tbill;
    /// @notice Block the current desk was armed at. The website starts scanning for events here
    /// rather than from genesis, so it never picks up a previous walk's settlement.
    uint256 public fromBlock;

    /// Someone other than the deployer tried to re-arm.
    error NotOwner();
    /// Sending ETH to the clerk failed.
    error FundFailed();

    /// @notice A fresh desk is live. Carries everything the website needs to follow the move.
    event Rearmed(address desk, address tbill, uint256 fromBlock);

    /// @dev `payable` lets the deployment carry ETH, which seeds the gas tank in one transaction.
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
        // Arm the first desk immediately, so deploying is all it takes to be ready.
        _rearm();
    }

    /// @notice Accept plain ETH transfers. This is how the gas tank gets refilled between walks.
    receive() external payable {}

    /// @notice Retire the current desk and stand up a fresh one. Owner only.
    function rearm() external payable {
        if (msg.sender != owner) revert NotOwner();
        _rearm();
    }

    /// @dev Build a new T-bill and desk, hand the desk its one share, and move the pointer.
    /// The old desk is not destroyed — it keeps its history, it simply stops being the one on show.
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
            owner, // the clerk allowed to call publishInbound during the demo
            receiptToken
        );

        // Idle books: one share on the desk, zero on Paul's. Exactly where the clip starts.
        newTbill.mint(address(newDesk), 1);

        desk = address(newDesk);
        tbill = address(newTbill);
        fromBlock = block.number;
        emit Rearmed(desk, tbill, fromBlock);

        _fundClerk();
    }

    /// @dev Top the clerk up to CLIP_STIPEND, if the tank can cover it.
    ///
    /// Sends only the shortfall, never the full stipend, so re-arming an already-funded clerk costs
    /// nothing. If the tank is short it sends whatever is left; if the clerk is already flush, or
    /// the tank is empty, it sends nothing and the re-arm still succeeds.
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
