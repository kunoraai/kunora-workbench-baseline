use crate::config::Secret;
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DesiredState {
    Running,
    Stopped,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ObservedState {
    Starting,
    Authenticating,
    Ready,
    Unhealthy,
    Stopping,
    Stopped,
    Fenced,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RegistrationState {
    Unregistered,
    Registering,
    Leased,
    Degraded,
    Fenced,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct AttemptId(pub u64);
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct Generation(pub u64);
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConnectionContext {
    pub authority: String,
    pub origin: String,
    pub cookie: Secret,
    pub generation: Generation,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Snapshot {
    pub sequence: u64,
    pub desired: DesiredState,
    pub observed: ObservedState,
    pub registration: RegistrationState,
    pub attempt: Option<AttemptId>,
    pub generation: Generation,
    pub context: Option<ConnectionContext>,
    pub shutdown: bool,
    pub last_error: Option<String>,
}
impl Default for Snapshot {
    fn default() -> Self {
        Self {
            sequence: 0,
            desired: DesiredState::Running,
            observed: ObservedState::Stopped,
            registration: RegistrationState::Unregistered,
            attempt: None,
            generation: Generation(0),
            context: None,
            shutdown: false,
            last_error: None,
        }
    }
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Event {
    Reconcile,
    DesiredPersisted(DesiredState),
    Spawned(AttemptId),
    ReadyUrl(AttemptId),
    BootstrapSucceeded(AttemptId, String, Secret),
    Failed(AttemptId, String),
    ChildExited(AttemptId),
    BackoffElapsed(AttemptId),
    Fence,
    Shutdown,
    Stopped(AttemptId),
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Effect {
    PersistDesired(DesiredState),
    Spawn(AttemptId),
    Bootstrap(AttemptId),
    Stop(AttemptId),
    ScheduleBackoff(AttemptId),
    PublishContext(Generation),
    DropContext,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reduction {
    pub snapshot: Snapshot,
    pub effects: Vec<Effect>,
}
fn next(s: &Snapshot) -> AttemptId {
    AttemptId(s.attempt.map_or(1, |a| a.0 + 1))
}
fn current(s: &Snapshot, a: AttemptId) -> bool {
    s.attempt == Some(a)
}
pub fn reduce(mut s: Snapshot, e: Event) -> Reduction {
    let mut effects = Vec::new();
    s.sequence += 1;
    match e {
        Event::Shutdown => {
            s.shutdown = true;
            s.context = None;
            s.observed = ObservedState::Stopping;
            if let Some(a) = s.attempt {
                effects.extend([Effect::DropContext, Effect::Stop(a)])
            } else {
                s.observed = ObservedState::Stopped
            }
        }
        Event::Fence => {
            s.registration = RegistrationState::Fenced;
            s.context = None;
            s.observed = ObservedState::Fenced;
            if let Some(a) = s.attempt {
                effects.extend([Effect::DropContext, Effect::Stop(a)])
            }
        }
        Event::DesiredPersisted(DesiredState::Stopped) => {
            s.desired = DesiredState::Stopped;
            s.context = None;
            s.observed = ObservedState::Stopping;
            if let Some(a) = s.attempt {
                effects.extend([Effect::DropContext, Effect::Stop(a)])
            } else {
                s.observed = ObservedState::Stopped
            }
        }
        Event::DesiredPersisted(DesiredState::Running) => {
            s.desired = DesiredState::Running;
            effects.push(Effect::Spawn(next(&s)))
        }
        Event::Reconcile
            if s.desired == DesiredState::Running
                && !s.shutdown
                && s.registration != RegistrationState::Fenced =>
        {
            effects.push(Effect::Spawn(next(&s)))
        }
        Event::Spawned(a) => {
            s.attempt = Some(a);
            s.observed = ObservedState::Starting
        }
        Event::ReadyUrl(a) if current(&s, a) => {
            s.observed = ObservedState::Authenticating;
            effects.push(Effect::Bootstrap(a))
        }
        Event::BootstrapSucceeded(a, authority, cookie)
            if current(&s, a)
                && s.desired == DesiredState::Running
                && !s.shutdown
                && s.registration != RegistrationState::Fenced =>
        {
            let g = Generation(s.generation.0 + 1);
            s.generation = g;
            s.observed = ObservedState::Ready;
            s.context = Some(ConnectionContext {
                origin: format!("http://{authority}"),
                authority,
                cookie,
                generation: g,
            });
            effects.push(Effect::PublishContext(g))
        }
        Event::Failed(a, error) if current(&s, a) => {
            s.context = None;
            s.last_error = Some(error);
            s.observed = ObservedState::Unhealthy;
            effects.extend([Effect::DropContext, Effect::ScheduleBackoff(a)])
        }
        Event::ChildExited(a) if current(&s, a) => {
            s.context = None;
            s.last_error = Some("child exited".into());
            s.observed = ObservedState::Unhealthy;
            effects.extend([Effect::DropContext, Effect::ScheduleBackoff(a)])
        }
        Event::BackoffElapsed(a)
            if current(&s, a)
                && s.desired == DesiredState::Running
                && !s.shutdown
                && s.registration != RegistrationState::Fenced =>
        {
            effects.push(Effect::Spawn(next(&s)))
        }
        Event::Stopped(a) if current(&s, a) => {
            s.context = None;
            s.attempt = None;
            s.observed = ObservedState::Stopped
        }
        _ => {}
    }
    Reduction {
        snapshot: s,
        effects,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn generation_after_probe() {
        let s = reduce(Snapshot::default(), Event::Spawned(AttemptId(1))).snapshot;
        let r = reduce(
            s,
            Event::BootstrapSucceeded(
                AttemptId(1),
                "127.0.0.1:1".into(),
                Secret::new("c".into()).unwrap(),
            ),
        );
        assert_eq!(r.snapshot.generation, Generation(1));
    }
    #[test]
    fn late_is_dropped() {
        let s = Snapshot { attempt: Some(AttemptId(2)), ..Snapshot::default() };
        assert!(
            reduce(
                s,
                Event::BootstrapSucceeded(
                    AttemptId(1),
                    "127.0.0.1:1".into(),
                    Secret::new("c".into()).unwrap()
                )
            )
            .snapshot
            .context
            .is_none()
        );
    }
    #[test]
    fn shutdown_wins() {
        let s = Snapshot { attempt: Some(AttemptId(1)), ..Snapshot::default() };
        let s = reduce(s, Event::Shutdown).snapshot;
        assert!(
            reduce(
                s,
                Event::BootstrapSucceeded(
                    AttemptId(1),
                    "127.0.0.1:1".into(),
                    Secret::new("c".into()).unwrap()
                )
            )
            .snapshot
            .context
            .is_none()
        );
    }
}
