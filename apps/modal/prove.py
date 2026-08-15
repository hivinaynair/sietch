"""One-shot Groth16 (or execute) for Sietch.

Modal user: hi-83670 (existing CLI profile `thumper`). App: sietch-prove.
Do not deploy onto thumper-worker. Do not attach thumper-secrets.
This is a build machine, not a live prover.

Groth16 path: Succinct prover network (`NETWORK_PRIVATE_KEY` / `SP1_PROVER=network`).
Modal functions have no Docker daemon; SP1's local Groth16 wrap shells out to Docker.

  NETWORK_PRIVATE_KEY=0x... modal run apps/modal/prove.py
  # or: modal secret create sietch-prove NETWORK_PRIVATE_KEY=0x...
  #     then modal run apps/modal/prove.py

Copy printed JSON into artifacts/demo/. Then the public site only verifies.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import modal

APP_NAME = "sietch-prove"
SECRET_NAME = "sietch-prove"

_here = Path(__file__).resolve()
try:
    _candidate = _here.parents[2]
    REPO_ROOT = _candidate if (_candidate / "Cargo.toml").exists() else Path("/sietch")
except IndexError:
    REPO_ROOT = Path("/sietch")


def _named_secret_listed(name: str) -> bool:
    listed = subprocess.run(
        ["modal", "secret", "list"],
        capture_output=True,
        text=True,
        check=False,
    ).stdout
    return bool(listed) and name in listed


def _prove_secrets() -> list[modal.Secret]:
    """Pass a Succinct network key. Never attach thumper-secrets."""
    if not modal.is_local():
        return []
    local_key = os.environ.get("NETWORK_PRIVATE_KEY", "").strip()
    if local_key:
        return [
            modal.Secret.from_dict(
                {
                    "NETWORK_PRIVATE_KEY": local_key,
                    "SP1_PROVER": "network",
                }
            )
        ]
    if _named_secret_listed(SECRET_NAME):
        return [modal.Secret.from_name(SECRET_NAME)]
    return []


prove_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install(
        "build-essential",
        "ca-certificates",
        "clang",
        "cmake",
        "curl",
        "git",
        "pkg-config",
        "protobuf-compiler",
    )
    .run_commands(
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
        "curl -L https://sp1up.succinct.xyz | bash",
        "export PATH=/root/.cargo/bin:/root/.sp1/bin:$PATH && sp1up",
    )
    .env(
        {
            "PATH": "/root/.cargo/bin:/root/.sp1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "CARGO_HOME": "/root/.cargo",
            "RUSTUP_HOME": "/root/.rustup",
        }
    )
    .add_local_dir(
        str(REPO_ROOT),
        remote_path="/sietch",
        copy=True,
        ignore=[
            "**/node_modules/**",
            "**/.next/**",
            "**/.git/**",
            "**/dist/**",
            "**/.turbo/**",
            "**/target/**",
            "**/contracts/lib/**",
            "**/contracts/out/**",
            "**/contracts/cache/**",
            "**/.env",
            "**/.env.*",
            "**/.modal.toml",
        ],
    )
)

app = modal.App(APP_NAME)


@app.function(
    image=prove_image,
    timeout=60 * 90,
    cpu=8.0,
    memory=32768,
    secrets=_prove_secrets(),
)
def prove_chani_outbound() -> str:
    env = os.environ.copy()
    if env.get("NETWORK_PRIVATE_KEY", "").strip():
        env.setdefault("SP1_PROVER", "network")

    result = subprocess.run(
        [
            "cargo",
            "run",
            "-p",
            "sietch-prove",
            "--bin",
            "prove-one",
            "--release",
            "--quiet",
        ],
        cwd="/sietch",
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout)[-8000:]
        raise RuntimeError(f"prove-one failed ({result.returncode})\n{err}")
    proof_path = Path("/sietch/artifacts/demo/chani-outbound.groth16.json")
    if proof_path.is_file():
        return proof_path.read_text()
    # Cargo compile noise is on stderr. The receipt lines are stdout.
    return result.stdout or result.stderr[-8000:]


def _persist_groth16(text: str) -> None:
    blob = text.strip()
    if not blob.startswith("{"):
        return
    try:
        data = json.loads(blob)
    except json.JSONDecodeError:
        return
    proof = data.get("proof")
    if not isinstance(proof, str) or not proof.startswith("0x") or len(proof) < 80:
        return
    dest = REPO_ROOT / "artifacts" / "demo" / "chani-outbound.groth16.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(data, indent=2) + "\n")
    print(f"wrote {dest}")


@app.local_entrypoint()
def main():
    out = prove_chani_outbound.remote()
    print(out)
    _persist_groth16(out)
