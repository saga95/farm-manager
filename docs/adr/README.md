# Architecture Decision Records

Short, numbered records of decisions that are expensive to reverse. Use the format
**Context → Decision → Consequences**. Add a new ADR rather than rewriting an
accepted one; mark the old one _Superseded by ADR-NNNN_.

| ADR                                      | Title                                         | Status   | Issue     |
| ---------------------------------------- | --------------------------------------------- | -------- | --------- |
| [0001](0001-tenant-authorization.md)     | Tenant authorization with tenant-defined RBAC | Accepted | #18, #121 |
| [0002](0002-dynamodb-access-patterns.md) | Single-table DynamoDB and access patterns     | Accepted | #19       |
| [0003](0003-media-storage.md)            | Private, tenant-scoped media storage          | Accepted | #20       |
| [0004](0004-idempotency.md)              | Idempotent field and inventory mutations      | Accepted | #21       |

Related baseline rule: [ENVIRONMENTS_AND_RELEASES.md](../ENVIRONMENTS_AND_RELEASES.md).
