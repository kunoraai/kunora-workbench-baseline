FROM rust:1.89.0-bookworm AS dshd-builder
WORKDIR /src
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
COPY tools ./tools
COPY docs/contracts/central-dshd-openapi.yaml ./docs/contracts/central-dshd-openapi.yaml
RUN cargo build --release --locked -p dshd

FROM node:24-bookworm AS harness-builder
WORKDIR /harness
COPY dsh/package.json dsh/pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
COPY dsh ./
RUN pnpm install --frozen-lockfile && pnpm -r build
# Assemble and verify the minimal runtime closure; source and package-manager caches stay behind.
RUN mkdir -p /harness-closure && cp -R package.json node_modules /harness-closure/ && \
    find . -type d -name dist -exec sh -c 'mkdir -p "/harness-closure/$(dirname "$1")"; cp -R "$1" "/harness-closure/$1"' _ {} \; && \
    test -f /harness-closure/package.json && test -d /harness-closure/node_modules

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini util-linux ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=dshd-builder /src/target/release/dshd /usr/local/bin/dshd
COPY --from=harness-builder /harness-closure /opt/dsh
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/bin/flock", "--no-fork", "/tmp/dshd.lock", "/usr/local/bin/dshd"]
