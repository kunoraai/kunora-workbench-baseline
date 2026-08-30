use atomicwrites::{AllowOverwrite, AtomicFile, DisallowOverwrite, OverwriteBehavior};
use dshd_core::{identity::NodeIdentity, state::DesiredState};
use fs4::fs_std::FileExt;
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
fn atomic_with(path: &Path, data: &[u8], overwrite: OverwriteBehavior) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing parent"))?;
    fs::create_dir_all(parent)?;
    AtomicFile::new(path, overwrite)
        .write(|file| {
            file.write_all(data)?;
            file.sync_all()
        })
        .map_err(|error| match error {
            atomicwrites::Error::Internal(error) | atomicwrites::Error::User(error) => error,
        })?;
    sync_parent(parent)
}

fn atomic(path: &Path, data: &[u8]) -> io::Result<()> {
    atomic_with(path, data, AllowOverwrite)
}

#[cfg(unix)]
fn sync_parent(parent: &Path) -> io::Result<()> {
    File::open(parent)?.sync_all()
}
#[cfg(not(unix))]
fn sync_parent(_parent: &Path) -> io::Result<()> {
    Ok(())
}
pub struct IdentityStore {
    path: PathBuf,
}
impl IdentityStore {
    pub fn new(root: &Path) -> Self {
        Self {
            path: root.join("identity.json"),
        }
    }
    pub fn load(&self) -> io::Result<Option<NodeIdentity>> {
        if !self.path.exists() {
            return Ok(None);
        }
        let s = fs::read_to_string(&self.path)?;
        let get = |k: &str| {
            s.split(&format!("\"{k}\":\""))
                .nth(1)
                .and_then(|x| x.split('"').next())
                .map(str::to_owned)
        };
        if !s.contains("\"schema_version\":1") {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "identity schema",
            ));
        }
        Ok(Some(NodeIdentity {
            schema_version: 1,
            node_id: get("node_id")
                .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "node_id"))?,
            storage_id: get("storage_id")
                .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "storage_id"))?,
        }))
    }
    pub fn create_if_absent(&self, i: &NodeIdentity) -> io::Result<()> {
        if self.path.exists() {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "identity exists",
            ));
        }
        atomic_with(
            &self.path,
            format!(
                "{{\"schema_version\":1,\"node_id\":\"{}\",\"storage_id\":\"{}\"}}\n",
                i.node_id, i.storage_id
            )
            .as_bytes(),
            DisallowOverwrite,
        )
    }
}
pub struct DesiredStore {
    path: PathBuf,
}
impl DesiredStore {
    pub fn new(root: &Path) -> Self {
        Self {
            path: root.join("desired-state.json"),
        }
    }
    pub fn load_or_create(&self) -> io::Result<DesiredState> {
        if !self.path.exists() {
            self.persist(DesiredState::Running)?;
            return Ok(DesiredState::Running);
        }
        match fs::read_to_string(&self.path)?.as_str() {
            "{\"schema_version\":1,\"desired\":\"RUNNING\"}\n" => Ok(DesiredState::Running),
            "{\"schema_version\":1,\"desired\":\"STOPPED\"}\n" => Ok(DesiredState::Stopped),
            _ => Err(io::Error::new(io::ErrorKind::InvalidData, "desired schema")),
        }
    }
    pub fn persist(&self, d: DesiredState) -> io::Result<()> {
        let value = if d == DesiredState::Running {
            "RUNNING"
        } else {
            "STOPPED"
        };
        atomic(
            &self.path,
            format!("{{\"schema_version\":1,\"desired\":\"{value}\"}}\n").as_bytes(),
        )
    }
}
#[derive(Debug)]
pub struct WriterGuard {
    _file: File,
}
impl WriterGuard {
    pub fn acquire(root: &Path) -> io::Result<Self> {
        fn guard_error(error: io::Error) -> io::Error {
            if error.kind() == io::ErrorKind::WouldBlock
                || matches!(error.raw_os_error(), Some(32 | 33))
            {
                io::Error::new(io::ErrorKind::WouldBlock, "WRITER_GUARD_HELD")
            } else {
                error
            }
        }
        fs::create_dir_all(root)?;
        let path = root.join("writer.lock");
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(&path)
            .map_err(guard_error)?;
        // fs4 maps this owner-bound lock to LockFileEx on Windows and flock on Unix.
        file.try_lock_exclusive().map_err(guard_error)?;
        file.set_len(0).map_err(guard_error)?;
        writeln!(file, "pid={}", std::process::id()).map_err(guard_error)?;
        file.sync_all().map_err(guard_error)?;
        Ok(Self { _file: file })
    }
}
pub fn generated_uuid_v4() -> String {
    let n = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        ^ u128::from(std::process::id());
    let mut b = n.to_be_bytes();
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        b[0],
        b[1],
        b[2],
        b[3],
        b[4],
        b[5],
        b[6],
        b[7],
        b[8],
        b[9],
        b[10],
        b[11],
        b[12],
        b[13],
        b[14],
        b[15]
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    fn root(n: &str) -> PathBuf {
        std::env::temp_dir().join(format!("dshd-{n}-{}", std::process::id()))
    }
    #[test]
    fn desired_is_durable() {
        let r = root("desired");
        let s = DesiredStore::new(&r);
        assert_eq!(s.load_or_create().unwrap(), DesiredState::Running);
        s.persist(DesiredState::Stopped).unwrap();
        assert_eq!(s.load_or_create().unwrap(), DesiredState::Stopped);
        fs::remove_dir_all(r).unwrap()
    }
    #[test]
    fn guard_is_exclusive() {
        let r = root("guard");
        let g = WriterGuard::acquire(&r).unwrap();
        assert_eq!(
            WriterGuard::acquire(&r).unwrap_err().kind(),
            io::ErrorKind::WouldBlock
        );
        drop(g);
        assert!(WriterGuard::acquire(&r).is_ok());
        fs::remove_dir_all(r).unwrap()
    }
    #[test]
    fn stale_lock_file_does_not_block_a_successor() {
        let r = root("stale-guard");
        fs::create_dir_all(&r).unwrap();
        fs::write(r.join("writer.lock"), b"pid=gone\n").unwrap();
        assert!(WriterGuard::acquire(&r).is_ok());
        fs::remove_dir_all(r).unwrap()
    }
    #[test]
    fn replacement_is_always_a_complete_old_or_new_value() {
        let r = root("atomic-replace");
        let s = DesiredStore::new(&r);
        s.persist(DesiredState::Running).unwrap();
        for expected in [DesiredState::Stopped, DesiredState::Running] {
            s.persist(expected).unwrap();
            assert_eq!(s.load_or_create().unwrap(), expected);
        }
        fs::remove_dir_all(r).unwrap()
    }
    #[test]
    fn uuid_is_v4() {
        assert_eq!(generated_uuid_v4().as_bytes()[14], b'4');
    }
}
