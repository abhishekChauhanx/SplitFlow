import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

export async function sendOtpEmail(email: string, otp: string) {
  const info = await transporter.sendMail({
    from: `"SplitFlow" <${process.env.BREVO_SENDER_EMAIL}>`,
    to: email,
    subject: "Your sign-in code",
    text: `Your code is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your code is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
  });
  console.log("Brevo SMTP response:", info);
  return info;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const info = await transporter.sendMail({
    from: `"SplitFlow" <${process.env.BREVO_SENDER_EMAIL}>`,
    to,
    subject,
    html,
    text: text || "",
  });
  console.log(`Email sent to ${to}:`, info.response);
  console.log("Accepted:", info.accepted);
  console.log("Rejected:", info.rejected);
  return info;
}

export async function sendReminderEmail(opts: {
  to: string;
  recipientName: string;
  senderName: string;
  amount: string;
  groupName: string;
  payUrl: string;
}) {
  const { to, recipientName, senderName, amount, groupName, payUrl } = opts;

  const info = await transporter.sendMail({
    from: `"SplitFlow" <${process.env.BREVO_SENDER_EMAIL}>`,
    to,
    subject: `Reminder: You owe ${amount} in ${groupName}`,
    text: `Hi ${recipientName}, ${senderName} is reminding you that you owe ${amount} in the group ${groupName}. Pay now: ${payUrl}`,
    html: `
      <p>Hi ${recipientName},</p>
      <p><strong>${senderName}</strong> is reminding you that you owe <strong>${amount}</strong> in the group <strong>${groupName}</strong>.</p>
      <p>Open the app to settle up: <a href="${payUrl}">Pay now</a></p>
      <p style="color:#888;font-size:12px">This is an automated reminder from Split Expense App.</p>
    `,
  });
  console.log("Brevo SMTP response (reminder):", info);
  return info;
}