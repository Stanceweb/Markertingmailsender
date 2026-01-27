# Bulk Email Sender with Next.js 15👌💯

This application allows you to send personalized emails to multiple recipients in batches, using Next.js 15 App Router, TypeScript, and Nodemailer. Each recipient receives a customized greeting, while the email body remains the same for all.

## Features

- Bulk email sending with personalized greetings
- Added markdown to format your emails to be cool.
- Added Images support to attach Images to your emails.
- Throttling to avoid SMTP limits (20 emails per minute)
- Supports Gmail, Outlook, and ImprovMX SMTP configuration
- User-friendly interface for sending emails

## Prerequisites

- Node.js (v16+)
- Next.js 15
- TypeScript
- SMTP credentials for your provider (Gmail/Outlook app password or ImprovMX SMTP credentials)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/email-sender
cd email-sender
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Enter SMTP Credentials in the UI

When sending a campaign, enter your SMTP username (email/alias) and SMTP password (app password / provider-generated SMTP password) directly in the app.

> This project does not rely on server-side `.env.local` SMTP credentials by default.

#### ImprovMX SMTP

- Select **ImprovMX** as the provider in the UI.
- Use your ImprovMX alias email as the SMTP username (example: `career@finewideltd.com`).
- Use the generated ImprovMX SMTP password (from ImprovMX → your domain → SMTP Credentials).

Note: You need to use an app password for your Gmail account. Follow these steps to set it up:
1. Go to your Google Account settings
2. Navigate to Security
3. Under "Signing in to Google," select "App Passwords"
4. Generate a new app password for "Mail" and "Other (Custom name)"
5. Paste the generated app password into the **App Password** field in the UI

### 4. Run the Application

To run the app in development mode, use:

```bash
npm run dev
```

The application should now be accessible at http://localhost:3000.

## Usage

1. Open your browser and navigate to http://localhost:3000
2. You'll see a user interface with fields for:
   - Recipient email addresses (comma-separated)
   - Email subject
   - Email body
3. Fill in the required information
4. Click the "Send Emails" button to start the bulk email process
5. The application will send personalized emails to each recipient and display the results

## Important Notes

- SMTP providers have sending limits and anti-abuse rules (these vary by provider)
- Emails are sent in batches to avoid rate limiting (20 emails per minute)
- For Gmail/Outlook, use an app password or provider-approved SMTP credentials; for ImprovMX, use your alias + generated SMTP password

## Troubleshooting

If you encounter any issues with authentication or sending emails, double-check the SMTP username/password you entered in the UI (for Gmail/Outlook, this is typically an app password).

## TO DO'S
- Enable document files attachement feature
- Any other idea to improve that i will have 👌😊




## Contributing

Feel free to submit issues or pull requests if you have suggestions for improvements or find any bugs.

## License

This project is open-source and available under the MIT License.
