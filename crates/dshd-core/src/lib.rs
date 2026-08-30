//! Pure M2 domain model. OS, filesystem, process and network effects are ports.
pub mod config;
pub mod identity;
pub mod state;

pub mod lifecycle {
    use crate::state::DesiredState;
    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum LifecycleCommand {
        SetDesired(DesiredState),
        Shutdown,
        Fence,
    }
}
pub mod operations {
    pub const STATUS: &str = "NOT_IMPLEMENTED_M3";
}
pub mod observability {
    use crate::state::{ObservedState, RegistrationState, Snapshot};
    pub fn local(s: &Snapshot) -> bool {
        s.observed == ObservedState::Ready && s.context.is_some()
    }
    pub fn ready(s: &Snapshot) -> bool {
        local(s) && s.registration == RegistrationState::Leased
    }
}
