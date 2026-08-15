# sietch-policy-guest

One institution per stdin. Calls `sietch-policy::evaluate`. Directory is inside the guest.

```bash
source "$HOME/.cargo/env"
cargo test -p sietch-policy-guest
```

This is ordinary Rust so we can test isolation before installing the SP1 toolchain. Later a thin `sp1_zkvm` `main` will `read` / `commit` around `execute`.
