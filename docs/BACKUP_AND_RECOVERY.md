# Backup and recovery

How farm data is protected and how to get it back (#107, SRS §25.4). This applies to both environments, `development` (dev) and `main` (prod). See [ENVIRONMENTS_AND_RELEASES.md](ENVIRONMENTS_AND_RELEASES.md). Recovery never involves creating another environment.

## What is protected, and how

| Data                                                      | Where                                    | Protection                                                                                                               | Recovery window                         |
| --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Farm records (trees, harvests, stock, sales, RBAC, audit) | DynamoDB `FarmData` table                | Point-in-time recovery (PITR). The table is retained if its stack is deleted. Deletion protection is on in prod.         | Any second in the last 35 days          |
| Photos and documents                                      | S3 media bucket (`tenants/{tenantId}/…`) | Versioning. A deleted or overwritten object keeps its old version.                                                       | 90 days after it was replaced           |
| User accounts                                             | Cognito user pool                        | **No backup.** The pool must never be replaced. Its logical ID is pinned in `amplify/backend.ts`; see the comment there. | None. Users would have to sign up again |
| Code and infrastructure                                   | GitHub                                   | Every deploy is a commit; prod deploys are semantic-release tags.                                                        | Full history                            |

Mistakes made inside the app are usually fixed inside the app, without a restore:

- Every change is in the audit log (Settings → Change history).
- Removed rounds, sales and other records can be restored from their own pages.
- Settings → Export gives a tenant a CSV copy of its records at any time.

Use the procedures below only when data is lost outside the app's control. Examples: a bad migration, a bug that wrote wrong values across many records, or an accidental delete in the AWS console.

## Who can restore

You need an AWS identity with write access in account `669546737040`, region `ap-southeast-1`. The `farm-readonly` profile **cannot** restore anything.

## Restore farm records (DynamoDB PITR)

PITR restores into a **new table**; it never overwrites the live one. Then copy back only what was lost.

1. **Find the moment before the damage.** Use the audit log or CloudWatch logs for `farm-api`. Note the UTC time.
2. **Find the live table name.** In the CloudFormation console, look in the branch's `data` nested stack for the `FarmData` resource.
3. **Restore it to a new table:**
   ```sh
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name <live table> \
     --target-table-name <live table>-restore-<yyyymmddhhmm> \
     --restore-date-time <ISO UTC time> \
     --region ap-southeast-1
   aws dynamodb wait table-exists --table-name <live table>-restore-<yyyymmddhhmm>
   ```
4. **Copy back only the affected items.** Every partition key starts with the tenant (`T#{tenantId}`; see `src/domain/keys.ts`), so one tenant's partition can be queried from the restored table and written to the live one. Keep each item's `version` attribute as restored. The app's version checks then treat the restored item as current.
5. **Check:** open the affected screens on the app and confirm the stock totals.
6. **Delete the restored table** once you're done. It is a one-off copy, not an environment, and it costs money while it exists.

If the whole table is unusable, do **not** point the app at a different table by hand. The table is managed by CDK, so a manual switch would be overwritten on the next deploy. Copy everything back from the restored table into the live one instead (step 4 without the tenant filter).

## Restore a photo or document (S3 versioning)

```sh
aws s3api list-object-versions --bucket <media bucket> --prefix tenants/<tenantId>/<path>
aws s3api copy-object --bucket <media bucket> --key <key> \
  --copy-source "<media bucket>/<key>?versionId=<versionId>"
```

If the object was deleted, removing its delete marker also restores it:
`aws s3api delete-object --bucket <b> --key <k> --version-id <delete marker id>`.

## Prevent rather than restore

- **Never rename or remove these, or CloudFormation will replace them and their data with them:**
  - the `FarmData` construct ID;
  - the user pool's logical ID;
  - the storage `name` (`appStorage`).
- Schema changes go to dev first. Each push deploys its branch, so check the result on live dev before promoting `development` → `main`.
- Before a risky data change on prod, note the time. PITR can return to the second before it.

## Checking the protections are on

Someone with write access checks this once after each prod release that touches `amplify/backend.ts`:

```sh
aws dynamodb describe-continuous-backups --table-name <live table>   # PointInTimeRecoveryStatus: ENABLED
aws s3api get-bucket-versioning --bucket <media bucket>              # Status: Enabled
aws s3api get-public-access-block --bucket <media bucket>            # all four true
```
