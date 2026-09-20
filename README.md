# Cortex AI Backend

<p align="center">
  <strong>Decision Intelligence Platform Backend</strong><br>
  AI-powered meeting transcription, task extraction, and team collaboration API
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a>
</p>

---

> **Project Status:** Cortex AI was a live, fully deployed AWS production system (Bedrock, DynamoDB, S3, SES, API Gateway) — [Semifinalist, AWS 10,000 AIdeas Competition 2025](https://builder.aws.com/content/3B84yzRMPmtfrqTZ1WpfN50Jitg/aideas-cortex-ai-the-ai-powered-meeting-intelligence-platform). The live deployment has since been taken offline as part of AWS cost/billing cleanup; the codebase below reflects the full, working architecture. Companion repos: [Frontend](https://github.com/sandeepguptax2003/cortex-ai-frontend) · [Chrome Extension](https://github.com/sandeepguptax2003/Cortex-Chrome-Extension).

## Overview

Cortex AI Backend is a comprehensive Node.js/Express API that powers the Cortex AI Decision Intelligence Platform. It provides a complete suite of features for team collaboration, including:

- **AI-Powered Meeting Management**: Real-time meeting transcription with AWS services
- **Intelligent Task Extraction**: Automatically extract actionable tasks from meeting transcripts using AWS Bedrock AI
- **Team & Organization Management**: Multi-tenant organization structure with role-based access control
- **Ticket/Project Management**: Kanban-style task tracking with priorities, assignments, and deadlines
- **Slack Integration**: Connect your Slack workspace for seamless notifications
- **Real-time Notifications**: Stay updated with team activities
- **Analytics & Reporting**: Dashboard metrics and detailed team productivity analytics

### Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4.x |
| Database | AWS DynamoDB |
| File Storage | AWS S3 |
| AI/ML | AWS Bedrock (Nova Micro, Claude Haiku) |
| Email | AWS SES |
| Authentication | JWT (JSON Web Tokens) |
| Real-time | AWS API Gateway WebSockets |
| Deployment | Docker, AWS App Runner, AWS Elastic Beanstalk |

---

## Architecture

### Project Structure

```
cortex-ai-backend/
├── server.js                    # Application entry point
├── package.json                 # Dependencies and scripts
├── .env                         # Environment variables (not in git)
├── Dockerfile                   # Docker container configuration
├── docker-compose.yml           # Local development with Docker
├── apprunner.yaml              # AWS App Runner configuration
├── Procfile                    # Heroku/AWS Elastic Beanstalk entry
├── .ebextensions/              # Elastic Beanstalk configurations
│
├── auth/                       # Authentication module
│   ├── controllers/
│   │   ├── UserSignupController.js
│   │   ├── UserLoginController.js
│   │   └── UserProfileController.js
│   ├── middleware/
│   │   └── AuthMiddleware.js
│   └── routes/
│       ├── UserSignupRoutes.js
│       ├── UserLoginRoutes.js
│       └── UserProfileRoutes.js
│
├── admin/                      # Admin/Organization module
│   ├── controllers/
│   │   ├── OrgController.js
│   │   ├── TeamController.js
│   │   ├── AnalyticsController.js
│   │   └── InviteController.js
│   ├── middleware/
│   │   └── AdminRateLimit.js
│   └── routes/
│       ├── OrgRoutes.js
│       ├── TeamRoutes.js
│       ├── AnalyticsRoutes.js
│       └── InviteRoutes.js
│
├── user/                       # User features module
│   ├── controllers/
│   │   ├── TicketController.js
│   │   ├── MeetingController.js
│   │   ├── NotificationController.js
│   │   └── TranscriptController.js
│   ├── middleware/
│   │   └── UserRateLimit.js
│   └── routes/
│       ├── TicketRoutes.js
│       ├── MeetingRoutes.js
│       ├── NotificationRoutes.js
│       └── TranscriptRoutes.js
│
├── integrations/               # Third-party integrations
│   ├── ai/
│   │   ├── controllers/AIChatController.js
│   │   └── routes/AIRoutes.js
│   ├── slack/
│   │   ├── controllers/SlackController.js
│   │   └── routes/SlackRoutes.js
│   └── bot/
│       ├── controllers/BotController.js
│       └── routes/BotRoutes.js
│
├── shared/                     # Shared utilities and middleware
│   ├── config/
│   │   ├── Constants.js
│   │   └── RateLimit.js
│   ├── middleware/
│   │   ├── ErrorHandler.js
│   │   ├── Logger.js
│   │   └── ResponseHandler.js
│   └── utils/
│       ├── DynamoDB.js
│       ├── JWT.js
│       ├── S3.js
│       └── Email.js
│
└── scripts/
    └── setup-aws.js            # DynamoDB table setup script
```

### Module Responsibilities

#### Auth Module (`/auth`)
Handles user authentication, registration, and profile management.
- User signup with email validation
- Login with JWT token generation
- Token refresh mechanism
- Profile management (update, password change, avatar upload)
- Account deletion

#### Admin Module (`/admin`)
Organization and team management for administrators.
- Organization CRUD operations
- Team member management
- Role-based access control (Admin, Manager, Member)
- Invite system for adding team members
- Analytics and reporting

#### User Module (`/user`)
Core user functionality for day-to-day operations.
- Ticket/Task management (Kanban board)
- Meeting management and transcription
- Notification system
- Transcript upload and AI task extraction

#### Integrations Module (`/integrations`)
Third-party service integrations.
- **AI**: AWS Bedrock-powered chat and task extraction
- **Slack**: OAuth integration and notifications
- **Bot**: Command processing for bot interactions

#### Shared Module (`/shared`)
Reusable components across all modules.
- Database utilities (DynamoDB wrapper)
- Authentication utilities (JWT)
- File storage (S3)
- Email service (SES)
- Middleware (error handling, rate limiting, response formatting)

---

## API Reference

### Base URL

```
Development: http://localhost:8080
Production:  https://your-api-gateway-url.execute-api.region.amazonaws.com/prod
```

### Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Or via cookie (automatically set on login).

### Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... } // Optional additional details
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### API Endpoints

#### Authentication (`/auth/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/user/signup` | Register new user | No |
| GET | `/auth/user/check-email` | Check email availability | No |
| POST | `/auth/user/login` | User login | No |
| POST | `/auth/user/refresh-token` | Refresh access token | No (cookie) |
| POST | `/auth/user/logout` | Logout user | No |
| GET | `/auth/user/profile` | Get user profile | Yes |
| PATCH | `/auth/user/profile` | Update profile | Yes |
| PATCH | `/auth/user/password` | Update password | Yes |
| POST | `/auth/user/profile-picture` | Upload avatar | Yes |
| DELETE | `/auth/user/account` | Delete account | Yes |

#### Organization (`/admin`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/admin/organisation` | Create organization | Yes | Any |
| GET | `/admin/organisation` | Get organization | Yes | Any |
| PATCH | `/admin/organisation` | Update organization | Yes | Admin/Manager |
| DELETE | `/admin/organisation` | Delete organization | Yes | Admin |

#### Team Management (`/admin`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/admin/members` | Get team members | Yes | Any |
| GET | `/admin/members/stats` | Get team statistics | Yes | Any |
| PATCH | `/admin/members/:userId/role` | Update member role | Yes | Admin |
| DELETE | `/admin/members/:userId` | Remove member | Yes | Admin |

#### Invites (`/admin`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/admin/invites` | Create invite link | Yes | Admin/Manager |
| GET | `/admin/invites` | List invites | Yes | Admin/Manager |
| DELETE | `/admin/invites/:token` | Revoke invite | Yes | Admin/Manager |
| GET | `/admin/invite/validate` | Validate invite token | No | - |
| POST | `/admin/join` | Join with invite | No | - |

#### Analytics (`/admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/analytics/dashboard` | Dashboard analytics | Yes |
| GET | `/admin/analytics/detailed` | Detailed analytics | Yes |
| GET | `/admin/analytics/trends` | Ticket trends | Yes |

#### Tickets (`/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/user/tickets` | Get all tickets | Yes |
| GET | `/user/tickets/my` | Get my tickets | Yes |
| GET | `/user/tickets/overdue` | Get overdue tickets | Yes |
| GET | `/user/tickets/:ticketId` | Get single ticket | Yes |
| POST | `/user/tickets` | Create ticket | Yes |
| PATCH | `/user/tickets/:ticketId` | Update ticket | Yes |
| DELETE | `/user/tickets/:ticketId` | Delete ticket | Yes |
| POST | `/user/tickets/:ticketId/comments` | Add comment | Yes |

#### Meetings (`/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/user/meetings` | Get all meetings | Yes |
| GET | `/user/meetings/active` | Get active meeting | Yes |
| GET | `/user/meetings/:meetingId` | Get single meeting | Yes |
| POST | `/user/meetings/start` | Start new meeting | Yes |
| POST | `/user/meetings/:meetingId/end` | End meeting | Yes |
| POST | `/user/meetings/:meetingId/captions` | Add caption | Yes |

#### Transcripts (`/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/user/transcripts` | Get all transcripts | Yes |
| POST | `/user/transcripts` | Upload transcript | Yes |
| POST | `/user/transcripts/:meetingId/generate-tickets` | Generate tickets from transcript | Yes |

#### Notifications (`/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/user/notifications` | Get notifications | Yes |
| PATCH | `/user/notifications/:notificationId/read` | Mark as read | Yes |
| PATCH | `/user/notifications/read-all` | Mark all as read | Yes |

#### AI Integration (`/ai`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/ai/chat` | AI chat assistant | Yes |
| POST | `/ai/generate-tickets` | Generate tickets from transcript | Yes |
| POST | `/ai/summarize` | Summarize transcript | Yes |
| POST | `/ai/command` | Process AI command | Yes |

#### Slack Integration (`/integrations/slack`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/integrations/slack/status` | Get connection status | Yes |
| POST | `/integrations/slack/oauth` | OAuth callback | Yes |
| DELETE | `/integrations/slack/disconnect` | Disconnect Slack | Yes |
| POST | `/integrations/slack/events` | Slack events webhook | No |
| POST | `/integrations/slack/command` | Slack slash commands | No |

#### Bot (`/integrations/bot`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/integrations/bot/status` | Bot status | No |
| POST | `/integrations/bot/command` | Process bot command | Yes |

---

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- AWS Account with configured credentials
- npm or yarn package manager

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd cortex-ai-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   Copy the `.env` file and update with your values:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   # Server Configuration
   PORT=8080

   # Security
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars

   # AWS Configuration
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key

   # DynamoDB Tables
   DYNAMODB_USERS_TABLE=CortexData
   DYNAMODB_ORGANISATIONS_TABLE=CortexOrganisations
   DYNAMODB_TICKETS_TABLE=CortexTickets
   DYNAMODB_MEETINGS_TABLE=CortexMeetings
   DYNAMODB_INVITES_TABLE=CortexInvites
   DYNAMODB_NOTIFICATIONS_TABLE=CortexNotifications
   DYNAMODB_ACTIVITY_LOGS_TABLE=CortexActivityLogs

   # S3 Buckets
   S3_BUCKET=cortex-meetings-prod

   # AWS SES
   SES_FROM_EMAIL=your-verified-email@example.com

   # AWS Bedrock (AI)
   BEDROCK_REGION=us-east-1
   BEDROCK_MODEL_ID=us.amazon.nova-micro-v1:0

   # Slack Integration
   SLACK_CLIENT_ID=your-slack-client-id
   SLACK_CLIENT_SECRET=your-slack-client-secret
   SLACK_REDIRECT_URI=https://your-api.com/integrations/slack/oauth

   # Frontend URL
   FRONTEND_URL=http://localhost:3000

   # CORS Origins
   CORS_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

4. **Set up DynamoDB tables:**
   ```bash
   npm run setup:aws
   ```
   Or run the setup script directly:
   ```bash
   node scripts/setup-aws.js
   ```

### Running Locally

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The API will be available at `http://localhost:8080`

### Running with Docker

**Using Docker Compose:**
```bash
docker-compose up -d
```

This starts:
- API server on port 5572
- Optional Redis cache on port 6379

**Build and run manually:**
```bash
# Build image
docker build -t cortex-ai-backend .

# Run container
docker run -p 5572:5572 --env-file .env cortex-ai-backend
```

---

## Database Schema

### Users Table (Partition Key: `email`)

| Field | Type | Description |
|-------|------|-------------|
| email | String (PK) | User's email address |
| userId | String | Unique user identifier |
| name | String | User's display name |
| password | String | User password (plain text in current implementation) |
| role | String | ADMIN, MANAGER, or MEMBER |
| organisationId | String | Reference to organization |
| avatar | String | S3 URL to profile picture |
| slackUserId | String | Connected Slack user ID |
| notificationPreferences | Object | User notification settings |
| isActive | Boolean | Account status |
| createdAt | String | ISO timestamp |
| updatedAt | String | ISO timestamp |

### Organisations Table (Partition Key: `orgId`)

| Field | Type | Description |
|-------|------|-------------|
| orgId | String (PK) | Unique organization identifier |
| name | String | Organization name |
| domain | String | Email domain restriction (optional) |
| createdBy | String | Creator user ID |
| slackConnected | Boolean | Slack integration status |
| slackTeamId | String | Slack team identifier |
| slackTeamName | String | Slack workspace name |
| createdAt | String | ISO timestamp |
| updatedAt | String | ISO timestamp |

### Tickets Table (Partition Key: `ticketId`)

| Field | Type | Description |
|-------|------|-------------|
| ticketId | String (PK) | Unique ticket identifier |
| orgId | String | Organization reference |
| title | String | Ticket title |
| description | String | Ticket description |
| status | String | BACKLOG, ACTIVE, IN_PROGRESS, IN_REVIEW, DONE |
| priority | String | LOW, MEDIUM, HIGH, CRITICAL |
| assigneeId | String | Assigned user ID |
| coAssignees | Array | Additional assignees |
| reviewerId | String | Reviewer user ID |
| createdBy | String | Creator user ID |
| deadline | String | ISO timestamp (optional) |
| sourceType | String | MANUAL, MEETING, AI, BOT |
| comments | Array | Comment objects |
| activityLog | Array | Activity history |
| createdAt | String | ISO timestamp |
| updatedAt | String | ISO timestamp |

### Meetings Table (Partition Key: `meetingId`)

| Field | Type | Description |
|-------|------|-------------|
| meetingId | String (PK) | Unique meeting identifier |
| orgId | String | Organization reference |
| title | String | Meeting title |
| status | String | ACTIVE or ENDED |
| createdBy | String | Host user ID |
| participants | Array | Participant objects |
| captions | Array | Real-time captions |
| transcript | String | Full meeting transcript |
| summary | String | AI-generated summary |
| extractedTasks | Array | Tasks extracted from transcript |
| createdAt | String | ISO timestamp |
| endedAt | String | ISO timestamp |

### Invites Table (Partition Key: `token`)

| Field | Type | Description |
|-------|------|-------------|
| token | String (PK) | Unique invite token |
| orgId | String | Organization reference |
| createdBy | String | Inviter user ID |
| invitedRole | String | Role to assign (MEMBER, MANAGER, ADMIN) |
| used | Boolean | Whether invite was used |
| usedBy | String | Email of user who accepted |
| expiresAt | String | ISO timestamp |

### Notifications Table (Partition Key: `notificationId`)

| Field | Type | Description |
|-------|------|-------------|
| notificationId | String (PK) | Unique notification ID |
| userId | String | Recipient user ID (GSI) |
| type | String | Notification type |
| title | String | Notification title |
| message | String | Notification body |
| isRead | Boolean | Read status |
| createdAt | String | ISO timestamp |

---

## Deployment

### AWS App Runner

The repository includes `apprunner.yaml` for easy AWS App Runner deployment:

```yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm install
run:
  command: node server.js
  network:
    port: 8080
    env: PORT
  env:
    - name: NODE_ENV
      value: production
```

### AWS Elastic Beanstalk

1. Initialize EB application:
   ```bash
   eb init -p nodejs-18 cortex-ai-backend
   ```

2. Create environment and deploy:
   ```bash
   eb create production
   eb deploy
   ```

### Docker Deployment

Build and push to container registry:

```bash
# Build image
docker build -t cortex-ai-backend:latest .

# Tag for ECR
docker tag cortex-ai-backend:latest your-account.dkr.ecr.region.amazonaws.com/cortex-ai-backend:latest

# Push to ECR
docker push your-account.dkr.ecr.region.amazonaws.com/cortex-ai-backend:latest
```

### Environment Variables for Production

Ensure these are set in your production environment:

```env
NODE_ENV=production
PORT=8080
JWT_SECRET=<strong-random-secret>
CORS_ORIGINS=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
```

---

## Security

### Authentication
- JWT-based authentication with access and refresh tokens
- Tokens stored in httpOnly, secure, sameSite cookies
- Token expiration: 7 days (access), 30 days (refresh)

### Authorization
- Role-based access control (RBAC)
- Three roles: ADMIN, MANAGER, MEMBER
- Middleware protection on all sensitive routes

### Rate Limiting
- General API: 500 requests per 15 minutes
- Authentication: 5 attempts per 15 minutes
- AI endpoints: 60 requests per minute
- Custom rate limits per module (tickets, meetings, etc.)

### Data Protection
- Helmet.js for security headers
- CORS configured for specific origins
- Input validation on all endpoints
- Password requirements enforced (min 8 chars, uppercase, lowercase, number)

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |
| `npm run setup:aws` | Create DynamoDB tables |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- ESLint configuration included
- Follow existing code patterns
- Use async/await for asynchronous operations
- Include JSDoc comments for functions

---

## License

This project is licensed under the MIT License.

---

## Support

For support, email sandeepguptax2003@gmail.com or open an issue in the repository.

---

## Acknowledgments

- AWS SDK for JavaScript v3
- Express.js community
- All open-source contributors
