// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISP1Verifier} from "./ISP1Verifier.sol";
import {TBill} from "./TBill.sol";

/// @title Desk
/// @notice The settlement desk. Two institutions, two proofs, one share of a T-bill.
///
/// The story it enforces: Chani's bank (India) wants to send a share to Paul's bank (US). Each side
/// runs its own compliance policy off chain, inside a zero-knowledge program, and comes back with a
/// receipt — a proof plus a short list of public facts. The desk moves the share only when *both*
/// receipts say yes and every fact on them lines up.
///
/// What the desk never sees: the policies themselves, the customer data, the reasoning. It sees a
/// hash of the policy and a yes/no. That is the whole point.
contract Desk {
    /// Which direction a receipt describes. The sender's receipt must be OUTBOUND and the
    /// receiver's must be INBOUND, so a caller cannot hand in the same receipt twice.
    uint8 public constant SIDE_OUTBOUND = 0;
    uint8 public constant SIDE_INBOUND = 1;

    /// Labels for the two institutions, recorded in `bookOf` so a reader can tell them apart.
    /// Nothing in `settle` branches on these — they are a directory, not a rule.
    uint8 public constant BOOK_INDIA = 0;
    uint8 public constant BOOK_US = 1;

    /// @notice The public facts carried by one side's proof — the only thing the desk learns.
    /// The zk program's Rust code writes these seven fields in exactly this order; `_decode`
    /// reads them back. `contracts/test/PublicAbi.t.sol` guards that the layout stays 224 bytes.
    struct Receipt {
        /// Hash of the policy that was run. Proves *which* rulebook, without revealing it.
        bytes32 policyHash;
        /// The institution this receipt speaks for.
        address org;
        /// The asset being moved.
        address token;
        /// How many shares.
        uint256 amount;
        /// Unique id for this transfer attempt. Spent once, so a passing pair cannot be replayed.
        bytes32 transferId;
        /// SIDE_OUTBOUND or SIDE_INBOUND.
        uint8 side;
        /// The verdict. Did this side's policy permit the transfer?
        bool allowed;
    }

    // ─── Settings, fixed at deploy time ────────────────────────────────────────
    // `immutable` means: assigned once in the constructor, then frozen forever. Cheap to read.

    /// @notice Checks zk proofs. On Base Sepolia this is Succinct's Groth16 gateway; in tests, a mock.
    ISP1Verifier public immutable verifier;
    /// @notice Fingerprint of the exact zk program allowed to produce receipts. A proof from any
    /// other program — even a truthful one — fails verification.
    bytes32 public immutable programVKey;
    /// @notice The toy T-bill whose shares this desk moves. The desk holds them and pays out.
    TBill public immutable tbill;
    /// @notice Chani's side. Sends the share.
    address public immutable sendingInstitution;
    /// @notice Paul's side. Receives the share, and owns the inbound policy.
    address public immutable beneficiaryInstitution;
    /// @notice Demo clerk. Production leaves this as address(0); only the beneficiary publishes.
    address public immutable publisher;
    /// @notice Token id committed in receipts. May differ from `tbill` (guest used 0x3333… before deploy).
    address public immutable receiptToken;

    // ─── State that changes ────────────────────────────────────────────────────
    // A `mapping` is an on-chain lookup table. Every key it has never seen returns zero.

    /// @notice Which book an institution keeps. Informational; see BOOK_INDIA / BOOK_US.
    mapping(address => uint8) public bookOf;
    /// @notice The policy hash each institution is currently standing behind. A receipt is only
    /// accepted if it was produced under the hash published here — so an institution cannot
    /// quietly settle under an old rulebook, and cannot retroactively rewrite the one it used.
    mapping(address => bytes32) public policyHashOf;
    /// @notice Transfer ids already settled. Prevents replaying a winning pair of receipts.
    mapping(bytes32 => bool) public usedTransfer;

    // ─── Events: the public record ─────────────────────────────────────────────
    // Contracts cannot read events; people and web apps can. The settlement room in `apps/web`
    // renders the clip by reading exactly these three.

    /// @notice Paul's side changed its rulebook.
    event InboundPolicyPublished(bytes32 policyHash);
    /// @notice Both proofs were valid, but at least one side said no. Nothing moved. Retryable.
    event SettlementPendingBeneficiaryPolicy(
        bytes32 transferId, bool senderAllowed, bool receiverAllowed
    );
    /// @notice Both sides said yes. The share moved to Paul's institution.
    event SettledForPaul(bytes32 transferId, uint256 amount);

    // ─── Failures ──────────────────────────────────────────────────────────────
    // A revert undoes the entire call — no state changes, no share moved. Each name below is one
    // specific reason `settle` refused, so a caller can tell what went wrong.

    /// Someone other than Paul's institution (or the demo clerk) tried to publish a policy.
    error NotBeneficiary();
    /// The receipts were not one outbound and one inbound.
    error BadSide();
    /// The two receipts disagree about the transfer id, the token, or the amount.
    error Mismatch();
    /// A receipt was signed for an institution this desk does not serve.
    error BadOrg();
    /// The receipts are about some other asset.
    error BadToken();
    /// A receipt was produced under a policy that is not the one currently published.
    error BadHash();
    /// This transfer already settled.
    error Replay();
    /// The share could not be moved. Should not happen; the desk is funded at deploy.
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

        // Seat the two institutions and record the rulebook each one starts with.
        bookOf[sendingInstitution_] = BOOK_INDIA;
        bookOf[beneficiaryInstitution_] = BOOK_US;
        policyHashOf[sendingInstitution_] = sendingHash;
        policyHashOf[beneficiaryInstitution_] = inboundHash;
    }

    /// @notice Paul's institution swaps in a new inbound policy.
    ///
    /// This is the hinge of the demo. The first attempt fails because Paul's v1 policy denies the
    /// transfer. Paul publishes v2 here, and the *same* pair of instructions then settles — with no
    /// new proof from Chani's side, because Chani's receipt never depended on Paul's rulebook.
    ///
    /// @param policyHash Fingerprint of the new rulebook. The policy itself stays off chain.
    function publishInbound(bytes32 policyHash) external {
        // `msg.sender` is the account that sent this transaction.
        if (msg.sender != beneficiaryInstitution && msg.sender != publisher) {
            revert NotBeneficiary();
        }
        policyHashOf[beneficiaryInstitution] = policyHash;
        emit InboundPolicyPublished(policyHash);
    }

    /// @notice Present both sides' receipts and try to settle.
    ///
    /// Anyone may call this — the proofs are the authority, not the caller. The desk checks, in
    /// order: both proofs are real, the two receipts describe the same transfer, they come from the
    /// institutions this desk serves, they were produced under the currently published policies, and
    /// the transfer has not already settled. Only then does the verdict matter.
    ///
    /// A denial is not an error. If either side said no, the desk emits
    /// `SettlementPendingBeneficiaryPolicy` and leaves `usedTransfer` untouched, so the same
    /// transfer id can be presented again after a policy changes. That is what makes the clip work.
    ///
    /// @param senderProof    Chani's zk proof.
    /// @param senderPublic   Chani's receipt, ABI-encoded.
    /// @param receiverProof  Paul's zk proof.
    /// @param receiverPublic Paul's receipt, ABI-encoded.
    function settle(
        bytes calldata senderProof,
        bytes calldata senderPublic,
        bytes calldata receiverProof,
        bytes calldata receiverPublic
    ) external {
        // Step 1 — are these real proofs from the expected program? Reverts if not.
        verifier.verifyProof(programVKey, senderPublic, senderProof);
        verifier.verifyProof(programVKey, receiverPublic, receiverProof);

        Receipt memory sender = _decode(senderPublic);
        Receipt memory receiver = _decode(receiverPublic);

        // Step 2 — one outbound, one inbound. Blocks handing in the same side twice.
        if (sender.side != SIDE_OUTBOUND || receiver.side != SIDE_INBOUND) revert BadSide();

        // Step 3 — the two receipts must describe one and the same transfer.
        if (
            sender.transferId != receiver.transferId || sender.token != receiver.token
                || sender.amount != receiver.amount
        ) {
            revert Mismatch();
        }

        // Step 4 — and it must be this desk's two institutions, and this desk's asset.
        if (sender.org != sendingInstitution || receiver.org != beneficiaryInstitution) {
            revert BadOrg();
        }
        if (sender.token != receiptToken) revert BadToken();

        // Step 5 — each receipt must have been produced under the policy that side has published.
        // This is what stops an institution from settling under a rulebook it has since replaced.
        if (sender.policyHash != policyHashOf[sendingInstitution]) revert BadHash();
        if (receiver.policyHash != policyHashOf[beneficiaryInstitution]) revert BadHash();

        // Step 6 — spend the transfer id at most once.
        if (usedTransfer[sender.transferId]) revert Replay();

        // Step 7 — the verdict.
        if (sender.allowed && receiver.allowed) {
            usedTransfer[sender.transferId] = true;
            if (!tbill.transfer(beneficiaryInstitution, sender.amount)) revert TransferFailed();
            emit SettledForPaul(sender.transferId, sender.amount);
        } else {
            // Deliberately does not mark `usedTransfer` — a denial can be retried after a
            // policy change, with the very same receipts.
            emit SettlementPendingBeneficiaryPolicy(
                sender.transferId, sender.allowed, receiver.allowed
            );
        }
    }

    /// @dev Unpack the seven public values the zk program committed to. The field order here must
    /// match `encode_public` in `crates/policy-guest` exactly; `PublicAbi.t.sol` pins the layout.
    function _decode(bytes calldata raw) internal pure returns (Receipt memory r) {
        (r.policyHash, r.org, r.token, r.amount, r.transferId, r.side, r.allowed) =
            abi.decode(raw, (bytes32, address, address, uint256, bytes32, uint8, bool));
    }
}
