//! Execute one institution (Chani outbound). Groth16 only if Docker or a network key exists.

use sietch_policy::{Book, Side, CHANI_INSTITUTION};
use sietch_prove::{clip_input, execute_one, stdin_one_institution, ELF};
use serde_json::json;
use sp1_sdk::{HashableKey, ProveRequest, Prover, ProverClient, ProvingKey};
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let input = clip_input(CHANI_INSTITUTION, Side::Outbound, Book::India, false);
    let (out, cycles) = execute_one(&input).await;
    let publics = sietch_policy_guest::encode_public(&out);

    println!("allowed: {}", out.allowed);
    println!("cycles: {cycles}");
    println!("public values: 0x{}", hex::encode(publics));

    let client = ProverClient::builder().light().build().await;
    let pk = client.setup(ELF).await.expect("program vkey");
    let vkey = pk.verifying_key().bytes32();
    println!("program vkey: {vkey}");

    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../artifacts/demo");
    std::fs::create_dir_all(&root).expect("artifacts dir");
    let path = root.join("chani-outbound.execute.json");
    let body = json!({
        "seat": "chani-institution",
        "side": "outbound",
        "allowed": out.allowed,
        "cycles": cycles,
        "programVKey": vkey,
        "publicValues": format!("0x{}", hex::encode(publics)),
        "proof": null,
        "note": "Execute only. Groth16 needs Docker (≥16GB) or NETWORK_PRIVATE_KEY."
    });
    std::fs::write(&path, serde_json::to_string_pretty(&body).unwrap()).expect("write artifact");
    println!("wrote {}", path.display());

    let docker = std::process::Command::new("docker")
        .arg("info")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    let network = std::env::var("NETWORK_PRIVATE_KEY").is_ok();
    if !docker && !network {
        println!("skip Groth16: no Docker and no NETWORK_PRIVATE_KEY");
        return;
    }

    let prover = ProverClient::from_env().await;
    let pk = prover.setup(ELF).await.expect("setup");
    let proof = prover
        .prove(&pk, stdin_one_institution(&input))
        .groth16()
        .await
        .expect("groth16");
    let proof_path = root.join("chani-outbound.groth16.json");
    let groth = json!({
        "seat": "chani-institution",
        "side": "outbound",
        "allowed": out.allowed,
        "programVKey": pk.verifying_key().bytes32(),
        "publicValues": format!("0x{}", hex::encode(proof.public_values.as_slice())),
        "proof": format!("0x{}", hex::encode(proof.bytes())),
    });
    std::fs::write(&proof_path, serde_json::to_string_pretty(&groth).unwrap()).expect("write proof");
    println!("wrote {}", proof_path.display());
}
