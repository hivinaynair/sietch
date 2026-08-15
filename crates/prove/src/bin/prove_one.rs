//! Print one clip receipt. Groth16 via Docker (local) or NETWORK_PRIVATE_KEY.
//!
//!   cargo run --release -p sietch-prove --bin prove-one -- chani-outbound
//!
//! Slugs: chani-outbound | paul-inbound-v1 | chani-outbound-retry | paul-inbound-v2

use serde_json::json;
use sietch_prove::{clip_case, execute_one, stdin_one_institution, ClipCase, ELF};
use sp1_sdk::network::NetworkMode;
use sp1_sdk::{HashableKey, ProveRequest, Prover, ProverClient, ProvingKey};
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let slug = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "chani-outbound".into());
    let case = clip_case(&slug).unwrap_or_else(|| {
        panic!("unknown receipt {slug}; use chani-outbound | paul-inbound-v1 | chani-outbound-retry | paul-inbound-v2")
    });

    let (out, cycles) = execute_one(&case.input).await;
    let publics = sietch_policy_guest::encode_public(&out);

    println!("slug: {}", case.slug);
    println!("allowed: {}", out.allowed);
    println!("cycles: {cycles}");
    println!("public values: 0x{}", hex::encode(publics));

    let client = ProverClient::builder().light().build().await;
    let pk = client.setup(ELF).await.expect("program vkey");
    let vkey = pk.verifying_key().bytes32();
    println!("program vkey: {vkey}");

    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../artifacts/demo");
    std::fs::create_dir_all(&root).expect("artifacts dir");
    let exec_path = root.join(format!("{}.execute.json", case.slug));
    let body = json!({
        "seat": case.seat,
        "side": case.side_label,
        "allowed": out.allowed,
        "cycles": cycles,
        "programVKey": vkey,
        "publicValues": format!("0x{}", hex::encode(publics)),
        "proof": null,
        "note": "Execute only. Groth16 needs Docker or NETWORK_PRIVATE_KEY."
    });
    std::fs::write(&exec_path, serde_json::to_string_pretty(&body).unwrap()).expect("write artifact");
    println!("wrote {}", exec_path.display());

    let docker = std::process::Command::new("docker")
        .arg("info")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    let network = std::env::var("NETWORK_PRIVATE_KEY")
        .ok()
        .filter(|k| !k.is_empty())
        .is_some();
    if !docker && !network {
        println!("skip Groth16: no Docker and no NETWORK_PRIVATE_KEY");
        return;
    }

    let proof_path = root.join(format!("{}.groth16.json", case.slug));
    if network {
        let prover = ProverClient::builder()
            .network_for(NetworkMode::Mainnet)
            .build()
            .await;
        write_groth16(&prover, &case, out.allowed, &proof_path).await;
    } else {
        let prover = ProverClient::from_env().await;
        write_groth16(&prover, &case, out.allowed, &proof_path).await;
    }
}

async fn write_groth16<P: Prover>(
    prover: &P,
    case: &ClipCase,
    allowed: bool,
    proof_path: &PathBuf,
) {
    let pk = prover.setup(ELF).await.expect("setup");
    let proof = prover
        .prove(&pk, stdin_one_institution(&case.input))
        .groth16()
        .await
        .expect("groth16");
    let groth = json!({
        "seat": case.seat,
        "side": case.side_label,
        "allowed": allowed,
        "programVKey": pk.verifying_key().bytes32(),
        "publicValues": format!("0x{}", hex::encode(proof.public_values.as_slice())),
        "proof": format!("0x{}", hex::encode(proof.bytes())),
    });
    std::fs::write(proof_path, serde_json::to_string_pretty(&groth).unwrap()).expect("write proof");
    println!("wrote {}", proof_path.display());
}
