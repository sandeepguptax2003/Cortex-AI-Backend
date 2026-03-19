require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { requestLogger } = require("./shared/middleware/Logger");
const { globalErrorHandler } = require("./shared/middleware/ErrorHandler");
const { responseHelper } = require("./shared/middleware/ResponseHandler");
const { generalLimiter } = require("./shared/config/RateLimit");

const userSignupRouter = require("./auth/routes/UserSignupRoutes");
const userLoginRouter = require("./auth/routes/UserLoginRoutes");
const userProfileRouter = require("./auth/routes/UserProfileRoutes");

const adminOrgRouter = require("./admin/routes/OrgRoutes");
const adminTeamRouter = require("./admin/routes/TeamRoutes");
const adminAnalyticsRouter = require("./admin/routes/AnalyticsRoutes");
const adminInviteRouter = require("./admin/routes/InviteRoutes");

const userTicketRouter = require("./user/routes/TicketRoutes");
const userMeetingRouter = require("./user/routes/MeetingRoutes");
const userNotificationRouter = require("./user/routes/NotificationRoutes");
const userTranscriptRouter = require("./user/routes/TranscriptRoutes");

const slackRouter = require("./integrations/slack/routes/SlackRoutes");
const botRouter = require("./integrations/bot/routes/BotRoutes");
const aiRouter = require("./integrations/ai/routes/AIRoutes");

const app = express();

app.use(helmet());

// CORS Configuration
// For Production
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : null;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!allowedOrigins || allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin '${origin}' is not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// For Development
// app.use(
//   cors({
//     origin: true,
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//   })
// );

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(responseHelper);
app.use(requestLogger);
app.use(generalLimiter);

// Default route
app.get("/", (req, res) => {
  res.send("Cortex AI Backend Service");
});

app.use("/auth/user", userSignupRouter);
app.use("/auth/user", userLoginRouter);
app.use("/auth/user", userProfileRouter);

app.use("/admin", adminOrgRouter);
app.use("/admin", adminTeamRouter);
app.use("/admin", adminAnalyticsRouter);
app.use("/admin", adminInviteRouter);

app.use("/user", userTicketRouter);
app.use("/user", userMeetingRouter);
app.use("/user", userNotificationRouter);
app.use("/user", userTranscriptRouter);

app.use("/integrations/slack", slackRouter);
app.use("/integrations/bot", botRouter);
app.use("/ai", aiRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

app.use(globalErrorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Cortex AI Backend running on port ${PORT}`);
});

module.exports = app;
