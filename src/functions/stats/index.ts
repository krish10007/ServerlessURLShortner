import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const CLICKS_TABLE = process.env.CLICKS_TABLE!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  const id = event?.pathParameters?.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing id" }) };
  }

  // query all clicks for this id
  const res = await ddb.send(
    new QueryCommand({
      TableName: CLICKS_TABLE,
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: { ":id": id },
      ScanIndexForward: false, // latest first
      Limit: 50, // cap results so query stays cheap
    })
  );

  const items = res.Items || [];
  const total = items.length;
  const referrers = items.map((i) => i.referrer).slice(0, 5);
  const userAgents = items.map((i) => i.userAgent).slice(0, 5);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      totalClicks: total,
      recentReferrers: referrers,
      recentUserAgents: userAgents,
    }),
  };
};
