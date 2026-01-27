This repository is a Next.js 14 app (app router) for sending emails using Editor.js content. The instructions below give focused, actionable guidance for AI coding assistants to be immediately productive.

1. Project overview
- Framework: Next.js (app router). Entry pages are under `src/app/` (e.g., `src/app/page.tsx`, `src/app/layout.tsx`).
- Purpose: UI to compose Editor.js content and an API route that sends personalized emails to lists of recipients using SMTP providers.
- Key backend: `src/app/api/sendEmails/route.ts` — converts Editor.js JSON to HTML, builds attachments from image blocks, and streams progress via a ReadableStream.

2. Important files & patterns
- `src/app/api/sendEmails/route.ts`: single server-side handler — it accepts `senderEmail`, `senderPassword`, `recipients`, `subject`, `text` (Editor.js JSON), `emailProvider`, and `useGreeting`. When changing sending behavior, modify this file.
- `src/utils/editorjsParser.ts`: conversion helper used to turn Editor.js `OutputData` into HTML. Use this when altering content rendering.
- `src/components/*` and `src/components/ui/*`: design system components (Tailwind + primitives). Follow existing component patterns (props, forwarding refs).
- `.env.local`: local secrets live here (example: `EMAIL`, `EMAIL_PASSWORD`). Avoid committing secrets.

3. Runtime & developer workflows
- Start dev server: `npm run dev` (Next.js). Build: `npm run build`. Run production locally: `npm run start`.
- Tests: none present. Use `npm test` if you add tests; follow repo's TypeScript setup in `tsconfig.json`.
- Environment: place SMTP credentials in `.env.local` for local testing. The API currently expects explicit `senderEmail`/`senderPassword` from the frontend payload — update either the UI or the API if you want to use `.env.local` instead.

4. Conventions and patterns
- Editor.js flow: frontend sends Editor.js `OutputData` as a JSON `text` field. The API parses it with `JSON.parse(text)` and converts to HTML with `convertToHtml(editorData)`.
- Attachments: image blocks are expected to include `block.data.file.url` as a base64 data URL; the API extracts the base64 payload and sets `encoding: 'base64'` plus `cid` from `block.id`.
- Provider mapping: SMTP host is chosen from `emailProvider` in `route.ts` (currently supports `gmail`, `outlook`, `improvemx`). If adding providers, update the union type and host mapping.
- Throttling/retries: the API enforces a 3-second delay between sends, and waits 1 minute after every 20 emails. Retries are attempted up to `MAX_RETRIES` (3). Respect and reuse these constants when modifying sending behavior.

5. Integration points & external dependencies
- SMTP via `nodemailer` in `src/app/api/sendEmails/route.ts`.
- Editor.js content conversion via `src/utils/editorjsParser.ts` and `src/utils/imageUploadAdapter.ts` for uploads.
- UI components and Tailwind config are in `src/components` and `tailwind.config.ts`.

6. Security & secrets
- Credentials: the API accepts `senderPassword` from the request body. Avoid storing raw passwords in the client; prefer server-side secrets (`.env.local`) or use OAuth/secure app-passwords for providers that support them.
- ImprovMX: when using ImprovMX, the SMTP username is the alias (example shown in ImprovMX UI) and password is the generated SMTP password. The SMTP host used is `smtp.improvmx.com` on port 587 (TLS).

7. Suggested quick tasks for contributors
- Add provider-specific settings UI: update the frontend to show provider-specific helper text (e.g., ImprovMX alias/password). See `src/components/AppPasswordInfo.tsx` for example component patterns.
- Make sending configurable via environment variables: allow falling back to `.env.local` values in `route.ts` when `senderEmail`/`senderPassword` are not provided.
- Add tests around `editorjsParser` conversion output.

8. When editing code, note these examples
- To add a new SMTP provider: update the union type for `emailProvider` in `src/app/api/sendEmails/route.ts`, add host mapping, and add UI option.
- To change throttling: edit the delay logic in `route.ts` (search for `3000` and `60000`).

9. If uncertain, open these files first
- `src/app/api/sendEmails/route.ts`
- `src/utils/editorjsParser.ts`
- `src/components/AppPasswordInfo.tsx`

If you want, I can expand this into a longer `AGENT.md` with examples of typical code edits (adding providers, changing attachment handling, and testing conversion output). Feedback? Any missing areas you want captured?