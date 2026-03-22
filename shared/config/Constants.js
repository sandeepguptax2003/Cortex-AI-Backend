// CORS Origins
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://cortex-ai.vercel.app",
    ];

// JWT Configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || "your-jwt-secret-key",
  expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
};

// DynamoDB Tables
const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || "cortex-users",
  ORGANISATIONS: process.env.DYNAMODB_ORGANISATIONS_TABLE || "cortex-organisations",
  TICKETS: process.env.DYNAMODB_TICKETS_TABLE || "cortex-tickets",
  MEETINGS: process.env.DYNAMODB_MEETINGS_TABLE || "cortex-meetings",
  INVITES: process.env.DYNAMODB_INVITES_TABLE || "cortex-invites",
  NOTIFICATIONS: process.env.DYNAMODB_NOTIFICATIONS_TABLE || "cortex-notifications",
  ACTIVITY_LOGS: process.env.DYNAMODB_ACTIVITY_LOGS_TABLE || "cortex-activity-logs",
};

// S3 Configuration
const S3_CONFIG = {
  bucket: process.env.S3_BUCKET || "cortex-ai-uploads",
  region: process.env.AWS_REGION || "ap-south-1",
  profilePicturesPrefix: "profile-pictures/",
  transcriptsPrefix: "transcripts/",
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

// AWS Bedrock Configuration
const BEDROCK_CONFIG = {
  region: process.env.BEDROCK_REGION || "us-east-1",
  modelId: process.env.BEDROCK_MODEL_ID || "us.amazon.nova-micro-v1:0",
};

// Slack Configuration
const SLACK_CONFIG = {
  clientId: process.env.SLACK_CLIENT_ID || "",
  clientSecret: process.env.SLACK_CLIENT_SECRET || "",
  redirectUri: process.env.SLACK_REDIRECT_URI || "http://localhost:3000/integrations/slack/callback",
};

// Email Configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || "noreply@cortex-ai.com",
  region: process.env.AWS_REGION || "ap-south-1",
};

// Rate Limiting
const RATE_LIMITS = {
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  },
};

// Ticket Priorities
const TICKET_PRIORITIES = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

// Ticket Statuses
const TICKET_STATUSES = {
  BACKLOG: "BACKLOG",
  ACTIVE: "ACTIVE",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
};

// User Roles
const USER_ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  MEMBER: "MEMBER",
};

// Notification Types
const NOTIFICATION_TYPES = {
  TICKET_ASSIGNED: "TICKET_ASSIGNED",
  TICKET_UPDATED: "TICKET_UPDATED",
  TICKET_COMMENT: "TICKET_COMMENT",
  MEETING_STARTED: "MEETING_STARTED",
  MEETING_ENDED: "MEETING_ENDED",
  INVITE_RECEIVED: "INVITE_RECEIVED",
  DEADLINE_APPROACHING: "DEADLINE_APPROACHING",
};

module.exports = {
  CORS_ORIGINS,
  JWT_CONFIG,
  TABLES,
  S3_CONFIG,
  BEDROCK_CONFIG,
  SLACK_CONFIG,
  EMAIL_CONFIG,
  RATE_LIMITS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  USER_ROLES,
  NOTIFICATION_TYPES,
};
