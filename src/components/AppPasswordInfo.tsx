import React from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type EmailProvider = "gmail" | "outlook" | "improvemx" | "resend";

const AppPasswordInfo: React.FC<{ emailProvider: EmailProvider }> = ({
  emailProvider,
}) => {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        {emailProvider === "resend" ? (
          <>
            Use your Resend API Key.
            <ol className="list-decimal list-inside mt-2">
              <li>Create an API key in your Resend dashboard</li>
              <li>Paste the API key (starts with <code>re_</code>) here</li>
              <li>Ensure your sender email is a verified domain in Resend</li>
            </ol>
          </>
        ) : emailProvider === "improvemx" ? (
          <>
            ImprovMX SMTP uses an SMTP username (your alias) and an SMTP password
            generated in ImprovMX.
            <ol className="list-decimal list-inside mt-2">
              <li>In ImprovMX, open your domain → SMTP Credentials</li>
              <li>
                Use the alias (e.g. <code>career@yourdomain.com</code>) as the
                SMTP username
              </li>
              <li>Use the generated SMTP password from ImprovMX</li>
              <li>
                SMTP host: <code>smtp.improvmx.com</code>, port: <code>587</code>,
                TLS/STARTTLS
              </li>
            </ol>
          </>
        ) : (
          <>
            Use an App Password instead of your regular email password.
            <ol className="list-decimal list-inside mt-2">
              <li>Open your account security settings</li>
              <li>Enable 2-Step Verification (if required)</li>
              <li>Create an App Password for “Mail”</li>
              <li>Paste the generated password here</li>
            </ol>
            Note: Gmail and Outlook commonly require app passwords or OAuth.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default AppPasswordInfo;
