// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISP1Verifier} from "./ISP1Verifier.sol";
import {TBill} from "./TBill.sol";

/// @notice Two receipts, one settlement. Institutions cannot rewrite their book.
contract Desk {
    uint8 public constant SIDE_OUTBOUND = 0;
    uint8 public constant SIDE_INBOUND = 1;
    uint8 public constant BOOK_INDIA = 0;
    uint8 public constant BOOK_US = 1;

    struct Receipt {
        bytes32 policyHash;
        address org;
        address token;
        uint256 amount;
        bytes32 transferId;
        uint8 side;
        bool allowed;
    }

    ISP1Verifier public immutable verifier;
    bytes32 public immutable programVKey;
    TBill public immutable tbill;
    address public immutable sendingInstitution;
    address public immutable beneficiaryInstitution;
    /// @notice Demo clerk. Production leaves this as address(0); only the beneficiary publishes.
    address public immutable publisher;
    /// @notice Token id committed in receipts. May differ from `tbill` (guest used 0x3333… before deploy).
    address public immutable receiptToken;

    mapping(address => uint8) public bookOf;
    mapping(address => bytes32) public policyHashOf;
    mapping(bytes32 => bool) public usedTransfer;

    event InboundPolicyPublished(bytes32 policyHash);
    event SettlementPendingBeneficiaryPolicy(
        bytes32 transferId, bool senderAllowed, bool receiverAllowed
    );
    event SettledForPaul(bytes32 transferId, uint256 amount);

    error NotBeneficiary();
    error BadSide();
    error Mismatch();
    error BadOrg();
    error BadToken();
    error BadHash();
    error Replay();
    error TransferFailed();

    constructor(
        ISP1Verifier verifier_,
        bytes32 programVKey_,
        TBill tbill_,
        address sendingInstitution_,
        address beneficiaryInstitution_,
        bytes32 sendingHash,
        bytes32 inboundHash,
        address publisher_,
        address receiptToken_
    ) {
        verifier = verifier_;
        programVKey = programVKey_;
        tbill = tbill_;
        sendingInstitution = sendingInstitution_;
        beneficiaryInstitution = beneficiaryInstitution_;
        publisher = publisher_;
        receiptToken = receiptToken_;
        bookOf[sendingInstitution_] = BOOK_INDIA;
        bookOf[beneficiaryInstitution_] = BOOK_US;
        policyHashOf[sendingInstitution_] = sendingHash;
        policyHashOf[beneficiaryInstitution_] = inboundHash;
    }

    function publishInbound(bytes32 policyHash) external {
        if (msg.sender != beneficiaryInstitution && msg.sender != publisher) {
            revert NotBeneficiary();
        }
        policyHashOf[beneficiaryInstitution] = policyHash;
        emit InboundPolicyPublished(policyHash);
    }

    function settle(
        bytes calldata senderProof,
        bytes calldata senderPublic,
        bytes calldata receiverProof,
        bytes calldata receiverPublic
    ) external {
        verifier.verifyProof(programVKey, senderPublic, senderProof);
        verifier.verifyProof(programVKey, receiverPublic, receiverProof);

        Receipt memory sender = _decode(senderPublic);
        Receipt memory receiver = _decode(receiverPublic);

        if (sender.side != SIDE_OUTBOUND || receiver.side != SIDE_INBOUND) revert BadSide();
        if (
            sender.transferId != receiver.transferId || sender.token != receiver.token
                || sender.amount != receiver.amount
        ) {
            revert Mismatch();
        }
        if (sender.org != sendingInstitution || receiver.org != beneficiaryInstitution) {
            revert BadOrg();
        }
        if (sender.token != receiptToken) revert BadToken();
        if (sender.policyHash != policyHashOf[sendingInstitution]) revert BadHash();
        if (receiver.policyHash != policyHashOf[beneficiaryInstitution]) revert BadHash();
        if (usedTransfer[sender.transferId]) revert Replay();

        if (sender.allowed && receiver.allowed) {
            usedTransfer[sender.transferId] = true;
            if (!tbill.transfer(beneficiaryInstitution, sender.amount)) revert TransferFailed();
            emit SettledForPaul(sender.transferId, sender.amount);
        } else {
            emit SettlementPendingBeneficiaryPolicy(
                sender.transferId, sender.allowed, receiver.allowed
            );
        }
    }

    function _decode(bytes calldata raw) internal pure returns (Receipt memory r) {
        (r.policyHash, r.org, r.token, r.amount, r.transferId, r.side, r.allowed) =
            abi.decode(raw, (bytes32, address, address, uint256, bytes32, uint8, bool));
    }
}
