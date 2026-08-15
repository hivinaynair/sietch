"""One-shot Groth16 (or execute) for Sietch. Same Modal account as Thumper, different app.

Do not reuse thumper-secrets. This is a build machine, not a live prover.

  modal run apps/modal/prove.py

Copy printed JSON into artifacts/demo/. Then the public site only verifies.
"""

from __future__ import annotations

from pathlib import Path

import modal

APP_NAME = "sietch-prove"

_here = Path(__file__).resolve()
try:
    _candidate = _here.parents[2]
    REPO_ROOT = _candidate if (_candidate / "Cargo.toml").exists() else Path("/sietch")
except IndexError:
    REPO_ROOT = Path("/sietch")

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
)
def prove_chani_outbound() -> str:
    import subprocess

    result = subprocess.run(
        ["cargo", "run", "-p", "sietch-prove", "--bin", "prove-one", "--release"],
        cwd="/sietch",
        check=False,
        capture_output=True,
        text=True,
    )
    out = f"{result.stdout}\n{result.stderr}"
    if result.returncode != 0:
        raise RuntimeError(f"prove-one failed ({result.returncode})\n{out[-8000:]}")
    return out[-8000:]


@app.local_entrypoint()
def main():
    print(prove_chani_outbound.remote())
