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
    from: '"Split Expense App" <rajputabhic32@gmail.com>', // <- your actual verified sender
    to: email,
    subject: "Your sign-in code",
    text: `Your code is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your code is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
  });
  console.log("Brevo SMTP response:", info);
  return info;
}