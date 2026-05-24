This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment variables (Supabase)

Create a `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-side only (do NOT prefix with NEXT_PUBLIC)

# QR Beneficiary ID (server-side only)
QR_CARD_SECRET=...              # used to sign/verify beneficiary ID QR tokens
BENEFICIARY_SESSION_SECRET=...  # used for beneficiary session cookie (optional; falls back to QR_CARD_SECRET)

# SMS (UniSMS) — https://unismsapi.com/register
UNISMS_API_KEY=...               # API **Secret** key (Basic Auth username, password empty)
UNISMS_SENDER_ID=...             # optional (approved Sender ID only)
UNISMS_API_URL=...               # optional (defaults to https://unismsapi.com/api)
SMS_OTP_SECRET=...               # used to hash OTP codes (required)
SMS_DEV_MODE=false               # set true locally to print OTP in server console (no SMS credits)
SMS_CRON_SECRET=...              # used to authorize the eligibility reminder cron

# Cloudinary (document / Valid ID image storage)
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
# Or set separately:
# CLOUDINARY_CLOUD_NAME=...
# CLOUDINARY_API_KEY=...
# CLOUDINARY_API_SECRET=...
```

If deploying to Vercel, add these in **Project Settings → Environment Variables** (enable for **Production** and **Preview**, then **Redeploy**):

| Variable | Required on Vercel |
|----------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (signup OTP, admin actions) |
| `CLOUDINARY_URL` | Yes (Valid ID uploads) |
| `UNISMS_API_KEY` | Yes (SMS OTP on signup) |
| `SMS_OTP_SECRET` | Yes (OTP hashing) |
| `QR_CARD_SECRET` or `BENEFICIARY_SESSION_SECRET` | Yes (beneficiary sessions / QR) |
| `UNISMS_SENDER_ID` | Optional |
| `SMS_DEV_MODE` | **Do not** set `true` on Vercel (local only) |

Without `UNISMS_API_KEY` and `SMS_OTP_SECRET`, signup Step 4 shows “SMS is not configured”. `.env.local` is **not** uploaded to Vercel — copy values manually into the dashboard.

### Database

To enable QR ID cards, run `setup-step5.sql` in the Supabase SQL Editor (creates `public.beneficiary_cards`).
To enable SMS OTPs and logs, run `setup-step6.sql` in the Supabase SQL Editor (creates `public.sms_otps` and `public.sms_logs`).
To remove legacy Supabase document storage, run `setup-step7.sql` after migrating uploads to Cloudinary.
To enable per-assistance-type request control numbers (`YYYY-###`) and permanent beneficiary numbers (`BENEF-###`), run `setup-step8.sql`.
If existing beneficiaries still show `2026-001` instead of `BENEF-001`, run `setup-step9.sql` to migrate resident control numbers (assistance requests stay `2026-###`).
If registration saves fail with missing requirements verification, run `setup-step10.sql` to add the verification columns and refresh the Supabase schema cache.

### SMS (UniSMS OTP)

1. Register at [UniSMS](https://unismsapi.com/register) and add credits.
2. Copy your **API Secret** from the dashboard (not the placeholder `your_new_secret`).
3. Set in `.env.local`: `UNISMS_API_KEY=your_actual_secret`
4. Restart `pnpm dev`.

**Local testing without sending real SMS:** set `SMS_DEV_MODE=true`. The OTP is printed in the terminal when you click **Send OTP** (signup Step 4).

**Troubleshooting:** `401 Unauthorized` means `UNISMS_API_KEY` is wrong or still a placeholder. Check `sms_logs` in Supabase for failed send details.

**Automatic status SMS** (sent immediately after admin/staff updates status):

| Action | SMS |
|--------|-----|
| Account approved | Login approval message |
| Account rejected | Rejection + missing requirements (from admin notes) |
| Assistance approved | Approval message |
| Assistance rejected / incomplete | Missing documents + resubmit instruction |
| Assistance resubmission required | Resubmission message (status `Resubmitted`) |

Terminal logs use `[SMS]` prefix (e.g. `[SMS] account_approved sent to 639151234567`).

### Cloudinary (Valid ID & requirement uploads)

Valid IDs and assistance requirement files are uploaded to **Cloudinary only** — not Supabase Storage. The database stores Cloudinary HTTPS URLs (`https://res.cloudinary.com/...`).

Get your credentials from the [Cloudinary Console](https://console.cloudinary.com/) → API Keys. Use the connection URL format:

`cloudinary://<api_key>:<api_secret>@<cloud_name>`

Admin/Staff open uploaded documents via `/api/documents/view` (Cloudinary URLs only).

**Remove legacy Supabase Storage files** (one-time):

1. Optional: `node scripts/clear-supabase-storage.mjs` (empties `documents` / `document` buckets via API)
2. Run `setup-step7.sql` in the Supabase SQL Editor (deletes storage objects, drops policies/buckets, clears legacy DB paths)

First, run the development server (this repo enforces **pnpm**):

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
