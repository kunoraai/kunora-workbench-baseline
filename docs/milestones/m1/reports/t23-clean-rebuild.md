# T23 本地干净重建记录

- 本地口径：已执行 `cargo clean`，随后 `cargo check --workspace --all-targets --locked` 与 `cargo test --workspace --locked`，两者均 exit 0。
- 新 clone CI：`PENDING`（只能在推送后由 CI 产生，本任务禁止推送）。
- Docker build/smoke：`PENDING`（本机无 Docker，由 CI 承担）。
