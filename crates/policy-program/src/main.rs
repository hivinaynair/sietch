//! Thin zkVM shell. One stdin, one institution. Logic lives in `sietch-policy-guest`.

#![no_main]
sp1_zkvm::entrypoint!(main);

use sietch_policy_guest::{decode_stdin, encode_public, execute};

pub fn main() {
    let bytes = sp1_zkvm::io::read_vec();
    let input = decode_stdin(&bytes).expect("stdin must be exactly one institution");
    let out = execute(&input);
    sp1_zkvm::io::commit_slice(&encode_public(&out));
}
