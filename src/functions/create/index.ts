import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
const { customAlphabet } = require("nanoid");

// ---- setup ----
const TABLE = process.env.URLS_TABLE!; // set by CDK
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// base62 charset, 7 chars (~3.5e12 combos; spreads partitions well)
const nanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  7
);

// basic, safe http(s) url check
function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const handler = async (event: any) => {
  // ---- parse & validate ----
  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing body" }) };
  }

  let payload: any;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Body must be JSON" }),
    };
  }

  const originalUrl: string = payload.url || payload.originalUrl;
  if (!isValidHttpUrl(originalUrl)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid URL" }) };
  }

  // ---- create record ----
  const id = nanoid();
  const createdAt = new Date().toISOString();

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { id, originalUrl, createdAt },
      ConditionExpression: "attribute_not_exists(id)", // safety: don't overwrite
    })
  );

  // Build a nice shortUrl (real domain appears only after deploy)
  const domain = event?.requestContext?.domainName;
  const stage = event?.requestContext?.stage
    ? `/${event.requestContext.stage}`
    : "";
  const shortUrl = domain
    ? `https://${domain}${stage}/${id}`
    : `https://{api-domain}/${id}`;

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, shortUrl, originalUrl }),
  };
};
