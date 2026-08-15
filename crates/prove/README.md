# sietch-prove

Host: execute the policy ELF with **one** institution’s stdin.

```bash
source "$HOME/.cargo/env"
export PATH="$HOME/.sp1/bin:/opt/homebrew/bin:$PATH"
cargo test -p sietch-prove -- --test-threads=1
```

Uses the **light** client (run the program, do not load Groth16 keys). Proving comes later.
