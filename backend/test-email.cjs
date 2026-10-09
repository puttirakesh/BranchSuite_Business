
require('dotenv').config();

const nodemailer = require('nodemailer');

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.verify();

  console.log('SMTP connection successful');

  const recipient = process.argv[2];

  if (!recipient) {
    throw new Error(
      'Provide a recipient email address as an argument.',
    );
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject: 'BranchSuite Business - Email Test',
    text:
      'Hello! This is a test email from the BranchSuite Business backend using Nodemailer.',
    html: `
      <h2>BranchSuite Business</h2>
      <p>This is a test email sent using Nodemailer.</p>
      <p>Your email configuration is working!</p>
    `,
  });

  console.log('Email submitted successfully');
  console.log('Message ID:', info.messageId);
}

main().catch((error) => {
  console.error('Email test failed:', error.message);
  process.exitCode = 1;
});
