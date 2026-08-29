//! M1 adapter boundaries. Network and process behavior belongs to later milestones.

macro_rules! boundary {
    ($($name:ident),+ $(,)?) => { $(pub mod $name { pub const STATUS: &str = "NOT_IMPLEMENTED"; })+ };
}

boundary!(
    supervisor,
    harness,
    transport,
    proxy,
    central,
    files,
    observability
);
