use dshd_core::state::{Effect, Event, Snapshot, reduce};
use std::sync::{
    Arc, RwLock,
    mpsc::{self, SyncSender},
};
use std::thread;
pub struct Coordinator {
    tx: SyncSender<Event>,
    snapshot: Arc<RwLock<Snapshot>>,
}
impl Coordinator {
    pub fn start(
        initial: Snapshot,
        execute: impl Fn(Effect, SyncSender<Event>) + Send + 'static,
    ) -> Self {
        let (tx, rx) = mpsc::sync_channel(64);
        let snapshot = Arc::new(RwLock::new(initial));
        let shared = Arc::clone(&snapshot);
        let feedback = tx.clone();
        thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                let before = shared.read().expect("snapshot poisoned").clone();
                let reduction = reduce(before, event);
                *shared.write().expect("snapshot poisoned") = reduction.snapshot;
                for effect in reduction.effects {
                    execute(effect, feedback.clone());
                }
            }
        });
        Self { tx, snapshot }
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
}
