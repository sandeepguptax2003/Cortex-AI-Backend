const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const ses = new SESClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "sandeepguptax2003@gmail.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://main.dxw5lch2u6550.amplifyapp.com";

const EmailService = {
  /**
   * Send meeting summary email to a list of recipients
   */
  async sendMeetingSummary({ toEmails, meeting, tickets }) {
    if (!toEmails || toEmails.length === 0) return;

    const duration = meeting.endedAt && meeting.createdAt
      ? Math.round((new Date(meeting.endedAt) - new Date(meeting.createdAt)) / 60000)
      : null;

    const ticketRows = (tickets || []).map((t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${escapeHtml(t.title)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
          <span style="background:${priorityColor(t.priority)};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${t.priority || "MEDIUM"}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;">${t.assigneeName || "Unassigned"}</td>
      </tr>
    `).join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 32px;">
      <div style="font-size:20px;font-weight:700;color:#fff;">C Cortex AI</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Meeting Summary</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <h2 style="margin:0 0 6px;color:#1e293b;font-size:18px;">${escapeHtml(meeting.title)}</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:13px;">
        ${new Date(meeting.createdAt).toLocaleString()}
        ${duration ? ` &nbsp;·&nbsp; ${duration} min` : ""}
      </p>

      ${tickets && tickets.length > 0 ? `
      <h3 style="margin:0 0 12px;color:#374151;font-size:14px;font-weight:700;">
        ${tickets.length} Task${tickets.length !== 1 ? "s" : ""} Extracted
      </h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">TASK</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">PRIORITY</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">ASSIGNEE</th>
          </tr>
        </thead>
        <tbody>${ticketRows}</tbody>
      </table>
      ` : `
      <p style="color:#64748b;font-size:13px;">
        No tasks were extracted automatically. You can upload the transcript on the
        <a href="${FRONTEND_URL}/meetings" style="color:#7c3aed;text-decoration:none;font-weight:600;">Meetings page</a>
        to extract tasks manually.
      </p>
      `}

      ${meeting.transcript ? `
      <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;">TRANSCRIPT PREVIEW</div>
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(meeting.transcript.slice(0, 400))}${meeting.transcript.length > 400 ? "..." : ""}</p>
      </div>
      ` : ""}

      <div style="margin-top:24px;text-align:center;">
        <a href="${FRONTEND_URL}/board" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;">
          View Board →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
      Cortex AI &nbsp;·&nbsp; AI-powered meeting task extraction
    </div>
  </div>
</body>
</html>`;

    const text = [
      `Meeting Summary: ${meeting.title}`,
      `Date: ${new Date(meeting.createdAt).toLocaleString()}`,
      duration ? `Duration: ${duration} min` : "",
      "",
      tickets && tickets.length > 0
        ? [`${tickets.length} tasks extracted:`, ...tickets.map((t) => `  • ${t.title} [${t.priority || "MEDIUM"}]${t.assigneeName ? ` → ${t.assigneeName}` : ""}`)].join("\n")
        : "No tasks were extracted automatically.",
      "",
      `View board: ${FRONTEND_URL}/board`,
    ].filter(Boolean).join("\n");

    // SES can send to max 50 addresses per call; chunk if needed
    const chunks = [];
    for (let i = 0; i < toEmails.length; i += 50) chunks.push(toEmails.slice(i, i + 50));

    for (const chunk of chunks) {
      try {
        await ses.send(new SendEmailCommand({
          Source: `Cortex AI <${FROM_EMAIL}>`,
          Destination: { BccAddresses: chunk },
          Message: {
            Subject: { Data: `Meeting Summary: ${meeting.title}`, Charset: "UTF-8" },
            Body: {
              Html: { Data: html, Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        }));
      } catch (err) {
        console.error("[EmailService] SES send error:", err.message);
      }
    }
  },

  /**
   * Send invite email
   */
  async sendInvite({ toEmail, inviteUrl, orgName, invitedBy }) {
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:32px 0;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 32px;">
      <div style="font-size:20px;font-weight:700;color:#fff;">C Cortex AI</div>
    </div>
    <div style="padding:28px 32px;">
      <h2 style="margin:0 0 12px;color:#1e293b;">You've been invited!</h2>
      <p style="color:#64748b;font-size:14px;line-height:1.6;">
        <strong>${escapeHtml(invitedBy)}</strong> has invited you to join
        <strong>${escapeHtml(orgName)}</strong> on Cortex AI.
      </p>
      <div style="margin-top:24px;text-align:center;">
        <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
          Accept Invite →
        </a>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin-top:20px;text-align:center;">Link expires in 7 days.</p>
    </div>
  </div>
</body>
</html>`;

    try {
      await ses.send(new SendEmailCommand({
        Source: `Cortex AI <${FROM_EMAIL}>`,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: `You're invited to join ${orgName} on Cortex AI`, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: `Join ${orgName} on Cortex AI: ${inviteUrl}`, Charset: "UTF-8" },
          },
        },
      }));
    } catch (err) {
      console.error("[EmailService] Invite email error:", err.message);
    }
  },
};

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priorityColor(priority) {
  switch ((priority || "").toUpperCase()) {
    case "URGENT": return "#ef4444";
    case "HIGH":   return "#f97316";
    case "MEDIUM": return "#eab308";
    case "LOW":    return "#22c55e";
    default:       return "#94a3b8";
  }
}

module.exports = { EmailService };
