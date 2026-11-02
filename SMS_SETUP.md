# SMS operation and deployment

The local UniSMS sender is `BrgyStaRita`. On November 2, 2026, all 13 labeled
template-test messages were accepted by UniSMS and receipt was confirmed by the
test phone owner. This verifies the message texts and provider connection;
production deployment and automatic workflow verification are separate steps.

## Production activation

1. Deploy the code changes, including `vercel.json` and the pnpm lockfile.
2. In Vercel Production environment variables, configure `UNISMS_API_KEY`,
   `UNISMS_SENDER_ID=BrgyStaRita`, `SMS_OTP_SECRET`, Supabase credentials, and
   `SMS_DEV_MODE=false`. Keep secrets out of Git and chat.
3. Add `CRON_SECRET` as a secret. A random value was generated in local
   `.env.local`; copy that value through the Vercel dashboard. Redeploy after
   changing environment variables. Vercel passes this value as a Bearer token.
4. Check Vercel Cron Jobs after deployment. Eligibility reminders are scheduled
   daily at 01:00 UTC (09:00 Philippine time), and ID reminders at 02:00 UTC
   (10:00 Philippine time). The hosting plan may vary exact invocation time.
   Local development does not run these schedules automatically.
5. Check `sms_logs` for provider acceptance and errors. The legacy `sent` status
   records provider acceptance, not handset delivery. No delivery webhook is
   implemented. Do not manually rerun an entire job while it is already running.

## Workflow behavior

- Signup OTP: five-minute validity, rate limits and attempt limits. Local dev
  simulation never means a text was delivered.
- Account approval: status notification. Incomplete accounts get a resubmission
  code. Notification failures are displayed separately from the saved decision.
- Assistance: approval, incomplete, actual resubmission, and release have
  notifications. Re-saving an unchanged staff status does not resend it.
- Eligibility: checks the latest release cooldown and excludes beneficiaries
  with active/incomplete requests or restricted ID status. Successful reminder
  logs suppress repeats; failed sends may retry on the next daily run.
- ID renewal: approval/incomplete notifications plus 30-day, seven-day, and
  expired reminder windows. A missed day can catch up within its window.
- Verified email registration retains email notifications. SMS requires a
  verified mobile number. Staff-recorded unverified walk-in numbers remain
  blocked pending the owner's policy decision; no verification flags were
  fabricated or backfilled.

## Repeatable checks

Run `pnpm test` and `pnpm build`. Notification tests use mocks and send no texts.

Preview the 13 message scenarios without sending:

```powershell
node scripts/test-sms-templates.mjs
```

Only with the recipient's permission, send the labeled test set (uses credits):

```powershell
node scripts/test-sms-templates.mjs --send YOUR_11_DIGIT_TEST_NUMBER
```

Do not test by approving/releasing real beneficiary requests solely to trigger
notifications. Provider acceptance is not proof of delivery; confirm receipt.
