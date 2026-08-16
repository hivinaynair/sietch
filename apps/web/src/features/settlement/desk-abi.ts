export const DESK_ABI = [
  {
    type: "function",
    name: "publishInbound",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyHash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "senderProof", type: "bytes" },
      { name: "senderPublic", type: "bytes" },
      { name: "receiverProof", type: "bytes" },
      { name: "receiverPublic", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "policyHashOf",
    stateMutability: "view",
    inputs: [{ name: "org", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "tbill",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    // Read rather than inferred from logs: state does not age out of a block window.
    type: "function",
    name: "usedTransfer",
    stateMutability: "view",
    inputs: [{ name: "transferId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "InboundPolicyPublished",
    inputs: [{ name: "policyHash", type: "bytes32", indexed: false }],
  },
  {
    type: "event",
    name: "SettlementPendingBeneficiaryPolicy",
    inputs: [
      { name: "transferId", type: "bytes32", indexed: false },
      { name: "senderAllowed", type: "bool", indexed: false },
      { name: "receiverAllowed", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SettledForPaul",
    inputs: [
      { name: "transferId", type: "bytes32", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const FACTORY_ABI = [
  {
    type: "function",
    name: "rearm",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "desk",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tbill",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "fromBlock",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const TBILL_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
