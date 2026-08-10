import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

const FROM = '"Split Expense App" <rajputabhic32@gmail.com>'; // <- your actual verified sender

export async function sendOtpEmail(email: string, otp: string) {
  const info = await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Your sign-in code",
    text: `Your code is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your code is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
  });
  console.log("Brevo SMTP response:", info);
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
    from: FROM,
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