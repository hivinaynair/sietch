//! Host side of the guest. Writes **one** stdin, executes the ELF, reads publics.
//!
//! This is `cargo run -- --execute` in SP1 terms. No Groth16 here.
//! Host uses the **light** client: run the ELF, do not load proving keys.

use sietch_policy::{OrgId, Side};
use sietch_policy_guest::{
    decode_public, encode_public, encode_stdin, GuestInput, PublicValues, CLIP_TRANSFER,
    CLIP_TRANSFER_RETRY, DEMO_TBILL,
};
use sp1_sdk::{include_elf, Elf, Prover, ProverClient, SP1PublicValues, SP1Stdin};

/// Compiled guest. Built by `build.rs` via `cargo prove`.
pub const ELF: Elf = include_elf!("sietch-policy-program");

pub fn stdin_one_institution(input: &GuestInput) -> SP1Stdin {
    let mut stdin = SP1Stdin::new();
    stdin.write_vec(encode_stdin(input).to_vec());
    stdin
}

pub fn read_public(public_values: &SP1PublicValues) -> PublicValues {
    decode_public(public_values.as_slice()).expect("abi-encoded public values")
}

pub fn clip_input(org: OrgId, side: Side, origin: sietch_policy::Book, open: bool) -> GuestInput {
    clip_input_id(org, side, origin, open, CLIP_TRANSFER)
}

pub fn clip_input_id(
    org: OrgId,
    side: Side,
    origin: sietch_policy::Book,
    open: bool,
    transfer_id: [u8; 32],
) -> GuestInput {
    GuestInput {
        policy: sietch_policy::Policy {
            max_amount: 10,
            accepts_cross_border: open,
        },
        delivery: sietch_policy::Delivery {
            amount: 1,
            origin,
        },
        side,
        org,
        token: DEMO_TBILL,
        transfer_id,
    }
}

/// One frozen receipt for the public clip. Isolated stdin. Never both policies.
pub struct ClipCase {
    pub slug: &'static str,
    pub seat: &'static str,
    pub side_label: &'static str,
    pub input: GuestInput,
}

pub fn clip_case(slug: &str) -> Option<ClipCase> {
    use sietch_policy::{Book, Side, CHANI_INSTITUTION, PAUL_INSTITUTION};
    match slug {
        "chani-outbound" => Some(ClipCase {
            slug: "chani-outbound",
            seat: "chani-institution",
            side_label: "outbound",
            input: clip_input(CHANI_INSTITUTION, Side::Outbound, Book::India, false),
        }),
        "paul-inbound-v1" => Some(ClipCase {
            slug: "paul-inbound-v1",
            seat: "paul-institution",
            side_label: "inbound",
            input: clip_input(PAUL_INSTITUTION, Side::Inbound, Book::India, false),
        }),
        "chani-outbound-retry" => Some(ClipCase {
            slug: "chani-outbound-retry",
            seat: "chani-institution",
            side_label: "outbound",
            input: clip_input_id(
                CHANI_INSTITUTION,
                Side::Outbound,
                Book::India,
                false,
                CLIP_TRANSFER_RETRY,
            ),
        }),
        "paul-inbound-v2" => Some(ClipCase {
            slug: "paul-inbound-v2",
            seat: "paul-institution",
            side_label: "inbound",
            input: clip_input_id(
                PAUL_INSTITUTION,
                Side::Inbound,
                Book::India,
                true,
                CLIP_TRANSFER_RETRY,
            ),
        }),
        _ => None,
    }
}

pub async fn execute_one(input: &GuestInput) -> (PublicValues, u64) {
    let client = ProverClient::builder().light().build().await;
    let (public_values, report) = client
        .execute(ELF, stdin_one_institution(input))
        .await
        .expect("execute one institution");
    let cycles = report.total_instruction_count() + report.total_syscall_count();
    let out = read_public(&public_values);
    assert_eq!(
        public_values.as_slice(),
        encode_public(&out),
        "zkVM publics must be Desk abi.encode bytes"
    );
    (out, cycles)
}

#[cfg(test)]
mod tests {
    use super::{clip_input, execute_one, read_public, ELF};
    use pretty_assertions::assert_eq;
    use sietch_policy::{
        policy_hash, Book, Side, CHANI_INSTITUTION, PAUL_INSTITUTION,
    };
    use sietch_policy_guest::STDIN_LEN;
    use rstest::rstest;
    use sp1_sdk::{Prover, ProverClient};

    const MAX_EXECUTE_CYCLES: u64 = 5_000_000;

    #[rstest]
    #[case::chani_outbound_allows(
        clip_input(CHANI_INSTITUTION, Side::Outbound, Book::India, false),
        true
    )]
    #[case::paul_inbound_v1_denies(
        clip_input(PAUL_INSTITUTION, Side::Inbound, Book::India, false),
        false
    )]
    #[case::paul_inbound_v2_allows(
        clip_input(PAUL_INSTITUTION, Side::Inbound, Book::India, true),
        true
    )]
    #[tokio::test]
    async fn zkvm_execute_one_institution(
        #[case] input: sietch_policy_guest::GuestInput,
        #[case] allowed: bool,
    ) {
        let (out, cycles) = execute_one(&input).await;
        assert_eq!(out.allowed, allowed);
        assert_eq!(out.policy_hash, policy_hash(&input.policy));
        assert_eq!(out.org, input.org);
        assert_eq!(out.side, input.side);
        assert!(
            cycles < MAX_EXECUTE_CYCLES,
            "execute should stay tiny, got {cycles} cycles"
        );
    }

    #[test]
    fn clip_cases_pair_by_transfer_id() {
        let send1_out = super::clip_case("chani-outbound").unwrap();
        let send1_in = super::clip_case("paul-inbound-v1").unwrap();
        let send2_out = super::clip_case("chani-outbound-retry").unwrap();
        let send2_in = super::clip_case("paul-inbound-v2").unwrap();
        assert_eq!(send1_out.input.transfer_id, send1_in.input.transfer_id);
        assert_eq!(send2_out.input.transfer_id, send2_in.input.transfer_id);
        assert_ne!(send1_out.input.transfer_id, send2_out.input.transfer_id);
        assert!(!send1_in.input.policy.accepts_cross_border);
        assert!(send2_in.input.policy.accepts_cross_border);
    }

    #[tokio::test]
    async fn zkvm_rejects_concatenated_stdins() {
        let chani = clip_input(CHANI_INSTITUTION, Side::Outbound, Book::India, false);
        let paul = clip_input(PAUL_INSTITUTION, Side::Inbound, Book::India, false);
        let mut both = sietch_policy_guest::encode_stdin(&chani).to_vec();
        both.extend_from_slice(&sietch_policy_guest::encode_stdin(&paul));
        assert_eq!(both.len(), STDIN_LEN * 2);

        let mut stdin = sp1_sdk::SP1Stdin::new();
        stdin.write_vec(both);

        let client = ProverClient::builder().light().build().await;
        let result = client.execute(ELF, stdin).await;
        match result {
            Err(_) => {}
            Ok((public_values, _)) => {
                let decoded = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    read_public(&public_values)
                }));
                assert!(
                    decoded.is_err(),
                    "two policies in one stdin must not produce a receipt"
                );
            }
        }
    }
}
