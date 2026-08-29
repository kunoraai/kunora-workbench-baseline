$ErrorActionPreference = 'Stop'
$cargoLock = (Get-FileHash -Algorithm SHA256 -LiteralPath 'Cargo.lock').Hash.ToLowerInvariant()
$toolchain = (Get-FileHash -Algorithm SHA256 -LiteralPath 'rust-toolchain.toml').Hash.ToLowerInvariant()
$harnessLock = (Get-FileHash -Algorithm SHA256 -LiteralPath 'dsh/pnpm-lock.yaml').Hash.ToLowerInvariant()
[ordered]@{ rustc = (& rustc -Vv | Out-String).Trim(); cargo = (& cargo -V); cargo_lock_sha256 = $cargoLock; rust_toolchain_sha256 = $toolchain; harness_lock_sha256 = $harnessLock } | ConvertTo-Json

