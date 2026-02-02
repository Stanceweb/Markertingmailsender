import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { NextResponse, NextRequest } from "next/server";
import { OutputData } from '@editorjs/editorjs';
import { convertToHtml, convertToText } from "@/utils/editorjsParser";

interface Recipient {
  name: string;
  email: string;
}

type EmailProvider = "gmail" | "outlook" | "improvemx" | "resend";

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
  return (
    value === "gmail" ||
    value === "outlook" ||
    value === "improvemx" ||
    value === "resend"
  );
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

  if (!isEmailProvider(emailProvider)) {
    return NextResponse.json(
      { error: "Invalid emailProvider. Expected 'gmail', 'outlook', 'improvemx', or 'resend'." },
      { status: 400 }
    );
  }

  if (typeof senderEmail !== "string" || senderEmail.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing senderEmail. Enter your SMTP username/email in the UI." },
      { status: 400 }
    );
  }
  if (
    emailProvider !== "resend" &&
    (typeof senderPassword !== "string" || senderPassword.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "Missing senderPassword. Enter your SMTP password (or app password) in the UI." },
      { status: 400 }
    );
  }

  // Resend requires a user-provided API key (no env fallback)
  if (
    emailProvider === "resend" &&
    (!senderPassword || senderPassword.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "Missing Resend API Key. Enter it in the UI." },
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
  
  // Convert to HTML and plain text
  const htmlContent = convertToHtml(editorData);
  const textContent = convertToText(editorData);

  const resolvedSenderEmail = senderEmail.trim();
  const resolvedSenderPassword = senderPassword?.trim() ?? "";

  // Determine SMTP host based on email provider
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
      user: resolvedSenderEmail,
      pass: resolvedSenderPassword,
    },
  });

  const MAX_RETRIES = 3;
  const MIN_INTERVAL_MS = 50000;
  const CONCURRENCY = 1;
  const BATCH_DELAY_MS = 0;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const parseRetryAfter = (value?: string | null) => {
    if (!value) return 0;
    const asInt = Number.parseInt(value, 10);
    if (!Number.isNaN(asInt)) return asInt * 1000;
    const asDate = Date.parse(value);
    return Number.isNaN(asDate) ? 0 : Math.max(0, asDate - Date.now());
  };

  // Create a ReadableStream to send progress
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const total = recipients.length;
        let sent = 0;
        let failed = 0;
        const failedEmails: string[] = [];

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

        let lastAttemptAt = 0;

        const waitForRateLimit = async () => {
          const now = Date.now();
          const waitFor = Math.max(0, lastAttemptAt + MIN_INTERVAL_MS - now);
          if (waitFor > 0) {
            await delay(waitFor);
          }
          lastAttemptAt = Date.now();
        };

        const sendRecipient = async (recipient: Recipient) => {
          let attempt = 0;
          let errorMsg = "";

          while (attempt < MAX_RETRIES) {
            try {
              await waitForRateLimit();
              const mailOptions = {
                from: resolvedSenderEmail,
                to: recipient.email,
                subject,
                replyTo: resolvedSenderEmail,
                text: useGreeting
                  ? `Dear ${recipient.name},\n\n${textContent}`
                  : textContent,
                html: useGreeting
                  ? `<p>Dear ${recipient.name},</p>${htmlContent}`
                  : htmlContent,
                attachments,
              };

              if (emailProvider === "resend") {
                const resendPayload = {
                  from: resolvedSenderEmail,
                  to: [recipient.email],
                  subject,
                  html: mailOptions.html,
                  text: mailOptions.text,
                  reply_to: resolvedSenderEmail,
                  attachments: attachments.length
                    ? attachments.map((attachment) => ({
                        filename: attachment.filename || "attachment",
                        content: String(attachment.content),
                      }))
                    : undefined,
                };

                const resendResponse = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${resolvedSenderPassword}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(resendPayload),
                });

                if (resendResponse.status === 429) {
                  const retryAfterMs = parseRetryAfter(
                    resendResponse.headers.get("retry-after")
                  );
                  const backoffMs = Math.min(30000, 1000 * 2 ** attempt);
                  await delay(retryAfterMs || backoffMs);
                  attempt += 1;
                  continue;
                }

                if (!resendResponse.ok) {
                  const resendBody = await resendResponse.text().catch(() => "");
                  throw new Error(
                    resendBody
                      ? `Resend API error (${resendResponse.status}): ${resendBody}`
                      : `Resend API error (${resendResponse.status})`
                  );
                }
              } else {
                const info = await transporter.sendMail(mailOptions);
                const normalizedRecipient = recipient.email.trim().toLowerCase();
                const accepted = (Array.isArray(info.accepted) ? info.accepted : [])
                  .map((value) => String(value).toLowerCase());
                const rejected = (Array.isArray(info.rejected) ? info.rejected : [])
                  .map((value) => String(value).toLowerCase());
                const isRejected =
                  rejected.includes(normalizedRecipient) ||
                  (accepted.length > 0 && !accepted.includes(normalizedRecipient));

                if (isRejected) {
                  const responseText = info.response ? ` ${info.response}` : "";
                  throw new Error(`SMTP rejected recipient.${responseText}`);
                }
              }

              sent += 1;
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
              return;
            } catch (error) {
              attempt += 1;
              errorMsg = (error as Error).message;
              if (attempt < MAX_RETRIES) {
                const backoffMs = Math.min(30000, 1000 * 2 ** (attempt - 1));
                await delay(backoffMs);
              }
            }
          }

          failed += 1;
          failedEmails.push(recipient.email);
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
        };

        for (let i = 0; i < recipients.length; i += CONCURRENCY) {
          const batch = recipients.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map((recipient) => sendRecipient(recipient)));
          if (i + CONCURRENCY < recipients.length && BATCH_DELAY_MS > 0) {
            await delay(BATCH_DELAY_MS);
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
