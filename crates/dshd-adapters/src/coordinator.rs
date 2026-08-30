use dshd_core::state::{Effect, Event, Snapshot, reduce};
use std::sync::{
    Arc, RwLock,
    mpsc::{self, Receiver, SyncSender},
};
use std::thread;
pub struct Coordinator {
    tx: SyncSender<Event>,
    snapshot: Arc<RwLock<Snapshot>>,
    subscribers: Arc<RwLock<Vec<SyncSender<Snapshot>>>>,
}
impl Coordinator {
    pub fn start(
        initial: Snapshot,
        execute: impl Fn(Effect, SyncSender<Event>) + Send + 'static,
    ) -> Self {
        let (tx, rx) = mpsc::sync_channel(64);
        let snapshot = Arc::new(RwLock::new(initial));
        let shared = Arc::clone(&snapshot);
        let subscribers: Arc<RwLock<Vec<SyncSender<Snapshot>>>> = Arc::new(RwLock::new(Vec::new()));
        let broadcasts = Arc::clone(&subscribers);
        let feedback = tx.clone();
        thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                let before = shared.read().expect("snapshot poisoned").clone();
                let reduction = reduce(before, event);
                *shared.write().expect("snapshot poisoned") = reduction.snapshot.clone();
                broadcasts
                    .write()
                    .expect("subscribers poisoned")
                    .retain(|subscriber| subscriber.try_send(reduction.snapshot.clone()).is_ok());
                for effect in reduction.effects {
                    execute(effect, feedback.clone());
                }
            }
        });
        Self {
            tx,
            snapshot,
            subscribers,
        }
    }
    pub fn send(&self, e: Event) -> Result<(), mpsc::SendError<Event>> {
        self.tx.send(e)
    }
    pub fn snapshot(&self) -> Snapshot {
        self.snapshot.read().expect("snapshot poisoned").clone()
    }
    pub fn sender(&self) -> SyncSender<Event> {
        self.tx.clone()
    }
    /// Subscribes to immutable snapshot values. A slow or closed subscriber is
    /// detached rather than blocking the single reducer/effect loop.
    pub fn subscribe(&self) -> Receiver<Snapshot> {
        let (tx, rx) = mpsc::sync_channel(16);
        let _ = tx.try_send(self.snapshot());
        self.subscribers
            .write()
            .expect("subscribers poisoned")
            .push(tx);
        rx
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dshd_core::state::{DesiredState, ObservedState};
    use std::time::Duration;

    #[test]
    fn snapshot_subscription_is_immutable_and_survives_closed_watchers() {
        let coordinator = Coordinator::start(Snapshot::default(), |_, _| {});
        let closed = coordinator.subscribe();
        drop(closed);
        let watch = coordinator.subscribe();
        let initial = watch.recv_timeout(Duration::from_secs(1)).unwrap();
        coordinator
            .send(Event::DesiredPersisted(DesiredState::Stopped))
            .unwrap();
        let changed = watch.recv_timeout(Duration::from_secs(1)).unwrap();
        assert_eq!(initial.observed, ObservedState::Stopped);
        assert_eq!(changed.desired, DesiredState::Stopped);
        assert_eq!(initial.desired, DesiredState::Running);
    }
}
