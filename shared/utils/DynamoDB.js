const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Create document client for easier operations
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

/**
 * DynamoDB Service with common operations
 */
const DynamoDBService = {
  /**
   * Get a single item by key
   */
  async get(tableName, key) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });
    const response = await docClient.send(command);
    return response.Item;
  },

  /**
   * Put (create/update) an item
   */
  async put(tableName, item) {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });
    await docClient.send(command);
    return item;
  },

  /**
   * Update an item
   */
  async update(tableName, key, updates, options = {}) {
    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.entries(updates).forEach(([k, v], index) => {
      if (v !== undefined) {
        updateExpression.push(`#${k} = :${k}`);
        expressionAttributeNames[`#${k}`] = k;
        expressionAttributeValues[`:${k}`] = v;
      }
    });

    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: options.returnValues || "ALL_NEW",
      ...(options.conditionExpression && { ConditionExpression: options.conditionExpression }),
    });

    const response = await docClient.send(command);
    return response.Attributes;
  },

  /**
   * Delete an item
   */
  async delete(tableName, key) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
      ReturnValues: "ALL_OLD",
    });
    const response = await docClient.send(command);
    return response.Attributes;
  },

  /**
   * Query items by index
   */
  async query(tableName, options = {}) {
    const command = new QueryCommand({
      TableName: tableName,
      ...(options.indexName && { IndexName: options.indexName }),
      KeyConditionExpression: options.keyConditionExpression,
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues,
      ScanIndexForward: options.scanIndexForward,
      Limit: options.limit,
      ExclusiveStartKey: options.exclusiveStartKey,
    });
    const response = await docClient.send(command);
    return {
      items: response.Items || [],
      lastEvaluatedKey: response.LastEvaluatedKey,
      count: response.Count,
    };
  },

  /**
   * Scan items (use sparingly - expensive operation)
   */
  async scan(tableName, options = {}) {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues,
      Limit: options.limit,
      ExclusiveStartKey: options.exclusiveStartKey,
    });
    const response = await docClient.send(command);
    return {
      items: response.Items || [],
      lastEvaluatedKey: response.LastEvaluatedKey,
      count: response.Count,
    };
  },

  /**
   * Batch get items
   */
  async batchGet(tableName, keys) {
    const command = new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          Keys: keys,
        },
      },
    });
    const response = await docClient.send(command);
    return response.Responses?.[tableName] || [];
  },

  /**
   * Batch write items
   */
  async batchWrite(tableName, items) {
    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: items.map((item) => ({
          PutRequest: { Item: item },
        })),
      },
    });
    await docClient.send(command);
    return items;
  },
};

module.exports = {
  client,
  docClient,
  DynamoDBService,
};
