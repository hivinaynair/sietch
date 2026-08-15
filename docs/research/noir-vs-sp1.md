# Noir vs SP1 (research)

Comparison for Qanat: prove an inbound institutional policy at settlement without putting clauses on-chain.

Sources accessed 2026-08-15:

- [Noir docs](https://noir-lang.org/docs) (v1.0.0-beta.26)
- [Noir getting started (manual)](https://noir-lang.org/docs/getting_started_manually)
- [NoirJS tutorial](https://noir-lang.org/docs/tutorials/noirjs_app)
- [SP1 introduction](https://docs.succinct.xyz/docs/sp1/introduction)
- [What is a zkVM?](https://docs.succinct.xyz/docs/sp1/what-is-a-zkvm)
- [SP1 on-chain verification](https://docs.succinct.xyz/docs/sp1/verification/getting-started)
- [SP1 contract addresses](https://docs.succinct.xyz/docs/sp1/verification/contract-addresses)
- [SP1 deployments Base Sepolia (84532)](https://github.com/succinctlabs/sp1-contracts/blob/main/contracts/deployments/84532.json)

## What they are

**Noir** is a domain-specific language for SNARK programs. It compiles to ACIR, then a proving backend (default: Aztec Barretenberg) produces a proof. Inputs are private unless marked `pub`. Barretenberg can emit a Solidity verifier (`bb contract`). NoirJS + `@aztec/bb.js` can prove from a JavaScript app.

**SP1** is a zkVM: it proves execution of a RISC-V program. The guest is ordinary Rust (`sp1_zkvm::io::read` / `commit`). Native proofs are STARKs; for Ethereum they recursively wrap into Groth16 or PLONK. Local Groth16/PLONK proving requires Docker and at least 16GB RAM. Canonical `SP1VerifierGateway` contracts are already deployed on many chains, including Base Sepolia.

## On-chain on Base Sepolia

SP1 Groth16 gateway (84532): `0x397A5f7f3dBd538f23DE225B51f532c34448dA9B`. Application contract calls `ISP1Verifier.verifyProof(vkey, publicValues, proofBytes)`.

Noir: you generate and **deploy your own** verifier bytecode per circuit. Nothing equivalent to Succinct’s gateway is assumed on Base.

## Fit for Qanat

| | Noir | SP1 |
|---|---|---|
| Mental model | Circuit / asserts | Program execution |
| Language | Noir (Rust-like DSL) | Rust guest |
| Next.js proving | First-class (NoirJS) | Not in browser |
| On-chain | Deploy generated verifier | Call existing gateway |
| Policy growth | Circuit size | Cycle count |
| Metal thesis | Privacy-preserving program | Programmable rules as programs |

Recommendation recorded in the design discussion: **SP1** for impact on Loong; keep the guest tiny; precompute proofs for the public URL (delivery C).
