import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { NextResponse, NextRequest } from "next/server";
import { OutputData } from '@editorjs/editorjs';
import { convertToHtml } from "@/utils/editorjsParser";

interface Recipient {
  name: string;
  email: string;
}

type EmailProvider = "gmail" | "outlook" | "improvemx";

type SendEmailsBody = {
  senderEmail: string;
  senderPassword: string;
  recipients: Recipient[];
  subject: string;
  text: string;
  emailProvider: EmailProvider;
  useGreeting: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEmailProvider(value: unknown): value is EmailProvider {
  return value === "gmail" || value === "outlook" || value === "improvemx";
}

type ImageBlock = {
  id: string;
  type: "image";
  data?: { file?: { url?: string } };
};

function isImageBlock(block: unknown): block is ImageBlock {
  if (!isRecord(block)) return false;
  return (
    block.type === "image" &&
    typeof block.id === "string" &&
    (block.data === undefined || isRecord(block.data))
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const {
    senderEmail,
    senderPassword,
    recipients,
    subject,
    text,
    emailProvider,
    useGreeting,
  } = (isRecord(body) ? (body as Partial<SendEmailsBody>) : {}) as Partial<SendEmailsBody>;

  if (typeof senderEmail !== "string" || senderEmail.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing senderEmail. Enter your SMTP username/email in the UI." },
      { status: 400 }
    );
  }
  if (typeof senderPassword !== "string" || senderPassword.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing senderPassword. Enter your SMTP password (or app password) in the UI." },
      { status: 400 }
    );
  }

  if (!Array.isArray(recipients)) {
    return NextResponse.json(
      { error: "Invalid recipients. Expected an array." },
      { status: 400 }
    );
  }
  if (typeof subject !== "string") {
    return NextResponse.json(
      { error: "Invalid subject. Expected a string." },
      { status: 400 }
    );
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing email content (Editor.js JSON in `text`)." },
      { status: 400 }
    );
  }

  if (!isEmailProvider(emailProvider)) {
    return NextResponse.json(
      { error: "Invalid emailProvider. Expected 'gmail', 'outlook', or 'improvemx'." },
      { status: 400 }
    );
  }

  // Parse the Editor.js JSON data
  let editorData: OutputData;
  try {
    editorData = JSON.parse(text) as OutputData;
  } catch {
    return NextResponse.json(
      { error: "Invalid Editor.js JSON in `text`." },
      { status: 400 }
    );
  }
  
  // Convert to HTML
  const htmlContent = convertToHtml(editorData);

  // Determine SMTP host based on email provider
  const host =
    emailProvider === "gmail"
      ? "smtp.gmail.com"
      : emailProvider === "outlook"
      ? "smtp.office365.com"
      : "smtp.improvmx.com";

  const resolvedSenderEmail = senderEmail.trim();
  const resolvedSenderPassword = senderPassword.trim();

  const transporter = nodemailer.createTransport({
    host: host,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: resolvedSenderEmail,
      pass: resolvedSenderPassword,
    },
  });

  const MAX_RETRIES = 3;

  // Create a ReadableStream to send progress
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const total = recipients.length;
        let sent = 0;
        let failed = 0;
        const failedEmails: string[] = [];

        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          const blocks = Array.isArray(editorData.blocks) ? editorData.blocks : [];
          const attachments = blocks
            .filter(isImageBlock)
            .map((block): Attachment | null => {
              const url = block.data?.file?.url;
              if (typeof url !== "string" || !url.includes(",")) return null;
              const base64 = url.split(",")[1];
              if (!base64) return null;

              const attachment: Attachment = {
                filename: `image-${block.id}.png`,
                content: base64,
                encoding: "base64",
                cid: block.id,
              };
              return attachment;
            })
            .filter((a): a is Attachment => a !== null);

          const mailOptions = {
            from: resolvedSenderEmail,
            to: recipient.email,
            subject,
            html: useGreeting
              ? `<p>Dear ${recipient.name},</p>${htmlContent}`
              : htmlContent,
            attachments,
          };

          let attempt = 0;
          let success = false;
          let errorMsg = "";

          while (attempt < MAX_RETRIES && !success) {
            try {
              await transporter.sendMail(mailOptions);
              sent += 1;
              success = true;
              // Send progress update
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    status: "success",
                    email: recipient.email,
                    sent,
                    total,
                  }) + "\n"
                )
              );
            } catch (error) {
              attempt += 1;
              errorMsg = (error as Error).message;
              if (attempt >= MAX_RETRIES) {
                failed += 1;
                failedEmails.push(recipient.email);
                // Send progress update
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      status: "error",
                      email: recipient.email,
                      error: errorMsg,
                      sent,
                      total,
                    }) + "\n"
                  )
                );
              }
              // Wait before retrying
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          // Throttle to 20 emails per minute (3000 ms delay after every email)
          if (i < recipients.length - 1) {
            if ((i + 1) % 20 === 0) {
              console.log("Waiting for 1 minute to send the next batch...");
              await new Promise((resolve) => setTimeout(resolve, 60000)); // 1-minute delay every 20 emails
            } else {
              await new Promise((resolve) => setTimeout(resolve, 3000)); // 3-second delay between each email
            }
          }
        }

        // Send final summary
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ status: "complete", sent, failed, failedEmails }) +
              "\n"
          )
        );

        controller.close();
      } catch (error) {
        controller.error(error as Error);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
