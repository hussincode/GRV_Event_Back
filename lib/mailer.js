const nodemailer = require("nodemailer");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: requiredEnv("EMAIL_USER"),
      pass: requiredEnv("EMAIL_APP_PASSWORD"),
    },
  });
  return cachedTransporter;
}

const EVENT_NAME = "GRV Offline Event 2026";
const EVENT_DATE = "30 July 2026";
const EVENT_VENUE = "Canadian International College (CIC)";

async function sendApprovalEmail({ to, fullName, ticketId, qrCodeDataUrl }) {
  const base64 = qrCodeDataUrl.split(",")[1] ?? "";

  await getTransporter().sendMail({
    from: `"GRV Events" <${requiredEnv("EMAIL_USER")}>`,
    to,
    subject: `You're approved — ${EVENT_NAME} ticket`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
        <h2 style="color: #2b4fff;">You're approved, ${fullName}!</h2>
        <p>Your registration for <strong>${EVENT_NAME}</strong> has been approved.</p>
        <p><strong>Date:</strong> ${EVENT_DATE}<br/>
           <strong>Venue:</strong> ${EVENT_VENUE}</p>
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        <p>Please present the QR code below at check-in. Save this email or a screenshot of the QR code.</p>
        <img src="cid:ticket-qr" alt="Ticket QR Code" style="width: 260px; height: 260px; display: block; margin: 24px 0;" />
        <p style="color: #666; font-size: 13px;">See you there!</p>
      </div>
    `,
    attachments: [
      {
        filename: `${ticketId}.png`,
        content: Buffer.from(base64, "base64"),
        cid: "ticket-qr",
      },
    ],
  });

  console.log(`Sent approval email to ${to} (ticket ${ticketId})`);
}

async function sendRejectionEmail({ to, fullName }) {
  await getTransporter().sendMail({
    from: `"GRV Events" <${requiredEnv("EMAIL_USER")}>`,
    to,
    subject: `Update on your ${EVENT_NAME} registration`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
        <h2 style="color: #444;">Hi ${fullName},</h2>
        <p>Thank you for registering for <strong>${EVENT_NAME}</strong>.</p>
        <p>After careful review, we're unable to confirm your attendance for this event. We received a high volume of registrations and had limited capacity.</p>
        <p>We appreciate your interest and hope to see you at a future GRV event.</p>
        <p style="color: #666; font-size: 13px;">Thank you for your understanding.</p>
      </div>
    `,
  });

  console.log(`Sent rejection email to ${to}`);
}

module.exports = { sendApprovalEmail, sendRejectionEmail };
