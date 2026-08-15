# sietch-policy-program

Thin SP1 zkVM `main`. Reads one stdin, calls `sietch-policy-guest::execute`, commits public values.

Not a workspace member of the repo root — built only by `cargo prove` / `crates/prove` `build.rs`.
