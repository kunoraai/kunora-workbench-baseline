use dshd_core::{identity::NodeIdentity, state::DesiredState};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
fn atomic(path: &Path, data: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing parent"))?;
    fs::create_dir_all(parent)?;
    let temp = parent.join(format!(".dshd-{}.tmp", std::process::id()));
    let mut f = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)?;
    f.write_all(data)?;
    f.sync_all()?;
    drop(f);
    if path.exists() {
        fs::remove_file(path)?
    }
    fs::rename(&temp, path)?;
    sync_parent(parent)
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
        atomic(
            &self.path,
            format!(
                "{{\"schema_version\":1,\"node_id\":\"{}\",\"storage_id\":\"{}\"}}\n",
                i.node_id, i.storage_id
            )
            .as_bytes(),
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
    path: PathBuf,
    _file: File,
}
impl WriterGuard {
    pub fn acquire(root: &Path) -> io::Result<Self> {
        fs::create_dir_all(root)?;
        let path = root.join("writer.lock");
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|e| {
                if e.kind() == io::ErrorKind::AlreadyExists {
                    io::Error::new(io::ErrorKind::WouldBlock, "WRITER_GUARD_HELD")
                } else {
                    e
                }
            })?;
        writeln!(file, "pid={}", std::process::id())?;
        file.sync_all()?;
        Ok(Self { path, _file: file })
    }
}
impl Drop for WriterGuard {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
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
    fn uuid_is_v4() {
        assert_eq!(generated_uuid_v4().as_bytes()[14], b'4');
    }
}
