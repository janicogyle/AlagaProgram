# ALAGA project review and checklist

Reviewed October 15, 2026. Scope: local source, SQL migrations, CI configuration, tests, lint and production build. This is a code-based review, not a complete penetration test or a live production certification. No production database, assets, messages or deployments were modified. Existing production checklist observations from October 13 were not independently reverified.

**Assessment:** The system has substantial functional coverage and sensible domain modeling. The next milestone should be privacy and workflow reliability before adding more features or accepting real identity documents.

## Verification performed

- [x] All 29 existing Node tests passed: activity logs/PDF generation, OCR parsing, eligibility and sector access.
- [x] `pnpm lint` completed: 0 errors, 18 warnings, including hook dependency, image and navigation warnings.
- [x] `pnpm build` passed. One warning: the configurable face-model filesystem path traces the whole project into server output.
- [x] CI exists and runs frozen dependency installation, tests, lint, build and a production dependency audit.
- [ ] Live database RLS/policies, deployed version, private asset delivery, provider delivery, backups and monitoring remain unverified.
- [ ] Authenticated browser workflows, accessibility, load testing and API integration tests were not run in this review.

Passing these local checks does not cover the security and workflow findings below. The audit command in CI was inspected, not independently run today.

## Fix before a real-data launch

### 1. OTP verification can reissue authorization without validating the code — confirmed code defect

- [ ] Remove the early success path based only on `verified_at`.
- [ ] Validate expiry and code before issuing upload authorization, or require an existing, valid client-bound verification credential.
- [ ] Make attempt increments and verification/consumption transitions atomic.
- [ ] Add tests for wrong codes after previous verification, expired-but-verified codes, replay and parallel attempts.

Evidence: `app/api/sms/otp/verify/route.js:70` returns success and a fresh signup upload token before expiry checking at line 81 and hash comparison at line 89. This is reachable for an existing verified, unconsumed OTP, subject to the earlier signup contact availability check. A six-digit input passes format validation even when it is not the original code. The route reads and writes attempt counts separately, so parallel failures can undercount attempts. Completion: these cases fail appropriately and concurrent attempts cannot bypass the configured attempt limit.

### 2. Identity documents need private delivery and document-level authorization — confirmed code gap

- [ ] Upload sensitive IDs, selfies and supporting documents using authenticated delivery.
- [ ] Resolve documents by a stored document/record ID; verify ownership and permitted sector before delivery.
- [ ] Use expiring access through an appropriate signed download/token mechanism; do not assume every signed URL expires.
- [ ] Retain asset metadata and migrate/remove existing public originals after verifying references.

Evidence: `lib/cloudinary.server.js:85` uploads without an authenticated delivery type; `app/api/documents/view/route.js` accepts a supplied URL after checking only staff authentication and URL shape. It does not load the owning beneficiary or apply sector authorization. Cloudinary documents the default upload delivery and authenticated alternative in its [upload documentation](https://cloudinary.com/documentation/upload_parameters); expiration options are described in [media access control](https://cloudinary.com/documentation/control_access_to_media). Completion: logged-out access and wrong-sector access fail, while the correct staff member can view the file and expiring access actually expires.

### 3. Document URL validation is a substring check — confirmed code defect

- [ ] Parse URLs and require HTTPS, an exact allowed hostname, the configured cloud account and a stored asset belonging to the current flow.
- [ ] Validate redirect destinations or disallow redirects when the server retrieves media.
- [ ] Bound media download duration and bytes; protect expensive face/OCR endpoints with verified signup authorization and shared rate limits.

Evidence: `lib/cloudinary.server.js:118` accepts any string containing `res.cloudinary.com`. `lib/documentUrls.server.js` reuses this check; the face verification route passes validated URLs to `lib/faceVerification.server.js:57`, which fetches them. A different host with that text in its path can pass the check. This creates a server-side request-forgery risk; no internal-network exploitation was attempted. The face endpoint also allows the initial signup path without a resubmission token and has no route-level rate limit. Completion: lookalike URLs and arbitrary assets are rejected before retrieval, and time/size/request limits are tested.

### 4. Prove database protections are deployed — deployment verification required

- [ ] Verify the live schema has the intended migrations, especially steps 27–32.
- [ ] Test anonymous, beneficiary, coordinator, inactive staff and admin access separately.
- [ ] Verify protection of OTPs, logs, cards and operational tables as well as residents and requests.

Evidence: hardening migrations are present, but their existence does not prove they ran. `PRODUCTION_READINESS_CHECKLIST.md` records older RLS concerns. Treat those as outstanding verification, not a fresh observation. Server routes using service-role credentials must independently enforce authorization because that role bypasses RLS, as [Supabase documents](https://supabase.com/docs/guides/database/postgres/row-level-security). Completion: negative permission tests pass against a staging deployment with the same schema and policies as production.

### 5. Enforce the assistance workflow on the server — confirmed code gap

- [ ] Define permitted transitions, such as Pending → Approved → Released, including a documented correction flow.
- [ ] Reject direct Pending → Released and reopening a Released request unless explicitly authorized by the correction policy.
- [ ] Enforce required evidence/checklist completion and the release actor's permissions server-side.
- [ ] Add transition and concurrent-update integration tests.

Evidence: `app/api/assistance-requests/[id]/route.js:200` validates membership in an allowed status set, but not the previous-to-next transition. It records checklist values without making them a prerequisite for approval/release. A release timestamp can be overwritten after reopening and releasing again, affecting the cooldown. The existing status comparison reduces some concurrent overwrites, but does not validate the business transition. No transition-enforcing SQL trigger was found in the checked migrations.

### 6. Fix asynchronous route parameters — confirmed compatibility defect

- [ ] Await `params` in staff assistance PATCH/DELETE and beneficiary assistance PATCH.
- [ ] Test valid URL IDs without duplicated IDs in request bodies.

Evidence: `app/api/assistance-requests/[id]/route.js:174` and `:435`, and `app/api/beneficiary/assistance-requests/[id]/route.js:48`, read `params?.id` synchronously. The installed project targets Next.js 16, whose [route context uses promised params](https://nextjs.org/docs/app/api-reference/file-conventions/route). Body fallbacks can mask this in PATCH; DELETE depends on the URL ID. Compilation alone does not verify this runtime behavior.

## Next reliability milestone

- [ ] **Add API and browser integration coverage.** Exercise signup → verification → staff approval → beneficiary login → assistance → release → cooldown, plus resubmission, renewal, password reset and wrong-sector attempts. The current 29 tests cover useful helpers, not these complete flows.
- [ ] **Guarantee audit recording for important mutations.** `lib/activityLogger.server.js` returns failure without requiring the business change to fail. Use transactional audit writes or a durable retry mechanism for approvals, releases and account/security changes. Completion: simulated log failures cannot silently erase accountability.
- [ ] **Make notification delivery recoverable.** Status updates call providers after saving the decision. Add a durable outbox with retry, deduplication and visible delivery status. Completion: provider outages preserve the saved decision and messages are delivered once after recovery.
- [ ] **Support immediate beneficiary session revocation.** Password reset updates the hash, while the signed beneficiary session identifies the resident and can remain valid for up to eight hours. Add a server-checked session version or revocation mechanism. Completion: a pre-reset session cannot continue accessing protected endpoints.
- [ ] **Make schema versions explicit.** Many SQL files require manual execution, and some routes strip missing columns and retry. Add ordered migration tracking and a release schema check; required release timestamps/security fields should not be silently omitted.
- [ ] **Verify recovery and operations.** Demonstrate a database restore, document asset recovery, rollback, external uptime alerts and provider quota alerts. `/api/health` exists, but a route alone is not monitoring.
- [ ] **Document document retention and deletion.** Define cleanup for abandoned signup uploads, replaced IDs and rejected applications, with an accountable owner and tested deletion process.

## Improvements after blockers

- [ ] Split the large signup/resident pages into focused form, validation and data-access modules. Preserve behavior with workflow tests first.
- [ ] Address the 18 lint warnings, especially hook dependencies that can retain stale state.
- [ ] Scope the face-model filesystem path so builds do not trace the whole project; inspect deployment size and cold-start behavior.
- [ ] Run keyboard, screen-reader, low-end Android and slow-network checks. Pagination exists in the residents API; verify all high-volume screens actually use bounded queries.
- [ ] Keep face matching as review assistance and measure false rejection cases. Do not treat photo similarity as demonstrated liveness or definitive identity proof; preserve a practical assisted/manual review path.
- [ ] Decide whether assistance amounts are merely per-request ceilings or whether the system must manage a total funding pool. If total allocation is required, define reservations, release accounting and reconciliation before implementing it.
- [ ] Decide whether approval and release require different staff members. Implement that separation only if it matches the actual office process.

## Your strongest system decisions

1. **Primary-sector authorization separated from secondary-sector classification.** This keeps overlapping beneficiary identities from automatically granting broader coordinator access. `lib/sectorAccess.js`, its tests and step 31 make this policy explicit. Preserve it and extend it to documents.
2. **Database-enforced concurrency protection.** Step 27 includes atomic number allocation and uniqueness constraints; step 30 enforces one active request per resident across categories. These protect against simultaneous staff actions across multiple servers, beyond what a disabled button can do.
3. **Shared eligibility rules for online and walk-in assistance.** `lib/residentEligibility.js` and `lib/assistanceEligibility.server.js` centralize blocking and cooldown behavior. Using the release date for the cooldown matches actual assistance delivery more closely than submission date.
4. **Separate permanent beneficiary and request reference numbers.** Stable beneficiary identity and distinct transaction references make repeat assistance histories easier to follow.
5. **Layered identity review with a manual-review outcome.** OCR, face comparison and staff review are represented separately. That is a useful foundation for handling imperfect documents without making an automated score the only decision-maker.
6. **Shared authentication and upload-validation helpers.** Active staff role checks, signed beneficiary sessions, password hashing, file-size limits and content-signature checks are centralized. Strengthen the identified gaps within these shared helpers.
7. **Verified notification channels and full service lifecycle.** Email/SMS verification, account resubmission, assistance history, ID renewal and activity logs address real office workflows beyond basic record creation.
8. **Existing engineering checks.** Unit tests, CI, a production build, readiness documentation and a health endpoint already exist. Build on them with failure-path and integration coverage.

## Recommended sequence

First fix OTP authorization, URL validation and private document access. Next enforce assistance transitions and correct route parameters. Then verify database policies and migrations, run complete staging workflows and perform a restore drill. Add broader features only after these checks pass. Keep the current stack for this work; the findings point to implementation and operational gaps rather than a demonstrated need to rewrite the system.
