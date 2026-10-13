# ALAGA Production Readiness Checklist

Last reviewed: October 13, 2026

Legend: `[x]` verified locally, `[ ]` still required, `[!]` release blocker.

## Current release decision

- [!] **Do not publish real resident data yet.** The live Supabase screenshot shows sensitive tables marked `UNRESTRICTED` / `RLS disabled`.
- [!] **Do not treat current Cloudinary ID and selfie URLs as private.** The application currently uploads with Cloudinary's default public `upload` delivery type.
- [x] The hardened application builds successfully locally.
- [x] The public home and login pages currently return HTTP 200.
- [x] A basic live check measured about 0.24 seconds to first response for the home and login pages.
- [ ] The hardened build has not been deployed. The live `/api/health` endpoint currently returns 404 and the live response does not yet contain the new Content Security Policy.

## 1. Back up before changing production

- [ ] Export the Supabase database and keep the export outside the application repository.
- [ ] Record the current Vercel deployment ID so it can be promoted again as a rollback.
- [ ] Export or inventory Cloudinary assets and their database references.
- [ ] Test restoring a database export into a separate Supabase project at least once.
- [ ] Never paste service-role, Cloudinary, SMS, or email secrets into chat, source code, screenshots, or Git.

## 2. Vercel environment

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`. This key may be present in the browser; RLS must protect the data behind it.
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret. Never prefix it with `NEXT_PUBLIC_`.
- [ ] Set `CLOUDINARY_URL`, or all three server-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` values.
- [ ] Set strong, unique values for session, QR, resubmission-token, and upload-token secrets used by the project.
- [ ] Configure real SMS/email provider credentials for production; ensure development SMS mode is off.
- [ ] Confirm Production, Preview, and Development scopes deliberately. Do not automatically expose production secrets to Preview deployments.
- [ ] Rotate any secret that has appeared in Git history, logs, screenshots, or client-side code.

## 3. Deploy application code first

- [x] Dependency audit has no known high or critical findings. Two unresolved lower-severity transitive findings remain because patched compatible releases are not currently available.
- [x] Upload authorization, 10 MB limits, extension checks, and file-signature validation are implemented locally.
- [x] Beneficiary profile access is moved behind a cookie-authenticated server endpoint.
- [x] Persistent beneficiary-login rate limiting is implemented with a temporary in-memory fallback until the database migration is applied.
- [x] Security headers and a Content Security Policy are configured locally.
- [x] `pnpm lint`, `pnpm test`, and `pnpm build` have passed locally.
- [ ] Deploy the hardened commit to a Vercel Preview environment.
- [ ] In Preview, test admin login, beneficiary login, signup/OTP, account approval, assistance submission, document upload/view, renewal, reports, logout, and expired sessions.
- [ ] Promote the tested deployment to Production.
- [ ] Confirm `GET /api/health` returns HTTP 200 and does not reveal secrets.
- [ ] Confirm the production response contains `Content-Security-Policy`, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, and the expected `Permissions-Policy`.

## 4. Apply Supabase RLS immediately after the code deploy

- [!] In Supabase SQL Editor, run `setup-step29-production-security-hardening.sql` as one transaction.
- [ ] Do not merely click **Enable RLS** table by table; enabling RLS without the matching policies can break application access.
- [ ] Confirm RLS is enabled on at least `users`, `residents`, `account_requests`, `assistance_requests`, and `beneficiary_login_rate_limits`.
- [ ] Inspect every other table containing personal, OTP, logging, ID-card, or operational data, including `sms_otps`, `sms_logs`, `beneficiary_cards`, `beneficiary_id_renewal_requests`, and `control_number_counters`.
- [ ] Remove broad policies such as `USING (true)` or unrestricted anonymous/authenticated writes unless they are explicitly required and safe.
- [ ] Confirm anonymous REST queries cannot list residents, staff, account requests, assistance requests, OTPs, or logs.
- [ ] Confirm an active coordinator can read only the sector records they are authorized to see.
- [ ] Confirm only an active admin can read the complete staff directory.
- [ ] Confirm all privileged writes pass through authenticated server routes using the service role.
- [ ] Re-run the full signup, login, approval, request, document, and reporting smoke test after RLS is active.

## 5. Make Cloudinary identity media private

- [!] Change sensitive uploads (IDs, selfies, medical/supporting documents) from the default `upload` delivery type to `authenticated`.
- [!] Change `/api/documents/view` so it authorizes the requesting user and returns a short-lived signed Cloudinary URL instead of redirecting to the stored public URL.
- [ ] Store enough metadata for secure delivery and deletion: `public_id`, `resource_type`, `delivery_type`, format, bytes, and upload timestamp. A bare URL is not sufficient lifecycle metadata.
- [ ] Generate document URLs only on the server. Never expose the Cloudinary API secret to the browser.
- [ ] Set `X-Robots-Tag: noindex` for sensitive assets where supported.
- [ ] Disable unsigned upload presets unless a specific constrained client upload flow requires one.
- [ ] Restrict allowed formats and maximum bytes in both application code and Cloudinary settings.
- [ ] Define deletion rules for rejected, abandoned, replaced, and expired documents.
- [ ] Migrate the existing 323 assets: change/re-upload them as authenticated assets, update database references, verify access, then remove the public originals.
- [ ] Test that copying a raw Cloudinary URL into a logged-out/private browser fails.
- [ ] Test that an authorized admin can open a document and that the signed URL expires.

## 6. Speed and user experience

- [x] Basic live server response is currently fast (about 0.24 seconds in one external check); this is not a full browser performance test.
- [ ] Run Lighthouse on mobile for home, login, signup, admin dashboard, and beneficiary dashboard.
- [ ] Set release targets: LCP under 2.5 s, INP under 200 ms, and CLS under 0.1 at the 75th percentile.
- [ ] Verify large face-recognition libraries are loaded only on pages that need them.
- [ ] Use Cloudinary size, crop, quality, and modern-format transformations for non-sensitive display images.
- [ ] Paginate large resident/request tables and avoid selecting unused columns.
- [ ] Add indexes for production query filters and confirm slow queries in Supabase Query Performance.
- [ ] Test on a low-end Android phone and a slow mobile connection.

## 7. Traffic and abuse readiness

- [ ] Do not load-test Production without an agreed traffic limit and maintenance window; use Preview/staging with test data.
- [ ] Test 10, 25, 50, then 100 concurrent users in staging while watching error rate and latency.
- [ ] Rate-limit login, OTP request/verification, signup, resubmission, uploads, and public statistics endpoints.
- [ ] Cap upload count and total bytes per account and per IP/time window.
- [ ] Confirm OTPs expire, are single-use, are stored safely, and cannot be enumerated through error messages.
- [ ] Set usage/billing alerts for Vercel, Supabase database/API/egress/realtime, Cloudinary storage/bandwidth/transformations, SMS, and email.
- [ ] Document expected daily and peak users, uploads, SMS messages, and reports so plan limits can be checked before launch.

## 8. Survival, monitoring, and recovery

- [ ] Add uptime monitoring for `/api/health` and the login page from outside Vercel.
- [ ] Add server error tracking with PII redaction. Never log ID images, OTPs, passwords, tokens, or complete resident records.
- [ ] Alert on repeated login failures, OTP spikes, upload spikes, 5xx errors, and database/storage quota thresholds.
- [ ] Assign an incident owner and keep a short contact/escalation list.
- [ ] Write rollback steps for Vercel, Supabase SQL, and Cloudinary asset migration.
- [ ] Define retention periods for applications, IDs/selfies, assistance documents, OTPs, and audit logs.
- [ ] Schedule backup verification and a restore drill.
- [ ] Keep a maintenance banner or status communication plan for outages.

## 9. Final go-live gate

- [ ] No sensitive Supabase table is shown as `UNRESTRICTED`.
- [ ] A logged-out browser cannot fetch sensitive database rows or Cloudinary assets.
- [ ] Preview and Production smoke tests pass.
- [ ] Health monitoring and alerts are active.
- [ ] A rollback and a verified backup exist.
- [ ] The release owner signs off before real resident data is accepted.

