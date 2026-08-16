//! Private T-bill policy for **one** institution.
//!
//! **Book** (India / US) is not a field the institution writes. It comes from a
//! **directory** — in production a charter / license record; in this demo two
//! rows we deploy. Institutions publish corridor rules. They do not self-KYC.
//! Customers still do not prove identity. That is v2.

use tiny_keccak::{Hasher, Keccak};

/// Jurisdiction **label** on an institution's book. Not a passport, not FEMA.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Book {
    India,
    Us,
}

/// Which receipt this run is: sending institution or beneficiary institution.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Side {
    Outbound,
    Inbound,
}

/// On-chain-shaped institution id. Twenty bytes, like an address.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct OrgId(pub [u8; 20]);

/// Demo orgs. Later these are the two institution addresses on the desk.
pub const CHANI_INSTITUTION: OrgId = OrgId([0x11; 20]);
pub const PAUL_INSTITUTION: OrgId = OrgId([0x22; 20]);

/// Assigned books. An institution cannot insert or overwrite a row.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Directory {
    rows: [(OrgId, Book); 2],
}

impl Directory {
    pub fn demo() -> Self {
        Self {
            rows: [
                (CHANI_INSTITUTION, Book::India),
                (PAUL_INSTITUTION, Book::Us),
            ],
        }
    }

    pub fn home_of(&self, org: OrgId) -> Option<Book> {
        self.rows
            .iter()
            .find(|(id, _)| *id == org)
            .map(|(_, book)| *book)
    }
}

/// Corridor rules this institution publishes. No `home` — that is the directory.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Policy {
    pub max_amount: u64,
    /// Inbound only: accept a delivery whose origin label is not this org's book.
    pub accepts_cross_border: bool,
}

/// Facts this institution is willing to bind into its receipt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Delivery {
    pub amount: u64,
    pub origin: Book,
}

pub fn policy_bytes(policy: &Policy) -> [u8; 64] {
    let mut out = [0u8; 64];
    out[24..32].copy_from_slice(&policy.max_amount.to_be_bytes());
    if policy.accepts_cross_border {
        out[63] = 1;
    }
    out
}

pub fn policy_hash(policy: &Policy) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    hasher.update(&policy_bytes(policy));
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}

/// Hiding commitment to one institution's clauses: `keccak(blinding ‖ policy_bytes)`.
///
/// [`policy_hash`] — what the recorded clip actually publishes — is unsalted keccak over 64
/// bytes holding a `u64` and a bool. That domain enumerates in well under 200 guesses, so the
/// v1 seal reveals the clauses it was meant to hide (`v1_hash_falls_to_enumeration`).
///
/// `blinding` is a per-institution, per-version secret carried in stdin beside the policy. It
/// never reaches the chain, so the commitment stays opaque even though the clause space is
/// tiny — and two institutions holding byte-identical clauses no longer publish the same seal.
///
/// **Deliberately not wired into the guest.** Switching `policy_hash` for this changes the
/// guest ELF and therefore the verification key, which would invalidate the four committed
/// Groth16 receipts. README "Known limits" records that as the one-reprove fix.
pub fn policy_commitment(policy: &Policy, blinding: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    hasher.update(blinding);
    hasher.update(&policy_bytes(policy));
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}

/// `org` must already be in `directory`. Home is looked up, never taken from `policy`.
pub fn evaluate(
    policy: &Policy,
    delivery: &Delivery,
    side: Side,
    directory: &Directory,
    org: OrgId,
) -> bool {
    let Some(home) = directory.home_of(org) else {
        return false;
    };
    if delivery.amount > policy.max_amount {
        return false;
    }
    match side {
        Side::Outbound => delivery.origin == home,
        Side::Inbound => delivery.origin == home || policy.accepts_cross_border,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        evaluate, policy_commitment, policy_hash, Book, Delivery, Directory, OrgId, Policy, Side,
        CHANI_INSTITUTION, PAUL_INSTITUTION,
    };
    use pretty_assertions::{assert_eq, assert_ne};
    use rstest::rstest;

    fn demo() -> Directory {
        Directory::demo()
    }

    #[rstest]
    #[case::chani_sends_from_her_book(Side::Outbound, CHANI_INSTITUTION, Book::India, false, true)]
    #[case::chani_cannot_attest_us(Side::Outbound, CHANI_INSTITUTION, Book::Us, false, false)]
    #[case::paul_v1_blocks_cross_border(Side::Inbound, PAUL_INSTITUTION, Book::India, false, false)]
    #[case::paul_v2_opens_cross_border(Side::Inbound, PAUL_INSTITUTION, Book::India, true, true)]
    #[case::paul_v1_still_takes_domestic(Side::Inbound, PAUL_INSTITUTION, Book::Us, false, true)]
    fn evaluate_one_institution(
        #[case] side: Side,
        #[case] org: OrgId,
        #[case] origin: Book,
        #[case] accepts_cross_border: bool,
        #[case] allowed: bool,
    ) {
        let policy = Policy {
            max_amount: 10,
            accepts_cross_border,
        };
        let delivery = Delivery { amount: 1, origin };
        assert_eq!(evaluate(&policy, &delivery, side, &demo(), org), allowed);
    }

    #[test]
    fn unknown_institution_is_denied() {
        let stranger = OrgId([0x99; 20]);
        let policy = Policy {
            max_amount: 10,
            accepts_cross_border: true,
        };
        let delivery = Delivery {
            amount: 1,
            origin: Book::India,
        };
        assert!(!evaluate(
            &policy,
            &delivery,
            Side::Outbound,
            &demo(),
            stranger
        ));
    }

    #[test]
    fn paul_cannot_rebind_as_india() {
        // Same corridor flag as a passing India outbound — still Paul's US book.
        let policy = Policy {
            max_amount: 10,
            accepts_cross_border: false,
        };
        let delivery = Delivery {
            amount: 1,
            origin: Book::India,
        };
        assert!(!evaluate(
            &policy,
            &delivery,
            Side::Outbound,
            &demo(),
            PAUL_INSTITUTION
        ));
    }

    /// The v1 seal is not a commitment. `max_amount` is a `u64` and `accepts_cross_border`
    /// is one bool, so an observer who reads a policy hash off the chain recovers the
    /// clauses by enumeration. This test **is** the attack, and it passing is the finding:
    /// nothing in v1 hides what the seal was supposed to hide.
    ///
    /// [`policy_commitment`] is the fix — see `blinding_defeats_enumeration`. Wiring it into
    /// the guest changes the ELF and therefore the vkey, which is why the recorded clip
    /// still publishes the v1 seal and the README says so out loud.
    #[test]
    fn v1_hash_falls_to_enumeration() {
        let secret = Policy {
            max_amount: 10,
            accepts_cross_border: false,
        };
        let seal = policy_hash(&secret);

        let mut recovered = None;
        let mut guesses = 0;
        for max_amount in 0..=64u64 {
            for accepts_cross_border in [false, true] {
                guesses += 1;
                let guess = Policy {
                    max_amount,
                    accepts_cross_border,
                };
                if policy_hash(&guess) == seal {
                    recovered = Some(guess);
                }
            }
        }

        assert_eq!(recovered, Some(secret), "the v1 seal leaks its clauses");
        assert!(guesses < 200, "and it takes {guesses} guesses to do it");
    }

    /// The same sweep that breaks v1, run against the blinded commitment. No guess lands,
    /// because the guess does not hold the blinding factor.
    #[test]
    fn blinding_defeats_enumeration() {
        let secret = Policy {
            max_amount: 10,
            accepts_cross_border: false,
        };
        let sealed = policy_commitment(&secret, &[7u8; 32]);

        for max_amount in 0..=64u64 {
            for accepts_cross_border in [false, true] {
                let guess = Policy {
                    max_amount,
                    accepts_cross_border,
                };
                assert_ne!(policy_commitment(&guess, &[0u8; 32]), sealed);
            }
        }
    }

    /// Republishing has to move the seal even when the clauses are unchanged, or the version
    /// history tells an observer which publishes were substantive.
    #[test]
    fn same_policy_two_versions_two_commitments() {
        let policy = Policy {
            max_amount: 10,
            accepts_cross_border: false,
        };
        assert_ne!(
            policy_commitment(&policy, &[1u8; 32]),
            policy_commitment(&policy, &[2u8; 32])
        );
    }

    /// The clip shows one seal under both institutions because both v1 policies are
    /// byte-identical and v1 is unsalted. Per-institution blinding is what stops that,
    /// and stops the chain learning that two institutions agree.
    #[test]
    fn two_institutions_never_share_a_commitment() {
        let identical = Policy {
            max_amount: 10,
            accepts_cross_border: false,
        };
        assert_eq!(policy_hash(&identical), policy_hash(&identical));
        assert_ne!(
            policy_commitment(&identical, &[0xAA; 32]),
            policy_commitment(&identical, &[0xBB; 32])
        );
    }

    #[test]
    fn publishing_inbound_v2_changes_the_hash() {
        let v1 = policy_hash(&Policy {
            max_amount: 10,
            accepts_cross_border: false,
        });
        let v2 = policy_hash(&Policy {
            max_amount: 10,
            accepts_cross_border: true,
        });
        assert_ne!(v1, v2);
    }
}
