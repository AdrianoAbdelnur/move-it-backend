require("dotenv").config();
const nodemailer = require("nodemailer");
const fs = require("fs");

const gmailUser = process.env.GMAIL_USER || "callacartransportation@gmail.com";
const gmailPass = process.env.GMAIL_PASS;
const mailCaPath = process.env.MAIL_TLS_CA_PATH;
const mailCa = mailCaPath ? fs.readFileSync(mailCaPath) : null;
const cliRecipient = process.argv[2];
const recipient = cliRecipient || process.env.TEST_EMAIL_TO || gmailUser;

if (!gmailPass) {
  console.error("Missing GMAIL_PASS in environment.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
  tls: {
    rejectUnauthorized: true,
    ...(mailCa ? { ca: [mailCa] } : {}),
  },
});

const run = async () => {
  await transporter.verify();

  const info = await transporter.sendMail({
    from: gmailUser,
    to: recipient,
    subject: "CaC SMTP test",
    text: `SMTP test OK at ${new Date().toISOString()}`,
    html: `<p>SMTP test OK at <strong>${new Date().toISOString()}</strong></p>`,
  });

  console.log("SMTP connection verified.");
  console.log(`Mail sent to: ${recipient}`);
  console.log(`Message ID: ${info.messageId}`);
};

run().catch((error) => {
  console.error("SMTP test failed:", error.message);
  process.exit(1);
});
