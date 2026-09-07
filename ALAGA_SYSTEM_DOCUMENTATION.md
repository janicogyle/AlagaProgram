# ALAGA Program — Complete System Documentation and Audit

Audit scope: the current repository implementation, including frontend pages, API routes, authentication, database scripts, storage, QR handling, notifications, reports, configuration, and deployment support. This report distinguishes implemented behavior from UI-only, partial, and absent behavior. No production database or external-service state was assumed.

# 1. SYSTEM OVERVIEW

The ALAGA Program is a web-based barangay social-assistance management system for Persons with Disability (PWD), Senior Citizens, and Solo Parents of Barangay Sta. Rita, Olongapo City. It centralizes beneficiary registration, account approval, identification, assistance applications, supporting documents, eligibility tracking, notifications, and reports.

Intended users are barangay administrators, PWD/Senior Citizen/Solo Parent coordinators, legacy staff, beneficiaries, and authorized representatives.

Actual roles are `Admin`, `PWD Coordinator`, `Senior Citizen Coordinator`, `Solo Parent Coordinator`, legacy `Staff`, `Beneficiary` (represented by a resident record), and `System` (activity-log attribution only).

Main workflows are online beneficiary signup and approval, staff walk-in registration, beneficiary/staff assistance submission, staff processing and release, QR card issuance and verification, beneficiary ID renewal, notification delivery, activity logging, and PDF/Excel reporting.

Beneficiaries directly use the system. Approved beneficiaries can sign in, view a dashboard and history, submit/resubmit assistance requests, view their profile and ID, renew their ID, and view activity. Barangay staff also operate assisted walk-in workflows. Walk-in residents do not automatically receive a password and may need an administrator to set one before using the beneficiary portal.

The project is an advanced functional prototype or pre-production application. Most principal modules exist, but critical API authorization and Supabase RLS weaknesses prevent a production-secure classification. Static verification found 0 ESLint errors and 17 warnings; the only focused automated test file had 17 passing OCR-parser tests. There is no comprehensive integration, E2E, accessibility, load, or security test suite and no CI workflow. The deployed database and external services were not verified.

# 2. TECHNOLOGY STACK

| Technology | Actual use |
|---|---|
| Next.js 16 App Router | Pages, layouts, protected route shells, and HTTP APIs |
| React 19 | Client UI, forms, modals, dashboards, charts, and state |
| JavaScript | Application language; no TypeScript application layer |
| CSS Modules and global CSS | Styling and responsive design; no Tailwind/Bootstrap |
| Custom components | Buttons, inputs, tables, modals, charts, sidebar, notifications, uploads |
| Supabase PostgreSQL | Residents, requests, users, cards, OTPs, logs, budgets, notifications |
| Supabase Auth | Staff password auth, Google OAuth, signup email OTP |
| Custom beneficiary auth | Contact/password, scrypt hash, signed cookie |
| Next.js route handlers | Server application and integration layer |
| Cloudinary | Current file/image/document storage |
| `qrcode` | Browser-side QR PNG generation |
| `@zxing/browser` | Camera QR scanning |
| UniSMS | OTP, status, and reminder SMS |
| Resend | Transactional status email |
| OCR.Space | Philippine ID OCR |
| face-api/TensorFlow.js/canvas | Server-side face comparison and image analysis |
| ExcelJS | Server-generated XLSX reports |
| jsPDF/AutoTable | Browser-generated PDF reports |
| `next-pwa` | Production service worker and installable PWA shell |
| Vercel | Intended deployment; active deployment is not proven |
| Git/GitHub | Source control; GitHub `origin` exists |
| pnpm | Declared package manager |

No Redux/Zustand-style state manager exists. State uses React hooks, local/session storage, a small cache utility, and Supabase Realtime.

# 3. PROJECT ARCHITECTURE

Major folders:

- `app/`: public, staff, beneficiary pages and API routes
- `components/`: reusable UI components
- `lib/`: auth, database, QR, validation, notifications, OCR, face, and utilities
- `public/`: images, PWA assets, and face model files
- `scripts/`: setup, cleanup, seed, migration, deployment helpers
- Root SQL files: intended schema and sequential manual migrations

Many pages are client components because they contain multi-step forms, browser Supabase calls, realtime subscriptions, filters, and modals. Server behavior is implemented under `app/api/**/route.js`; no Server Actions architecture is used.

Two database clients exist: a browser Supabase client using the anon key and a server admin client using the service-role key. Some pages use protected APIs while others query Supabase directly, producing inconsistent authorization.

```text
Staff
  -> Supabase Auth password login
  -> public.users profile check
  -> signed admin_session cookie
  -> protected /admin layout
  -> API calls with Supabase bearer token

Beneficiary
  -> contact/password or verified Google email
  -> resident lookup
  -> signed beneficiary_session cookie
  -> protected /beneficiary layout

Browser upload
  -> Next.js API
  -> MIME validation
  -> Cloudinary
  -> public HTTPS URL stored in PostgreSQL

Staff camera
  -> ZXing scanner
  -> card reference
  -> authenticated verification API
  -> beneficiary/card/assistance data
```

External integrations are Supabase Auth/Database/Realtime, Cloudinary, UniSMS, Resend, and OCR.Space. There is no `middleware.js`; page layouts and individual API routes implement protection. `next-pwa` caches the application shell/assets, but there is no offline database queue or synchronization.

# 4. USER ROLES AND ACCESS CONTROL

| Role | Visible modules/actions | Restrictions |
|---|---|---|
| Admin | All staff modules; users, budgets, residents, accounts, renewals, cards, assistance, reports | No intentional sector restriction |
| PWD Coordinator | Dashboard, registration, beneficiaries, QR, assistance, guidelines, reports | Intended PWD-only access |
| Senior Citizen Coordinator | Same operational modules | Intended Senior-only access |
| Solo Parent Coordinator | Same operational modules | Intended Solo Parent-only access |
| Legacy Staff | Operational modules based on `sector_access` | Cannot be newly created in current UI |
| Beneficiary | Dashboard, services, history, profile, renewal | No administrative permissions |
| System | No UI/login | Log actor only |

Staff bearer validation, active status, role checks, and most sector filters are server-side. Admin-only navigation is also hidden client-side. User management, budget mutation, and resident mutation use Admin-only APIs.

Important discrepancies:

1. Account-request and renewal APIs accept all portal roles with sector filtering although their pages are hidden from coordinators.
2. Staff registration writes through the browser Supabase client. Supplied RLS grants authenticated users broad resident access, allowing coordinator bypass of application sector rules.
3. Supplied `users` RLS allows authenticated management, potentially bypassing Admin-only APIs.
4. Supplied `account_requests` RLS permits public selection, much weaker than the protected application API.
5. Application role checks cannot compensate for permissive direct Supabase RLS.

# 5. AUTHENTICATION MODULE

Staff login uses Supabase Auth email/password, then `/api/admin/profile` validates the `public.users` profile and updates `last_login`. `/api/admin/session` creates an HMAC-signed, HttpOnly, eight-hour `admin_session` cookie (`Secure` in production, `SameSite=Lax`). The server layout validates the cookie and `AdminShell` revalidates the Supabase browser session/profile.

Beneficiary login normalizes an 11-digit Philippine contact number, retrieves the resident, verifies an scrypt hash with timing-safe comparison, and creates an eight-hour signed `beneficiary_session` cookie. Hashing uses random 16-byte salt and optional `PASSWORD_PEPPER`.

Google OAuth uses Supabase Auth and maps a verified email to an approved resident before creating the custom beneficiary cookie. It is not used for staff login in the inspected UI.

Online registration is a six-step flow: beneficiary type, personal details, address/contact verification, identity verification, account setup, and review/consent. It supports SMS OTP or Supabase email OTP. ID front/back, OCR confirmation, selfie/face processing, and password are required. Approval creates the resident and a one-year card.

Incomplete signup uses a hashed eight-character resubmission code delivered by SMS/email. There is no Remember Me option and session lifetime is fixed. There is no beneficiary self-service forgot-password flow. Admin can reset beneficiary and staff passwords; generated staff reset passwords are only six characters and should be strengthened.

Beneficiary login throttling is in-memory: five contact failures or twenty IP failures per 15 minutes, with a 15-minute lockout. It is not distributed or persistent and is unreliable across serverless instances/restarts.

# 6. DASHBOARD MODULE

The staff dashboard shows Total Beneficiaries, New Registrations, Active Requests, Released Assistance count, recent account requests, recent approved residents, Admin-only staff activity, and registration/sector/sex/age/purok charts. Filters cover 30/90/180/365 days, trend year, and month. Data comes from `/api/admin/analytics` and Supabase, not hard-coded data when the API succeeds.

Limitations: `previous` and `growth` are always zero; New Registrations is period-sensitive but total and request metrics are not consistently period-filtered. Fallback state is zero-filled. Realtime subscriptions refresh selected data when residents, account requests, or assistance requests change.

The beneficiary dashboard shows total, active, completed, and incomplete requests, latest/recent requests, and ID status. It uses the assistance API plus realtime subscriptions.

The notification panel loads once on mount and when opened. It does not continuously poll or subscribe to a notification channel.

# 7. RESIDENT / BENEFICIARY MANAGEMENT

Implemented: add walk-in, create from approved signup, view, Admin edit, Admin password reset, search, server pagination, registration-source/sector/QR filters, client eligibility filter, sorting, released-history view, and card issue/view/renew. Resident delete/archive is not implemented.

Default page size is 25; API maximum is 100. Most filters are server-side, but eligibility filtering is applied to the loaded page, making displayed totals potentially misleading.

Only PWD, Senior Citizen, and Solo Parent sectors are supported. One primary sector is required and one distinct secondary sector is optional. Rules include Senior age 60+, Solo Parent not Married, online minors only as PWD, representative/ID for minor PWD, Filipino citizenship, duplicate contact/email checks, and permanent control number.

Stored fields include:

- Personal: first/middle/last name, birthday, age, birthplace, sex, citizenship, civil status, profile photo
- Contact: contact number, email, verification method, contact/email verified
- Address: house number, purok, street, barangay, city
- Sector: primary, secondary, three sector flags
- Representative: name, contact, relationship, valid-ID URL
- Account/document: generic valid-ID URL, account-request reference, password hash
- Status: Active, Expiring Soon, Expired, Renewal Pending; created/updated timestamps

Not modeled: disability type/cause/severity/device, sector-specific ID numbers, emergency contact, household/income assessment, and national-program identifiers. OCR stores a masked ID number only in the signup record.

# 8. DATABASE STRUCTURE

The intended schema is distributed across a consolidated SQL file and 26 setup scripts. Actual deployed state is not verifiable from code.

| Table | Purpose and important structure |
|---|---|
| `residents` | UUID PK; permanent control number; identity/contact/address/sectors/representative/documents/password/status/timestamps |
| `assistance_requests` | UUID PK; `resident_id` FK; control/type/amount/source/status/requirements/processor/dates |
| `assistance_budgets` | UUID PK; unique assistance type; ceiling; JSON requirements; timestamps |
| `users` | UUID PK/FK to `auth.users`; name/email/contact/role/status/last login/timestamps |
| `account_requests` | UUID PK; KYC, password hash, documents, OCR/face, sectors, resubmission, processing, timestamps |
| `beneficiary_cards` | UUID PK; resident FK; issue/expiry/revocation/status/timestamps |
| `beneficiary_id_renewal_requests` | UUID PK; resident/card FKs; document, remarks, status, processing |
| `notifications` | UUID PK; user FK; title/message/type/read/link/created |
| `activity_logs` | UUID PK; optional user actor/audience FKs; resident IDs; action/entity/reference/created |
| `sms_otps` | UUID PK; contact/purpose/hash/expiry/attempt/verification/consumption |
| `sms_logs` | UUID PK; contact/full message/provider/status/error/reference/created |
| `auth.users` | Supabase-managed identity referenced by `users` |

No application `documents`, `qr_codes`, `programs`, or `events` table exists.

```text
auth.users 1---1 users 1---many notifications/activity_logs
account_requests 0..1---1 residents
residents 1---many assistance_requests
residents 1---many beneficiary_cards
residents 1---many beneficiary_id_renewal_requests
beneficiary_cards 1---many beneficiary_id_renewal_requests
sms tables relate logically by contact/reference, without resident/request FKs
```

Schema concerns: installation is manual; scripts redefine constraints/policies; older/newer status and control rules coexist; the consolidated schema does not independently create every table; APIs silently fall back around missing columns; and assistance uniqueness differs between scripts and runtime expectations.

# 9. QR CODE SYSTEM

A card is issued after online signup approval, manually from the resident page, during direct walk-in renewal, or extended after renewal approval. A card row stores UUID, resident ID, issue/expiry/revocation dates, status, and timestamps.

The actual QR PNG generated by staff and beneficiary pages contains the first eight uppercase characters of the card UUID, e.g. `A1B2C3D4`. It contains no raw name, address, contact, medical, or resident information.

The server also creates an HMAC token containing type, full card ID, and expiry, but the current UI does not encode that token in the QR image. The displayed QR is therefore a card-reference QR, not a cryptographically protected token.

The QR image is created browser-side as a data URL and not stored; only card metadata is stored. Staff can view/download/print the composed ID card. Beneficiaries can view their card. The surrounding card image contains name, sectors, contact/address, dates, photo, and reference and is sensitive even though the QR payload is not.

Scanning uses `@zxing/browser` with a browser camera and device selection. HTTPS/localhost is normally required. Manual reference entry is available. The protected verification API applies staff authentication and sector access, then returns card status, resident profile, released assistance, and latest request/documents.

Cards default to 365 days; manual issue allows 1–3,650. Replacement revokes earlier active cards. Expiring Soon begins within 30 days; beneficiary renewal opens within seven days or after expiry/incomplete renewal. Approved renewal adds one year from the later of current expiry or approval time.

Security implications:

- Positive: QR payload has no raw PII; lookup requires authenticated staff and sector access.
- Eight-character UUID prefixes are not guaranteed unique.
- Manual lookup searches only the latest 100 cards.
- The signed token does not protect the displayed QR.
- Invalid signed tokens are accepted after unsigned payload decoding, defeating token integrity.
- Card revoke/insert is not transactional.
- QR should be described as an authenticated lookup shortcut, not standalone proof of identity.

# 10. ASSISTANCE REQUEST MODULE

Requests are created by beneficiaries or staff. The three accepted types are Medicine (default PHP 500), Confinement (PHP 1,000), and Burial (PHP 1,000). Admin can configure ceilings/requirements. Obsolete `Others` client data is rejected by the API.

Statuses are Pending, Resubmitted, Approved, Released, and Rejected (shown as Incomplete).

Intended workflow: choose resident/type; check active same-category request; check three-month cooldown after last Released request in that category; upload online documents; assign `YYYY-###`; save Pending; staff reviews; approve or mark incomplete; beneficiary corrects/resubmits; staff approves and marks Released; activity/notifications are recorded.

Beneficiaries edit only incomplete/rejected requests. Staff update status, remarks, and checklist. A staff DELETE API permits Pending/Resubmitted deletion, but the main UI does not provide a clear normal delete/cancel action; beneficiaries cannot cancel.

Admin search/filter covers text, status, type, source, sector, sorting. Some filters operate after current-page retrieval and may omit matches on other pages. There is activity logging but no immutable status-transition table. Approved, Incomplete, and Resubmitted can send SMS/email; Released does not.

Critical backend findings:

- Public GET can return all assistance records and personal/document data.
- Any caller can query another resident by `residentId`.
- Online POST requires no beneficiary session and accepts arbitrary resident ID.
- Public POST accepts caller-supplied status, including Approved/Released.
- Positive caller-supplied amount bypasses configured ceiling enforcement.
- Requirements are checked against caller-supplied checklist, so omission can bypass canonical requirements.
- Staff PATCH allows any permitted status without transition rules or approval prerequisites.
- Beneficiary editing accepts caller-controlled resident identity if cookie is missing.

# 11. DOCUMENT MANAGEMENT

End-to-end server formats are PDF, JPG/JPEG, and PNG. OCR accepts images only. The reusable UI advertises DOC/DOCX for “other” files, but server validation rejects them, so DOC/DOCX is not implemented end-to-end.

The browser enforces 5 MB per file. OCR also enforces 5 MB and quality/resolution checks. The generic server upload helper has no file-size limit, so UI bypass can upload larger files.

Cloudinary is current storage; Supabase Storage appears only in legacy cleanup. Database rows store URLs and limited JSON metadata. Assistance metadata may include URL, display name, and requirement label. There is no normalized document table, owner FK, checksum, version, retention, or deletion record.

Staff can preview images/PDFs through a protected view API, but it ultimately returns/redirects to a public Cloudinary URL. Possession of the URL bypasses application auth. Beneficiaries replace incomplete-request files; approved renewal replaces resident valid-ID URL. Old assets are not deleted and no deletion endpoint exists.

Security gaps: declared MIME only, no content sniffing/antivirus, no generic server size limit, public delivery, substring-based Cloudinary URL validation instead of strict hostname parsing, inconsistent ownership binding, and an orphaned staff upload API with no principal UI caller.

# 12. NOTIFICATION SYSTEM

In-app notifications/activity are triggered by assistance submission/resubmission/status changes, signup processing, renewal submission/processing, and staff monitoring. Recipients include staff actors, Admins, portal users for selected events, and beneficiaries through resident-targeted activity logs.

`notifications` has persistent `is_read`. `activity_logs` has no read column; read state is stored in local storage and is device/browser-specific. The panel refreshes on mount/open, not continuously.

UniSMS supports signup OTP, signup approval/incomplete, assistance approval/incomplete/resubmission, renewal approval/incomplete, ID expiry, and eligibility reminders. Released assistance has no external message. OTP is six digits, valid five minutes, has a 60-second resend cooldown, maximum two sends per 15 minutes, and five verification attempts; the stored OTP is hashed.

`sms_logs` stores recipient, full message, provider/status/error, ID, and dedup key. This indicates provider API acceptance, not handset delivery; no delivery webhook exists. `SMS_DEV_MODE` simulates/logs locally. Live service depends on credentials, credits, sender approval, and provider state.

Signup email verification uses Supabase Auth OTP. Transactional status emails use Resend and can be simulated with `EMAIL_DEV_MODE`. No delivery/bounce webhook exists.

Cron routes exist for ID expiry and assistance eligibility reminders and use secret authentication plus log deduplication. No committed scheduler invokes them, so scheduling is partial.

# 13. REPORT GENERATION

Reports: PWD, Senior Citizen, Solo Parent, and All-Sectors released-assistance summaries; eligible beneficiaries; not-yet-eligible beneficiaries; online registrations; walk-in registrations.

Filters are report year plus role/sector access. Released and registration reports use the year; eligibility reports represent current eligibility and are not historical despite the year UI.

Exports are PDF and XLSX only, not CSV. Excel is generated server-side with ExcelJS; PDF data is returned by the server and rendered client-side with jsPDF/AutoTable. Browser download is implemented; printing is possible through the downloaded PDF but no dedicated print workflow exists.

Admin can use all reports; coordinators are limited to their sector and cannot use All Sectors. Limitations include multi-sector double inclusion, no government eligibility integration, category ambiguity in not-yet-eligible reporting, and no template history/scheduled delivery.

# 14. SEARCH, FILTERING, AND RECORD RETRIEVAL

Implemented retrieval includes resident first/middle/last name, beneficiary control number, contact, QR/manual card reference, sector, registration source, QR validity, assistance status/type/source, report year, eligibility, and sorting by name/control/date.

These mechanisms can support a research hypothesis about faster retrieval, but source code does not prove improvement. Timed comparison/user evaluation is required. Client-side filtering after pagination can omit records outside the loaded page.

# 15. AUTOMATION FEATURES

| Automation | Behavior |
|---|---|
| Beneficiary number | Reads maximum and generates `BENEF-###` |
| Assistance number | Reads latest yearly number and generates `YYYY-###` |
| Age | Calculates from birthday and stores value |
| Sector validation | Enforces pair/age/civil-status rules |
| Card issuance | Automatic after signup approval |
| Card status | Calculates Active/Expiring Soon/Expired/Renewal Pending |
| Timestamps | DB defaults/triggers and API updates |
| Assistance eligibility | Three-month same-category cooldown after Released |
| Active request block | Blocks same category in Pending/Resubmitted/Approved |
| Notifications | Creates selected event notifications/activity |
| SMS/email | Attempts configured verified channel automatically |
| Reports | Calculates counts/groupings from live DB |
| Realtime | Refreshes selected pages on DB changes |
| OCR/face | Extracts ID data and compares faces |
| Renewal | Extends validity by one year |
| Reminders | Cron logic exists; scheduler absent |

Limitations: read-then-insert numbering is race-prone; assistance retries conflicts but beneficiary numbering is weaker; hard-coded requirements mention July–December 2025; status transitions are not centrally enforced; all automation depends on network/services and correct schema.

# 16. VALIDATION AND ERROR HANDLING

Frontend validation covers required fields, contact/email, password confirmation, sector rules, minor/representative rules, client file size/type, OCR/selfie, assistance UI ceiling/checklist, consent, and loading/error states.

Backend validation includes bearer/cookie auth in protected routes, role/status/sector checks, assistance allowed values, contact normalization, duplicates, hashed OTPs, OCR token/document-hash binding, Cloudinary URL checks, card expiry, renewal eligibility, active requests, and cooldown.

Weaknesses include unauthenticated assistance creation, caller-trusted status/amount, caller-defined requirements, missing generic server file-size enforcement, no content scan, no state machine, and silent fallback around missing optional columns. Multi-table operations lack transactions.

Most APIs return structured HTTP JSON and pages show banners/modals/loading/empty states. Some schema errors expose SQL setup guidance to users, useful in development but unsuitable for production.

# 17. SECURITY FEATURES

Implemented controls: Supabase staff auth; signed HttpOnly cookies; production Secure and SameSite=Lax; scrypt beneficiary passwords and optional pepper; HMAC session/QR/email/resubmission tokens; hashed OTPs/codes; role/sector helpers; server-only service role; HSTS, frame denial, no-sniff, referrer and permissions headers; no-store/noindex portal headers; activity logs; partial throttling; no raw QR PII.

Critical/high risks:

1. Unauthenticated assistance GET exposes personal/document data.
2. Unauthenticated online POST accepts arbitrary resident, status, and amount.
3. Beneficiary edit/upload routes can trust caller-controlled resident identity.
4. Supplied RLS permits broad public/authenticated access to requests, residents, users, and signups.
5. `users` RLS can enable privilege escalation outside Admin APIs.
6. Public `account_requests` selection may expose KYC, selfie/OCR data, URLs, contact, and password hashes.
7. QR verifier accepts unsigned decoded payload after signature failure.
8. Cloudinary resources are public.
9. Cloudinary URL matching is weak substring validation.
10. Expensive public OCR/face/upload/signup/request routes lack robust rate limiting.
11. Beneficiary login limiter is instance-local memory.
12. Assistance has no server-enforced status machine.
13. Multi-table approval/card/renewal operations are non-transactional.
14. Cookie mutations have no explicit CSRF token.
15. Content-Security-Policy is absent.
16. Generated staff reset password is only six characters.
17. Direct browser database access makes RLS correctness critical.

Do not claim fully secure authorization, confidential storage, tamper-proof QR, enterprise rate limiting, transaction safety, complete audit logging, or production-ready privacy.

# 18. DATA PRIVACY

Sensitive data includes identity/demographics, address/contact, sectors, ID images/numbers, selfie, face score/status, representative identity, assistance/amount/documents, authentication, and communication logs.

Intended access is Admin all, coordinators assigned sectors, beneficiaries self-only. Actual APIs/policies are broader. SMS logs store full contact/message; activity logs store names/actions/references; development modes can print OTPs and email/SMS content; error logs may expose provider/database detail.

The QR contains only a reference, but the printed card around it contains PII. Cloudinary URLs are public and have no delivery expiry, download audit, retention enforcement, automated deletion, consent withdrawal, or subject export/deletion workflow.

Technical considerations relevant to the Philippine Data Privacy Act (not legal advice) include least-privilege RLS, private document delivery, retention/deletion rules, production log redaction, access audits for documents/biometrics, consent versioning, incident/backup policies, and third-party processor documentation. Signup legal text currently claims secure storage/deletion more strongly than code demonstrates.

# 19. RESPONSIVE DESIGN AND ACCESSIBILITY

Actual responsive support includes desktop/tablet/mobile media queries, mobile sidebar overlay, coarse-pointer detection, collapsible navigation, responsive forms/filters/modals, and mobile card alternatives for several tables. Shells treat <=900px as mobile, or <=1200px with coarse pointer.

Accessibility-oriented implementation includes skip links, `:focus-visible`, reduced-motion rules, native `<dialog>` focus containment/restoration, Escape close, labels, many ARIA labels/live regions, semantic headings, keyboard signup steps, hidden-sidebar `inert`, and alt text.

Limitations: charts are visual/mouse-hover oriented and lack full accessible data equivalents; chart marks are not keyboard focusable; no automated accessibility tests, screen-reader matrix, WCAG contrast measurement, high-contrast verification, or compliance evidence exists. Claim accessibility-oriented support, not WCAG compliance.

# 20. SYSTEM WORKFLOWS

## A. Staff registers a beneficiary

Supabase staff login -> active role validation -> Apply Service Request -> enter sector/personal/address/representative fields -> client validation -> direct Supabase resident write -> optional assistance API -> activity log. Walk-in registration does not automatically create a password/card.

## B. Control number

Read all/latest sequences -> calculate next -> format `BENEF-###` -> store permanently. Concurrent requests can collide.

## C. QR

Approve signup or issue card -> create card row -> take first eight UUID characters -> generate QR data URL -> compose ID -> view/download/print.

## D. Scan/search

Open verifier -> camera or manual reference -> ZXing/reference input -> protected API -> sector check -> show card, resident, and assistance data. Separate name/control/contact search exists.

## E. Staff assistance request

Select/register resident -> select type -> show ceiling/requirements -> check active/cooldown -> checklist -> API assigns yearly number/saves -> activity/notification.

The Assistance Tracking “New Request” handler is UI-only and hidden; the working path is the registration/service page.

## F. Status update

Open request -> review documents/checklist -> select status/remarks -> API records processor/time -> activity/in-app notification -> supported SMS/email. Transition order is not server-enforced.

## G. Beneficiary notification

Configured verified SMS/email receives supported events; beneficiary activity panel shows logged events. Released has no SMS/email.

## H. Staff document upload

No complete principal staff UI exists for attaching new files to a walk-in resident/request. An authenticated upload API exists but is not used by inspected pages. Working uploads are by signup, beneficiary assistance/resubmission, and beneficiary renewal users; staff mainly view/check documents.

## I. Reports

Choose report/year/format -> protected role/sector check -> query/calculate -> server XLSX or client PDF -> download.

## J. Update beneficiary

Admin opens resident -> Edit -> password reauthentication -> modify permitted fields -> Admin-only API -> activity log. Coordinators normally have view-only resident access.

# 21. SYSTEM MODULE INVENTORY

| Module | Main functions | Role | Status | Key files |
|---|---|---|---|---|
| Public landing | Information/live aggregate stats | Public | Fully Implemented | `app/page.js` |
| Staff auth | Login/profile/session/logout | Staff | Fully Implemented | `app/admin-login/page.js`, `lib/apiAuth.js` |
| Beneficiary auth | Password/Google/cookie | Beneficiary | Fully Implemented | `app/login/page.js` |
| Online signup | OTP/OCR/face/multi-step | Public | Fully Implemented; hardening needed | `app/signup/page.js` |
| Signup resubmission | Code/corrections | Applicant | Fully Implemented | `app/account-requests/resubmit/page.js` |
| Account approval | Review/create resident/card | Admin/API coordinators | Fully Implemented; non-transactional | `app/admin/account-requests/page.js` |
| Staff dashboard | KPIs/charts/activity | Staff | Partially Implemented | `app/admin/analytics/page.js` |
| Beneficiary dashboard | Personal request/ID stats | Beneficiary | Fully Implemented; insecure API dependency | `app/beneficiary/dashboard/page.js` |
| Residents | Add/view/search/filter/edit | Staff/Admin | Fully Implemented with limits | `app/admin/residents/page.js` |
| Resident delete/archive | Removal/deactivation | Admin | Not Implemented | — |
| QR cards | Issue/render/download/print | Staff/Beneficiary | Fully Implemented; integrity weaknesses | `lib/beneficiaryCards.server.js` |
| QR scanning | Camera/manual verification | Staff | Fully Implemented | `app/admin/beneficiary-id/page.js` |
| Assistance | Submit/review/resubmit/release | Staff/Beneficiary | Fully Implemented; critical API flaws | `app/api/assistance-requests/route.js` |
| Tracking | Released/eligibility summary | Staff | Partially Implemented | `app/admin/assistance/page.js` |
| Tracking New Request | Modal handler | Staff | UI Only/hidden | `app/admin/assistance/page.js` |
| Guidelines/budgets | Requirements/Admin edit | Staff/Admin | Fully Implemented with local fallback | `app/admin/assistance/guidelines/page.js` |
| Document storage | Cloudinary upload/view | Various | Partially Implemented | `lib/uploadDocument.server.js` |
| Staff document attachment | Staff upload workflow | Staff | API orphaned/UI absent | `app/api/admin/upload-valid-id/route.js` |
| OCR | Philippine ID parsing/match | Applicant | Fully Implemented; external dependency | `lib/identityOcrParsing.mjs` |
| Face verification | Selfie/ID comparison | Applicant | Partially Implemented | `lib/faceVerification.server.js` |
| Manual face review | Human override | Admin | Not Implemented | — |
| Notifications/activity | Feeds/read state | Staff/Beneficiary | Partially Implemented | `components/NotificationPanel.js` |
| SMS | OTP/status/reminders | Applicant/Beneficiary | Fully Implemented when configured | `lib/sms.server.js` |
| Email | Verification/status | Applicant/Beneficiary | Fully Implemented when configured | `lib/emailNotify.server.js` |
| Reports | PDF/XLSX reports | Staff | Fully Implemented with limits | `app/admin/reports/page.js` |
| ID renewal | Submit/review/extend | Beneficiary/Admin | Fully Implemented; non-transactional | `app/api/beneficiary/id-renewal/route.js` |
| Users | Create/edit/deactivate/reset | Admin | Fully Implemented | `app/admin/users/page.js` |
| Scheduled reminders | Eligibility/expiry SMS | System | Partially Implemented; scheduler absent | `app/api/cron/` |
| PWA | Installable shell | All | Partially Implemented; no offline data | `next.config.mjs` |
| Backup/recovery | Restore data/files | Admin | Not Implemented | — |

# 22. ACTUAL SYSTEM FEATURES VS OUR RESEARCH PAPER

| Research feature | Exists? | Actual implementation | Accurate? | Correction |
|---|---|---|---|---|
| Authentication | Yes | Supabase staff + custom/Google beneficiary | Yes with detail | Explain separate models |
| Dashboard | Yes | Live KPIs/charts | Partial | Growth comparison is placeholder |
| Resident Registration | Yes | Walk-in and reviewed online | Yes | Note no delete/archive and online OCR/face |
| Assistance Request | Yes | Online/walk-in/checklist/cooldown/status | Partial | Do not call secure before fixes |
| Notification | Yes | Activity, UniSMS, Resend | Partial | Provider-dependent; no Released message |
| Document Management | Partial | Upload/view URL metadata | Overstated as DMS | Call document upload/viewing |
| QR Generation/Scanning | Yes | Eight-character reference lookup | Partial | Do not claim signed/tamper-proof QR |
| Report Generation | Yes | PDF/XLSX eight reports | Yes with limits | Remove CSV/scheduling claims |
| Responsive UI | Yes | Responsive shells/forms/mobile cards | Yes | Do not claim WCAG compliance |

# 23. ISO/IEC 25010 MAPPING

| Characteristic | Supporting evidence | Unsupported without testing/fixes |
|---|---|---|
| Functional Suitability | Registration, requests, cards, reports, renewal, notification | Official requirement completeness; missing staff upload/manual face review |
| Performance Efficiency | Pagination, indexes, debounce, cache, parallel fetch | Capacity, response targets, load/concurrency |
| Compatibility | Browser UI, responsive, camera selection, PDF/XLSX | Browser/device matrix; government interoperability |
| Usability | Guided forms, filters, status/error feedback | SUS/TAM scores, learning/error rates |
| Reliability | Error states, some retries, SMS dedup | Transactions, failover, backup/RTO |
| Security | Auth, hashing, signed cookies, headers | Confidentiality/authorization due API/RLS flaws |
| Maintainability | Shared utilities/components/modular APIs | Migration consistency, broad tests, API contracts |
| Portability | Next.js/Node/env configuration | Proven multi-platform deployment |

No ISO rating can be inferred from code inspection.

# 24. TAM AND SUS RELEVANT FEATURES

Perceived Usefulness can evaluate QR/name/control retrieval, centralized records, eligibility calculation, online submission, history, reporting, messages, and renewal. Ease of Use can evaluate guided forms, autofill, search/filter, badges, responsive navigation, camera/manual alternatives, validation, and feedback.

Possible negative usability influences include long signup, OCR/selfie requirements, dense staff pages, status terminology, service/network errors, and pagination/filter inconsistencies. Attitude/behavioral intention questions can examine remote availability, online convenience, status confidence, willingness to upload identity/face data, and QR preference. These are evaluation targets, not proven perceptions.

# 25. EFFICIENCY-RELATED FEATURES

| Measure | Relevant features |
|---|---|
| Staff record-location time | Name/control/contact search, filters, pagination, QR/manual reference |
| Staff processing time | Autofill, checklist, status actions, cooldown, reusable requirements |
| Accuracy/completeness | Required fields, duplicates, OCR, contact verification, sector rules |
| Overall transaction efficiency | Central data, numbering, dashboards, reports, notification |
| Beneficiary waiting time | Online signup/request, remote resubmission, activity |
| Service speed/convenience | Portal, Google login, mobile design, online renewal |
| Record organization | Structured schema, permanent number, history |
| Overall service efficiency | Search, documents, eligibility, reports |

Potential counter-effects include OCR/face failure, network dependence, provider delay, long forms, schema errors, and partial transactions. Improvement requires comparative measurement.

# 26. DEPLOYMENT AND INFRASTRUCTURE

| Service | Evidence/status |
|---|---|
| Vercel | Deployment/env script and README; active project/domain unverified |
| Supabase | Core DB/Auth/Realtime dependency |
| Cloudinary | Current document storage |
| UniSMS | Real HTTP integration; live delivery unverified |
| Resend | Transactional API; live delivery unverified |
| OCR.Space | External identity OCR |
| GitHub | Configured `origin` remote |
| Domain | Not committed/identifiable |
| Scheduler | Routes exist; invocation config absent |
| Backup/monitoring | No repository configuration |

Environment variable names used by executable code (names only):

- `ADMIN_SESSION_SECRET`, `BENEFICIARY_SESSION_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDINARY_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `QR_CARD_SECRET`, `PASSWORD_PEPPER`
- `SMS_OTP_SECRET`, `SMS_CRON_SECRET`, `CRON_SECRET`, `SMS_DEV_MODE`
- `UNISMS_API_KEY`, `UNISMS_API_URL`, `UNISMS_LINK_API_KEY`, `UNISMS_LINK_API_URL`, `UNISMS_SENDER_ID`, `UNISMS_TIMEOUT_MS`
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_DEV_MODE`, `EMAIL_VERIFICATION_SECRET`
- `OCR_SPACE_API_KEY`
- `FACE_API_MODEL_PATH`, `FACE_API_DETECTION_MIN_CONFIDENCE`, `FACE_API_ID_DETECTION_MIN_CONFIDENCE`, `FACE_API_SELFIE_MIN_SHARPNESS`, `NEXT_PUBLIC_FACE_API_DETECTION_MIN_CONFIDENCE`
- `NODE_ENV`, `VERCEL`, `VERCEL_ENV`

`ACCOUNT_RESUBMISSION_BASE_URL` is documented but was not found in executable code. Service tiers cannot be identified. Production concerns include authorization, manual schema drift, no CI, absent cron schedule/backups/monitoring, public documents, non-transactional workflows, and minimal tests.

# 27. CURRENT LIMITATIONS OF THE SYSTEM

- Internet required; no operational offline sync
- No DSWD/PhilHealth/PSA/OSCA/national-database integration
- No payment/disbursement/accounting integration
- Face comparison is onboarding verification, not biometric login
- Single-barangay defaults and Filipino citizenship are hard-coded
- Only three sectors
- Camera/HTTPS dependency for scanning, with manual fallback
- External Supabase/Cloudinary/SMS/email/OCR dependencies
- No beneficiary profile edit or forgot-password
- No resident archive/delete
- No full document lifecycle, malware scan, or private delivery
- No automatic government eligibility validation
- No immutable request status history
- No backup/recovery or incident tooling
- No events/program scheduling or inventory
- No household/income assessment
- No manual face-review override
- No SMS/email delivery receipt webhook
- No committed cron scheduler
- Pagination/filter accuracy limitations
- Stale hard-coded 2025 requirements
- Incomplete staff document upload
- Manual multi-script database setup
- RLS/API security unsuitable for production

# 28. FEATURES IN THE PAPER THAT SHOULD BE REMOVED OR REWORDED

| Term | Recommended accurate wording |
|---|---|
| Secure | “Uses authentication, hashing, signed cookies, and role helpers; authorization/document privacy require hardening.” |
| Real-time | “Uses realtime refresh on selected dashboards/request views.” |
| Automatic | Name the exact numbering, age, eligibility, issuance, or notification behavior |
| Integrated | “Integrates with Supabase, Cloudinary, UniSMS, Resend, OCR.Space”; not government systems |
| Interoperable | Do not claim; PDF/XLSX is limited portability only |
| Fault tolerant | Remove; no failover/transaction recovery |
| Recoverable | Remove until backups/restoration are implemented and tested |
| Scalable | Replace with “cloud-deployable”; no load evidence |
| Accessible | “Includes accessibility-oriented controls”; no WCAG claim |
| Highly efficient | “Designed to streamline”; claim improvement only after measurement |
| Tamper-proof QR | Replace with “QR-based authenticated card-reference lookup” |
| Secure cloud storage | Replace with “Cloudinary-hosted public HTTPS files” |
| Complete audit trail | Replace with “records selected staff/beneficiary activities” |

# 29. IMPORTANT FILES

Authentication: `app/admin-login/page.js`, `app/login/page.js`, `app/auth/callback/page.js`, `app/admin/layout.js`, `app/beneficiary/layout.js`, `app/api/admin/profile/route.js`, `app/api/admin/session/route.js`, `app/api/beneficiary/login/route.js`, `lib/apiAuth.js`, `lib/adminSession.server.js`, `lib/beneficiarySession.server.js`, `lib/passwords.server.js`, `lib/userRoles.js`, `lib/sectorAccess.js`.

Database: `database-schema.sql`, `supabase_migration.sql`, `setup-step1.sql` through `setup-step26-account-request-ocr.sql`, `lib/supabaseClient.js`, `lib/supabase/config.js`.

Residents: `app/admin/registration/page.js`, `app/admin/residents/page.js`, `app/signup/page.js`, `app/api/residents/route.js`, `app/api/residents/[id]/route.js`, `app/api/account-requests/route.js`, `app/api/account-requests/[id]/route.js`, `lib/residents.js`, `lib/beneficiarySectors.js`, `lib/controlNumbers.server.js`.

QR: `app/admin/beneficiary-id/page.js`, `app/api/beneficiary-cards/issue/route.js`, `app/api/beneficiary-cards/me/route.js`, `app/api/beneficiary-cards/verify/route.js`, `lib/beneficiaryCards.server.js`, `lib/beneficiaryIdCard.client.js`, `lib/beneficiaryIdStatus.server.js`.

Assistance: `app/admin/assistance/requests/page.js`, `app/admin/assistance/page.js`, `app/admin/assistance/guidelines/page.js`, `app/beneficiary/requests/page.js`, `app/beneficiary/history/page.js`, `app/api/assistance-requests/route.js`, `app/api/assistance-requests/[id]/route.js`, `app/api/beneficiary/assistance-requests/[id]/route.js`, `lib/assistanceData.js`, `lib/assistanceRequirements.js`, `lib/requestCooldown.js`, `lib/residentEligibility.js`.

Documents: `components/FileUpload.js`, `components/DocumentPreviewModal.js`, `app/api/documents/view/route.js`, `app/api/account-requests/upload-valid-id/route.js`, `app/api/account-requests/verify-id-ocr/route.js`, `app/api/account-requests/verify-face/route.js`, `lib/uploadDocument.server.js`, `lib/cloudinary.server.js`, `lib/documentUrls.server.js`, `lib/identityOcr.server.js`, `lib/identityOcrParsing.mjs`, `lib/faceVerification.server.js`, `lib/imageQuality.mjs`.

Notifications: `components/NotificationPanel.js`, `app/api/notifications/route.js`, `app/api/activity/route.js`, `app/api/admin/staff-activity/route.js`, `app/api/sms/otp/send/route.js`, `app/api/sms/otp/verify/route.js`, `app/api/cron/beneficiary-id-renewals/route.js`, `app/api/cron/eligibility-reminders/route.js`, `lib/activityLogger.server.js`, `lib/sms.server.js`, `lib/smsNotify.server.js`, `lib/smsTemplates.js`, `lib/emailNotify.server.js`.

Reports/UI/config/deployment: `app/admin/reports/page.js`, `app/api/reports/route.js`, `app/admin/analytics/page.js`, `app/api/admin/analytics/route.js`, `app/globals.css`, `app/admin/AdminShell.js`, `app/beneficiary/BeneficiaryShell.js`, `components/Sidebar.js`, `components/Navbar.js`, `components/Modal.js`, `components/Table.js`, `components/BarChart.js`, `components/PieChart.js`, `package.json`, `pnpm-lock.yaml`, `next.config.mjs`, `jsconfig.json`, `eslint.config.js`, `public/manifest.json`, `scripts/sync-vercel-env.mjs`, `README.md`.

No `vercel.json`, Docker configuration, GitHub Actions workflow, or infrastructure-as-code configuration was found.

# 30. FINAL SYSTEM SUMMARY FOR OUR RESEARCHER

ALAGA is a functional web application for managing PWD, Senior Citizen, and Solo Parent beneficiaries of Barangay Sta. Rita. It supports staff walk-in service and direct beneficiary self-service.

Administrators and coordinators search beneficiaries, review requests, scan QR cards, process assistance, view dashboards, and generate reports. Admins additionally manage users, resident corrections, account approvals, renewals, budgets, and passwords. Beneficiaries can register online with contact/email verification, ID OCR, and selfie/face comparison; after approval they can log in, request assistance, view history, resubmit incomplete requests, view their ID, and request renewal.

Data is stored in Supabase PostgreSQL. Cloudinary stores uploaded IDs and documents as public URLs. UniSMS provides SMS, Resend email, OCR.Space identity OCR, and local face packages comparison. The QR contains an eight-character card reference; authenticated staff lookup retrieves the resident. It does not expose raw PII, but the UI QR is not the server’s signed token.

Assistance covers Medicine, Confinement, and Burial with yearly request numbers, a same-category three-month cooldown, documents/checklist, and Pending/Resubmitted/Approved/Released/Incomplete processing.

Strengths include broad workflow coverage, beneficiary self-service, responsive UI, structured records, QR retrieval, configurable requirements, reporting, OCR/face onboarding, and multiple communication channels.

Major limitations are critical authorization/RLS flaws, public document URLs, unauthenticated assistance APIs, non-transactional operations, minimal tests, manual schema deployment, incomplete staff upload, absent scheduler config, and no backup or government-system integration.

The paper may accurately claim authentication, dashboards, registration, assistance processing, notifications, QR lookup, PDF/XLSX reporting, and responsive UI. It should reword claims about security, tamper-proof QR, complete document management, interoperability, fault tolerance, recoverability, scalability, accessibility compliance, and demonstrated efficiency.

# FACTS CHATGPT SHOULD KNOW

- ALAGA uses Next.js 16, React 19, JavaScript, and CSS Modules.
- Supabase supplies PostgreSQL, staff auth, Google OAuth, email OTP, and realtime subscriptions.
- Beneficiary contact/password auth is custom, using scrypt and an eight-hour signed cookie.
- Beneficiaries directly use the portal; it is not staff-only.
- Roles are Admin, three sector coordinators, legacy Staff, and Beneficiary.
- Beneficiaries are residents, not staff `users` rows.
- Sectors are only PWD, Senior Citizen, and Solo Parent.
- One primary and one optional distinct secondary sector are supported.
- Beneficiary numbers are permanent `BENEF-###`; assistance numbers are yearly `YYYY-###`.
- Number generation is read-then-insert and concurrency-prone.
- Online signup requires contact/email verification, ID front/back, OCR, selfie/face, password, and consent.
- OCR supports PhilSys, driver’s license, PWD, Senior, Solo Parent, passport, UMID/SSS/GSIS, Voter’s, and PRC IDs.
- Postal ID, Barangay ID, and Barangay Certificate are explicitly rejected by the OCR parser.
- Signup accepts `manual_review`, but approval requires `passed`; no manual override exists.
- Approval creates a resident and one-year card.
- Walk-in registration does not automatically create a password/card.
- Displayed QR contains the first eight card-UUID characters, not raw PII or the signed token.
- QR verification requires authenticated staff and sector checks.
- Manual reference verification searches only the latest 100 cards.
- QR token verification has an unsigned-payload fallback that defeats signature integrity.
- Assistance types are Medicine, Confinement, and Burial with default PHP 500/1,000/1,000 ceilings.
- Assistance statuses are Pending, Resubmitted, Approved, Released, and Rejected; UI calls Rejected Incomplete.
- Intended eligibility is a three-month cooldown per category after Released.
- The public assistance API has critical unauthenticated read/create, arbitrary-resident, status, and amount flaws.
- Beneficiary edit/upload APIs can accept caller-controlled resident IDs without a valid cookie.
- Supplied RLS is overly permissive for residents, requests, users, and account requests.
- Cloudinary is active storage and files use public HTTPS URLs.
- End-to-end formats are PDF, JPG/JPEG, and PNG.
- Browser file limit is 5 MB; generic server upload has no size limit.
- No documents table, deletion lifecycle, retention enforcement, or malware scan exists.
- Beneficiary updates are mostly activity logs; staff notifications have database read state.
- Activity-log read state is local-browser only.
- UniSMS handles OTP/status/reminders; Resend handles transactional email.
- Provider acceptance is logged, but delivery webhooks are absent.
- Released assistance sends no SMS/email.
- Reminder cron routes exist but no scheduler is committed.
- Reports support PDF and XLSX, not CSV.
- Dashboard data is live when available, but growth/previous values are zero placeholders.
- Assistance Tracking’s hidden New Request handler is UI-only and does not persist.
- No resident archive/delete exists.
- No government database, payment/disbursement, events, or backup/recovery integration exists.
- Face comparison is signup identity verification, not biometric login.
- The app is single-barangay oriented and internet-dependent.
- PWA install is configured, but offline business operation is not.
- ESLint had 0 errors and 17 warnings; 17 OCR-parser tests passed.
- No comprehensive E2E, integration, accessibility, performance, or security tests exist.
- The implementation should be treated as advanced prototype/pre-production, not production-secure.
