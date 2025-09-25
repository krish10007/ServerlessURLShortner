import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const URLS_TABLE = process.env.URLS_TABLE!;
const CLICKS_TABLE = process.env.CLICKS_TABLE!;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  const id = event?.pathParameters?.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing id" }) };
  }

  // 1) look up original url
  const res = await ddb.send(
    new GetCommand({ TableName: URLS_TABLE, Key: { id } })
  );
  const item = res.Item;
  if (!item || !item.originalUrl) {
    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  }
  const originalUrl = item.originalUrl as string;

  // 2) log the click (fire-and-forget)
  const timestamp = new Date().toISOString();
  const referrer = event?.headers?.referer || "unknown";
  const userAgent = event?.headers?.["user-agent"] || "unknown";

  try {
    await ddb.send(
      new PutCommand({
        TableName: CLICKS_TABLE,
        Item: {
          id,
          timestamp,
          referrer,
          userAgent,
          ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // auto-delete in 30 days
        },
      })
    );
  } catch (err) {
    console.error("Failed to log click", err);
    // don’t fail redirect if logging fails
  }

  // 3) return 301 redirect
  return {
    statusCode: 301,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store",
    },
    body: "",
  };
};
