import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as logs from "aws-cdk-lib/aws-logs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ServerlessUrlShortnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'ServerlessUrlShortnerQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // 1) DynamoDB table: stores shortId -> originalUrl
    const urlsTable = new dynamodb.Table(this, "UrlsTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // $0 at idle
      timeToLiveAttribute: "expiresAt", // optional TTL column for later
      removalPolicy: RemovalPolicy.DESTROY, // cdk destroy cleans it up
    });

    // Clicks table: stores one item per redirect event
    const clicksTable = new dynamodb.Table(this, "ClicksTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl", // auto-cleanup
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // keep logs short (saves cost if you ever deploy)
    const logRetention = logs.RetentionDays.ONE_WEEK;

    // 2) Lambda placeholders
    const createFn = new NodejsFunction(this, "CreateShortLinkFn", {
      entry: path.join(__dirname, "../src/functions/create/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logRetention,
      // point to the project's lockfile so the NodejsFunction bundling can resolve deps
      depsLockFilePath: path.join(__dirname, "../package-lock.json"),
      environment: { URLS_TABLE: urlsTable.tableName },
    });
    urlsTable.grantReadWriteData(createFn);

    const redirectFn = new NodejsFunction(this, "RedirectFn", {
      entry: path.join(__dirname, "../src/functions/redirect/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logRetention,
      // point to the project's lockfile so the NodejsFunction bundling can resolve deps
      depsLockFilePath: path.join(__dirname, "../package-lock.json"),
      environment: { URLS_TABLE: urlsTable.tableName },
    });
    redirectFn.addEnvironment("CLICKS_TABLE", clicksTable.tableName);
    clicksTable.grantWriteData(redirectFn);
    urlsTable.grantReadData(redirectFn);

    // 3) API Gateway: POST /links -> create, GET /{id} -> redirect
    const api = new apigw.RestApi(this, "UrlShortenerApi", {
      deployOptions: {
        stageName: "dev",
        metricsEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.ERROR, // minimal logs
        dataTraceEnabled: false,
      },
      cloudWatchRole: false, // tiny savings
    });

    const links = api.root.addResource("links");
    links.addMethod("POST", new apigw.LambdaIntegration(createFn));

    const idRes = api.root.addResource("{id}");
    idRes.addMethod("GET", new apigw.LambdaIntegration(redirectFn));
  }
}
