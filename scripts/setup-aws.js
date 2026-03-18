require("dotenv").config();

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  CreateTableCommand,
  DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const tables = [
  {
    TableName: process.env.DYNAMODB_USERS_TABLE || "cortex-users",
    KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "email", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "organisationId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "UserIdIndex",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: "OrgIndex",
        KeySchema: [{ AttributeName: "organisationId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: process.env.DYNAMODB_ORGANISATIONS_TABLE || "cortex-organisations",
    KeySchema: [{ AttributeName: "orgId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "orgId", AttributeType: "S" }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: process.env.DYNAMODB_TICKETS_TABLE || "cortex-tickets",
    KeySchema: [{ AttributeName: "ticketId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "ticketId", AttributeType: "S" },
      { AttributeName: "orgId", AttributeType: "S" },
      { AttributeName: "assigneeId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "OrgIndex",
        KeySchema: [{ AttributeName: "orgId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: "AssigneeIndex",
        KeySchema: [{ AttributeName: "assigneeId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: process.env.DYNAMODB_MEETINGS_TABLE || "cortex-meetings",
    KeySchema: [{ AttributeName: "meetingId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "meetingId", AttributeType: "S" },
      { AttributeName: "orgId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "OrgIndex",
        KeySchema: [{ AttributeName: "orgId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: process.env.DYNAMODB_INVITES_TABLE || "cortex-invites",
    KeySchema: [{ AttributeName: "token", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "token", AttributeType: "S" },
      { AttributeName: "orgId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "OrgIndex",
        KeySchema: [{ AttributeName: "orgId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: process.env.DYNAMODB_NOTIFICATIONS_TABLE || "cortex-notifications",
    KeySchema: [{ AttributeName: "notificationId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "notificationId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "UserIndex",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: process.env.DYNAMODB_ACTIVITY_LOGS_TABLE || "cortex-activity-logs",
    KeySchema: [{ AttributeName: "logId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "logId", AttributeType: "S" },
      { AttributeName: "orgId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "OrgIndex",
        KeySchema: [{ AttributeName: "orgId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
];

async function tableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === "ResourceNotFoundException") {
      return false;
    }
    throw error;
  }
}

async function createTable(tableConfig) {
  const exists = await tableExists(tableConfig.TableName);
  if (exists) {
    process.stdout.write(`Table ${tableConfig.TableName} already exists\n`);
    return;
  }

  try {
    await client.send(new CreateTableCommand(tableConfig));
    process.stdout.write(`Created table: ${tableConfig.TableName}\n`);
  } catch (error) {
    process.stderr.write(`Error creating table ${tableConfig.TableName}: ${error.message}\n`);
  }
}

async function setupTables() {
  process.stdout.write("Setting up DynamoDB tables...\n");
  for (const table of tables) {
    await createTable(table);
  }
  process.stdout.write("Setup complete!\n");
}

setupTables().catch((error) => {
  process.stderr.write(`Setup failed: ${error.message}\n`);
  process.exit(1);
});
