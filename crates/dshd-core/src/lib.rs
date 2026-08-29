//! M1 domain boundaries. Business behavior is intentionally absent.

macro_rules! boundary {
    ($($name:ident),+ $(,)?) => { $(pub mod $name { pub const STATUS: &str = "NOT_IMPLEMENTED"; })+ };
}

boundary!(
    config,
    identity,
    state,
    lifecycle,
    operations,
    observability
);
