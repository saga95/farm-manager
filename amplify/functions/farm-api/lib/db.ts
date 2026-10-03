import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/** DocumentClient for the FarmData table (ADR-0002). Created once per container. */
export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export function tableName(): string {
  const name = process.env['FARM_TABLE_NAME'];
  if (!name) throw new Error('FARM_TABLE_NAME is not configured');
  return name;
}
