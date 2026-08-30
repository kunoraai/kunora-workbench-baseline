use crate::config::valid_uuid;
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NodeIdentity {
    pub schema_version: u32,
    pub node_id: String,
    pub storage_id: String,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IdentityDecision {
    Create(NodeIdentity),
    Reuse(NodeIdentity),
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IdentityError {
    InvalidStorageId,
    NodeIdMismatch,
}
pub fn decide(
    node_id: &str,
    existing: Option<NodeIdentity>,
    storage_id: String,
) -> Result<IdentityDecision, IdentityError> {
    match existing {
        Some(i) if i.node_id != node_id => Err(IdentityError::NodeIdMismatch),
        Some(i) => Ok(IdentityDecision::Reuse(i)),
        None if !valid_uuid(&storage_id) => Err(IdentityError::InvalidStorageId),
        None => Ok(IdentityDecision::Create(NodeIdentity {
            schema_version: 1,
            node_id: node_id.into(),
            storage_id,
        })),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mismatch() {
        let i = NodeIdentity {
            schema_version: 1,
            node_id: "a".into(),
            storage_id: "123e4567-e89b-42d3-a456-426614174000".into(),
        };
        assert_eq!(
            decide("b", Some(i), String::new()),
            Err(IdentityError::NodeIdMismatch)
        );
    }
}
