import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.URLS_TABLE!; // set from CDK
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  // 1) read the short id from the path, e.g., GET /abc123
  const id = event?.pathParameters?.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing id" }) };
  }

  // 2) look up in DynamoDB
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  const item = res.Item;

  if (!item || !item.originalUrl) {
    // not found
    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  }

  const originalUrl = item.originalUrl as string;

  // 3) return an HTTP 301 redirect
  return {
    statusCode: 301,
    headers: {
      Location: originalUrl,
      // small cache helps a bit; we'll tune later when we add analytics/CDN
      "Cache-Control": "no-store",
    },
    body: "",
  };
};
