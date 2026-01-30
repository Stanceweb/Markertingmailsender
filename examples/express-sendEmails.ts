import express from "express";
import nodemailer from "nodemailer";
import { convertToHtml, convertToText } from "../src/utils/editorjsParser";

const app = express();
app.use(express.json());

type EmailProvider = "gmail" | "outlook" | "improvemx";

type Recipient = {
  name: string;
  email: string;
};

type SendEmailsBody = {
  senderEmail: string;
  senderPassword: string;
  recipients: Recipient[];
  subject: string;
  text: string;
  emailProvider: EmailProvider;
  useGreeting: boolean;
};

app.post("/sendEmails", async (req, res) => {
  const {
    senderEmail,
    senderPassword,
    recipients,
    subject,
    text,
    emailProvider,
    useGreeting,
  } = req.body as Partial<SendEmailsBody>;

  if (!senderEmail || !senderPassword || !Array.isArray(recipients) || !subject || !text) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const editorData = JSON.parse(text);
  const htmlContent = convertToHtml(editorData);
  const textContent = convertToText(editorData);

  const host =
    emailProvider === "gmail"
      ? "smtp.gmail.com"
      : emailProvider === "outlook"
      ? "smtp.office365.com"
      : "smtp.improvmx.com";

  const transporter = nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: senderEmail.trim(),
      pass: senderPassword.trim(),
    },
  });

  try {
    for (const recipient of recipients) {
      await transporter.sendMail({
        from: senderEmail,
        to: recipient.email,
        subject,
        replyTo: senderEmail,
        text: useGreeting
          ? `Dear ${recipient.name},\n\n${textContent}`
          : textContent,
        html: useGreeting
          ? `<p>Dear ${recipient.name},</p>${htmlContent}`
          : htmlContent,
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(3000, () => {
  console.log("Express sendEmails listening on http://localhost:3000");
});
