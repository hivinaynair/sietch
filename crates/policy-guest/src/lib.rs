//! Guest I/O for **one** institution.
//!
//! This is the program the proving machine will run. Today it is ordinary Rust
//! so we can test it. Later `sp1_zkvm::io::read` / `commit` wrap this file.
//! Stdin is one policy. Two policies in one buffer is a decode error.

use sietch_policy::{
    evaluate, policy_bytes, policy_hash, Book, Delivery, Directory, OrgId, Policy, Side,
};

/// Demo T-bill token address. Later this is the ERC-20 on the desk.
pub const DEMO_TBILL: [u8; 20] = [0x33; 20];

/// Clip transfer id for the first instruct (Chani allow, Paul deny).
pub const CLIP_TRANSFER: [u8; 32] = [0x44; 32];

/// Second instruct after inbound v2. New id so the Desk cannot replay send 1.
pub const CLIP_TRANSFER_RETRY: [u8; 32] = [0x45; 32];

/// Fixed stdin size. Concatenating two guests is `2 * STDIN_LEN` and must fail.
pub const STDIN_LEN: usize = 146;

/// `abi.encode(bytes32, address, address, uint256, bytes32, uint8, bool)` — 7 words.
pub const PUBLIC_LEN: usize = 224;

/// Private input for **one** receipt. No second policy field exists.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GuestInput {
    pub policy: Policy,
    pub delivery: Delivery,
    pub side: Side,
    pub org: OrgId,
    pub token: [u8; 20],
    pub transfer_id: [u8; 32],
}

/// Public values the chain is allowed to see. Not the corridor clauses.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicValues {
    pub policy_hash: [u8; 32],
    pub org: OrgId,
    pub token: [u8; 20],
    pub amount: u64,
    pub transfer_id: [u8; 32],
    pub side: Side,
    pub allowed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GuestError {
    WrongLength { expected: usize, got: usize },
    BadTag,
}

pub fn book_tag(book: Book) -> u8 {
    match book {
        Book::India => 0,
        Book::Us => 1,
    }
}

pub fn side_tag(side: Side) -> u8 {
    match side {
        Side::Outbound => 0,
        Side::Inbound => 1,
    }
}

pub fn book_from_tag(tag: u8) -> Result<Book, GuestError> {
    match tag {
        0 => Ok(Book::India),
        1 => Ok(Book::Us),
        _ => Err(GuestError::BadTag),
    }
}

pub fn side_from_tag(tag: u8) -> Result<Side, GuestError> {
    match tag {
        0 => Ok(Side::Outbound),
        1 => Ok(Side::Inbound),
        _ => Err(GuestError::BadTag),
    }
}

fn policy_from_bytes(bytes: &[u8; 64]) -> Policy {
    let mut amount = [0u8; 8];
    amount.copy_from_slice(&bytes[24..32]);
    Policy {
        max_amount: u64::from_be_bytes(amount),
        accepts_cross_border: bytes[63] == 1,
    }
}

pub fn encode_stdin(input: &GuestInput) -> [u8; STDIN_LEN] {
    let mut out = [0u8; STDIN_LEN];
    out[0..64].copy_from_slice(&policy_bytes(&input.policy));
    out[64] = book_tag(input.delivery.origin);
    out[65..73].copy_from_slice(&input.delivery.amount.to_be_bytes());
    out[73] = side_tag(input.side);
    out[74..94].copy_from_slice(&input.org.0);
    out[94..114].copy_from_slice(&input.token);
    out[114..146].copy_from_slice(&input.transfer_id);
    out
}

pub fn decode_stdin(bytes: &[u8]) -> Result<GuestInput, GuestError> {
    if bytes.len() != STDIN_LEN {
        return Err(GuestError::WrongLength {
            expected: STDIN_LEN,
            got: bytes.len(),
        });
    }
    let policy_raw: [u8; 64] = bytes[0..64].try_into().expect("length checked");
    let mut amount = [0u8; 8];
    amount.copy_from_slice(&bytes[65..73]);
    let mut org = [0u8; 20];
    org.copy_from_slice(&bytes[74..94]);
    let mut token = [0u8; 20];
    token.copy_from_slice(&bytes[94..114]);
    let mut transfer_id = [0u8; 32];
    transfer_id.copy_from_slice(&bytes[114..146]);
    Ok(GuestInput {
        policy: policy_from_bytes(&policy_raw),
        delivery: Delivery {
            amount: u64::from_be_bytes(amount),
            origin: book_from_tag(bytes[64])?,
        },
        side: side_from_tag(bytes[73])?,
        org: OrgId(org),
        token,
        transfer_id,
    })
}

/// Directory is inside the guest. The host cannot pass a home.
pub fn execute(input: &GuestInput) -> PublicValues {
    let allowed = evaluate(
        &input.policy,
        &input.delivery,
        input.side,
        &Directory::demo(),
        input.org,
    );
    PublicValues {
        policy_hash: policy_hash(&input.policy),
        org: input.org,
        token: input.token,
        amount: input.delivery.amount,
        transfer_id: input.transfer_id,
        side: input.side,
        allowed,
    }
}

pub fn execute_stdin(bytes: &[u8]) -> Result<PublicValues, GuestError> {
    Ok(execute(&decode_stdin(bytes)?))
}

/// Same bytes Solidity `abi.decode`s in `Desk._decode`.
pub fn encode_public(out: &PublicValues) -> [u8; PUBLIC_LEN] {
    let mut buf = [0u8; PUBLIC_LEN];
    buf[0..32].copy_from_slice(&out.policy_hash);
    buf[44..64].copy_from_slice(&out.org.0);
    buf[76..96].copy_from_slice(&out.token);
    buf[120..128].copy_from_slice(&out.amount.to_be_bytes());
    buf[128..160].copy_from_slice(&out.transfer_id);
    buf[191] = side_tag(out.side);
    if out.allowed {
        buf[223] = 1;
    }
    buf
}

pub fn decode_public(bytes: &[u8]) -> Result<PublicValues, GuestError> {
    if bytes.len() != PUBLIC_LEN {
        return Err(GuestError::WrongLength {
            expected: PUBLIC_LEN,
            got: bytes.len(),
        });
    }
    let mut policy_hash = [0u8; 32];
    policy_hash.copy_from_slice(&bytes[0..32]);
    let mut org = [0u8; 20];
    org.copy_from_slice(&bytes[44..64]);
    let mut token = [0u8; 20];
    token.copy_from_slice(&bytes[76..96]);
    let mut amount = [0u8; 8];
    amount.copy_from_slice(&bytes[120..128]);
    let mut transfer_id = [0u8; 32];
    transfer_id.copy_from_slice(&bytes[128..160]);
    Ok(PublicValues {
        policy_hash,
        org: OrgId(org),
        token,
        amount: u64::from_be_bytes(amount),
        transfer_id,
        side: side_from_tag(bytes[191])?,
        allowed: bytes[223] == 1,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        decode_public, decode_stdin, encode_public, encode_stdin, execute, execute_stdin,
        GuestError, GuestInput, PublicValues, CLIP_TRANSFER, DEMO_TBILL, PUBLIC_LEN, STDIN_LEN,
    };
    use pretty_assertions::assert_eq;
    use sietch_policy::{
        policy_hash, Book, Delivery, Policy, Side, CHANI_INSTITUTION, PAUL_INSTITUTION,
    };
    use rstest::rstest;

    fn clip(org: sietch_policy::OrgId, side: Side, origin: Book, open: bool) -> GuestInput {
        GuestInput {
            policy: Policy {
                max_amount: 10,
                accepts_cross_border: open,
            },
            delivery: Delivery { amount: 1, origin },
            side,
            org,
            token: DEMO_TBILL,
            transfer_id: CLIP_TRANSFER,
        }
    }

    #[rstest]
    #[case::chani_outbound_allows(
        clip(CHANI_INSTITUTION, Side::Outbound, Book::India, false),
        true
    )]
    #[case::paul_inbound_v1_denies(
        clip(PAUL_INSTITUTION, Side::Inbound, Book::India, false),
        false
    )]
    #[case::paul_inbound_v2_allows(
        clip(PAUL_INSTITUTION, Side::Inbound, Book::India, true),
        true
    )]
    fn execute_one_institution(#[case] input: GuestInput, #[case] allowed: bool) {
        let out = execute(&input);
        assert_eq!(out.allowed, allowed);
        assert_eq!(out.policy_hash, policy_hash(&input.policy));
        assert_eq!(out.org, input.org);
        assert_eq!(out.token, DEMO_TBILL);
        assert_eq!(out.amount, 1);
        assert_eq!(out.transfer_id, CLIP_TRANSFER);
        assert_eq!(out.side, input.side);
    }

    #[test]
    fn encode_round_trips_one_policy() {
        let input = clip(CHANI_INSTITUTION, Side::Outbound, Book::India, false);
        let bytes = encode_stdin(&input);
        assert_eq!(bytes.len(), STDIN_LEN);
        assert_eq!(decode_stdin(&bytes).unwrap(), input);
    }

    #[test]
    fn concatenated_stdins_are_rejected() {
        let chani = encode_stdin(&clip(
            CHANI_INSTITUTION,
            Side::Outbound,
            Book::India,
            false,
        ));
        let paul = encode_stdin(&clip(
            PAUL_INSTITUTION,
            Side::Inbound,
            Book::India,
            false,
        ));
        let mut both = Vec::from(chani);
        both.extend_from_slice(&paul);
        assert_eq!(both.len(), STDIN_LEN * 2);
        assert_eq!(
            decode_stdin(&both),
            Err(GuestError::WrongLength {
                expected: STDIN_LEN,
                got: STDIN_LEN * 2,
            })
        );
        assert!(execute_stdin(&both).is_err());
    }

    #[test]
    fn public_values_match_solidity_abi_encode() {
        // `cast abi-encode "f(bytes32,address,address,uint256,bytes32,uint8,bool)"` …
        let expected = hex::decode(
            "00000000000000000000000000000000000000000000000000000000000000aa\
             0000000000000000000000001111111111111111111111111111111111111111\
             0000000000000000000000003333333333333333333333333333333333333333\
             0000000000000000000000000000000000000000000000000000000000000001\
             4444444444444444444444444444444444444444444444444444444444444444\
             0000000000000000000000000000000000000000000000000000000000000000\
             0000000000000000000000000000000000000000000000000000000000000001",
        )
        .unwrap();
        let mut hash = [0u8; 32];
        hash[31] = 0xaa;
        let out = PublicValues {
            policy_hash: hash,
            org: CHANI_INSTITUTION,
            token: DEMO_TBILL,
            amount: 1,
            transfer_id: CLIP_TRANSFER,
            side: Side::Outbound,
            allowed: true,
        };
        let bytes = encode_public(&out);
        assert_eq!(bytes.len(), PUBLIC_LEN);
        assert_eq!(bytes.as_slice(), expected.as_slice());
        assert_eq!(decode_public(&bytes).unwrap(), out);
    }
}
