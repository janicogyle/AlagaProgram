# ALAGA Program Technical Documentation

## 1. Project Overview

### Project Name

**ALAGA Program**

### Purpose

ALAGA Program is a web-based barangay assistance and beneficiary management system for Barangay Sta. Rita. It digitizes beneficiary registration, verification, assistance request processing, beneficiary ID card issuance, renewal monitoring, SMS/email notifications, reporting, and administrative monitoring.

The system supports the barangay in managing residents who belong to priority sectors such as persons with disability, senior citizens, and solo parents. It also provides a beneficiary portal where approved residents can submit and track assistance requests.

### Main Features

- Online beneficiary account registration with SMS or email verification.
- Valid ID upload, OCR-assisted identity verification, and face verification.
- Admin review and approval of beneficiary account requests.
- Resident and beneficiary profile management.
- Assistance request creation, approval, release, rejection, and resubmission.
- Assistance type budget and document requirement management.
- Beneficiary QR ID card issuance, verification, expiration tracking, and renewal.
- Admin and coordinator dashboards with analytics and reports.
- Notifications, activity logs, SMS alerts, and email status updates.
- PDF/Excel-style report generation support through client libraries.
- Progressive Web App support for installable browser access.

### User Roles

- **Admin**: Full system access, user management, account request approval, resident management, reports, analytics, budgets, ID cards, and renewal requests.
- **PWD Coordinator**: Coordinator access limited to PWD beneficiary sector records and related assistance processing.
- **Senior Citizen Coordinator**: Coordinator access limited to senior citizen beneficiary sector records and related assistance processing.
- **Solo Parent Coordinator**: Coordinator access limited to solo parent beneficiary sector records and related assistance processing.
- **Staff**: Legacy staff role retained for compatibility with older accounts.
- **Beneficiary**: Approved resident account holder who can log in, view profile, request assistance, view history, renew beneficiary ID, and verify QR card status.
- **Public Visitor**: Can access the landing page, login, signup, public statistics, OTP verification, and resubmission pages.

## 2. Technology Stack

### Frontend

- **Next.js 16.2.3** using the App Router under `app/`.
- **React 19.2.3** and **React DOM 19.2.3**.
- CSS Modules and global CSS for styling.
- Progressive Web App behavior through `next-pwa 5.6.0`.

### Backend

- **Next.js API Routes** located in `app/api/**/route.js`.
- Server-side JavaScript modules under `lib/`.
- Node.js runtime requirement: **Node >= 18**.

### Database

- **Supabase PostgreSQL**.
- SQL schema and migrations are stored in `database-schema.sql`, `supabase_migration.sql`, and `setup-step*.sql`.
- Row Level Security is enabled on major tables.

### Authentication

- Admin/coordinator authentication uses **Supabase Auth email/password**.
- Beneficiary authentication uses custom resident login with scrypt password hashes and signed HMAC session cookies.
- Signup supports SMS OTP and Supabase email OTP verification.
- Google OAuth login support exists for beneficiary login through approved resident/account request email matching.

### Storage

- **Cloudinary** stores valid IDs, selfies, representative IDs, and assistance requirement files.
- Supabase Storage is treated as legacy and is removed by `setup-step7.sql`.

### APIs and External Services

- **Supabase API** for authentication, database access, and realtime subscriptions.
- **Cloudinary API** for document and image uploads.
- **UniSMS API** for OTP and status notification SMS.
- **OCR.Space API** for valid ID OCR during signup verification.
- **Resend API** for transactional email status notifications.

### Third-Party Libraries

- `@supabase/supabase-js 2.95.3`: Supabase client and admin access.
- `cloudinary 2.10.0`: Cloudinary upload and document URL handling.
- `@tensorflow/tfjs 4.22.0`, `@tensorflow/tfjs-backend-wasm 4.22.0`, `@vladmandic/face-api 1.7.15`, `@napi-rs/canvas 1.0.2`: Face verification.
- `@zxing/browser 0.1.5`: QR/barcode reading support.
- `qrcode 1.5.4`: QR code generation for beneficiary ID cards.
- `exceljs 4.4.0`: Spreadsheet/export support.
- `jspdf 4.2.1` and `jspdf-autotable 5.0.7`: PDF report generation.
- `dotenv 17.3.1`: Local environment variable loading for scripts.
- `eslint 9.7.0`, `eslint-config-next 16.2.3`, `prettier 3.8.1`: Development quality tools.

### Deployment Platforms

- Designed for **Vercel** deployment.
- Database and auth are hosted on **Supabase**.
- File storage is hosted on **Cloudinary**.
- SMS and email services are hosted through UniSMS and Resend.

## 3. Project Structure

```text
AlagaProgram/
├── app/
│   ├── account-requests/
│   ├── admin/
│   ├── admin-login/
│   ├── api/
│   ├── auth/
│   ├── beneficiary/
│   ├── login/
│   └── signup/
├── components/
├── lib/
│   └── supabase/
├── public/
├── scripts/
├── database-schema.sql
├── supabase_migration.sql
├── setup-step*.sql
├── package.json
├── pnpm-lock.yaml
├── next.config.mjs
└── README.md
```

### Folder Purpose

- `app/`: Next.js App Router pages, layouts, loading screens, and API route handlers.
- `app/api/`: Backend endpoints for authentication, residents, account requests, assistance requests, notifications, reports, documents, SMS, cards, renewals, and scheduled jobs.
- `app/admin/`: Admin and coordinator dashboard pages.
- `app/beneficiary/`: Beneficiary portal pages.
- `app/signup/`, `app/login/`, `app/admin-login/`: Public authentication screens.
- `app/account-requests/resubmit/`: Public resubmission page for incomplete account requests.
- `components/`: Shared UI components such as tables, cards, modals, buttons, forms, charts, navigation, badges, notifications, and file upload controls.
- `lib/`: Reusable business logic for authentication, Supabase access, password hashing, uploads, SMS, email, OCR, face verification, QR card tokens, eligibility rules, sector permissions, reports, and data helpers.
- `lib/supabase/`: Supabase configuration helpers.
- `public/`: Static assets and generated PWA files.
- `scripts/`: Maintenance and setup scripts such as database setup, seeding, migration, cleanup, and storage clearing.
- Root SQL files: Database schema and incremental migrations.
- Root config files: Next.js, ESLint, package manager, workspace, and project metadata.

## 4. Application Architecture

### Client Layer

The client layer is built with Next.js and React. Pages in `app/` render public, admin, and beneficiary interfaces. Shared UI components in `components/` provide reusable controls for tables, cards, modals, status chips, charts, upload fields, navigation, and notifications.

Client pages communicate with backend API routes through HTTP requests. Some pages also use the Supabase browser client for realtime subscriptions and selected data reads.

### Server Layer

The server layer consists of Next.js route handlers under `app/api/`. These routes validate requests, authenticate users, enforce role restrictions, call Supabase, upload files to Cloudinary, send SMS/email notifications, generate signed tokens, and return JSON responses.

Server-only helpers in `lib/*.server.js` keep sensitive operations away from the browser, including service-role Supabase access, Cloudinary credentials, SMS credentials, OCR keys, password hashing, and HMAC signing.

### Database Layer

The database is Supabase PostgreSQL. It stores resident records, account requests, assistance requests, assistance budgets, admin users, beneficiary cards, renewal requests, notifications, activity logs, SMS OTPs, and SMS logs.

### External APIs

- Supabase handles authentication, database access, and realtime database subscriptions.
- Cloudinary stores document/image files and returns HTTPS URLs.
- UniSMS sends OTP and notification text messages.
- OCR.Space extracts text from uploaded valid IDs.
- Resend sends transactional emails.

### Authentication Flow

Admin/coordinator users sign in through Supabase Auth. API routes read the bearer token, validate it with Supabase Admin, load the matching `users` profile, confirm the account is active, and check the role.

Beneficiaries register through account requests. Their passwords are hashed using scrypt and stored in `account_requests` while pending, then transferred to `residents` when approved. Beneficiary login verifies the password and issues a signed HMAC `beneficiary_session` cookie.

### Data Flow

1. A public user submits signup information, verification status, valid ID files, and sector information.
2. The API validates the request, uploads files to Cloudinary, hashes passwords, and stores the submission in `account_requests`.
3. Admin/coordinator users review requests in the admin dashboard.
4. Approved requests create or update `residents` records.
5. Beneficiaries log in and submit assistance requests with supporting documents.
6. Admin/coordinator users process requests and update statuses.
7. Status updates create notifications, activity logs, SMS logs, and optional email messages.
8. Reports and analytics aggregate records from residents, account requests, assistance requests, budgets, and cards.

## 5. Functional Modules

### Public Landing and Statistics

- **Description**: Displays public-facing system information and public statistics.
- **Main files**: `app/page.js`, `app/api/public/stats/route.js`.
- **API endpoints**: `GET /api/public/stats`.
- **Database tables used**: `residents`, `account_requests`, `assistance_requests`, `users`.

### Authentication and Login

- **Description**: Handles admin/coordinator login, beneficiary login, logout, OAuth callback, and session checking.
- **Main files**: `app/login/page.js`, `app/admin-login/page.js`, `app/auth/callback/page.js`, `components/UnifiedLoginForm/UnifiedLoginForm.js`, `lib/apiAuth.js`, `lib/beneficiarySession.server.js`, `lib/adminSession.server.js`.
- **API endpoints**: `POST /api/admin/session`, `DELETE /api/admin/session`, `POST /api/beneficiary/login`, `POST /api/beneficiary/oauth-login`, `POST /api/beneficiary/logout`.
- **Database tables used**: `users`, `residents`, `account_requests`, Supabase `auth.users`.

### Signup and Verification

- **Description**: Allows residents to create account requests with contact verification, ID upload, OCR validation, and face verification.
- **Main files**: `app/signup/page.js`, `lib/accountRequests.js`, `lib/contactRegistration.server.js`, `lib/identityOcr.server.js`, `lib/faceVerification.server.js`, `lib/uploadDocument.server.js`.
- **API endpoints**: `POST /api/account-requests`, `GET /api/account-requests/check-contact`, `GET /api/account-requests/check-email`, `POST /api/account-requests/upload-valid-id`, `POST /api/account-requests/verify-face`, `POST /api/account-requests/verify-id-ocr`, `POST /api/sms/otp/send`, `POST /api/sms/otp/verify`, `POST /api/signup/email-verification`.
- **Database tables used**: `account_requests`, `residents`, `sms_otps`, `sms_logs`.

### Account Request Management

- **Description**: Lets admin/coordinators list, inspect, approve, reject, or mark signup requests incomplete; supports public resubmission links.
- **Main files**: `app/admin/account-requests/page.js`, `app/account-requests/resubmit/page.js`, `app/api/account-requests/[id]/route.js`, `lib/accountResubmissionTokens.server.js`.
- **API endpoints**: `GET /api/account-requests`, `GET /api/account-requests/:id`, `POST /api/account-requests/:id`, `GET /api/account-requests/resubmission`, `POST /api/account-requests/resubmission`, `POST /api/account-requests/resubmission/upload-valid-id`.
- **Database tables used**: `account_requests`, `residents`, `users`, `notifications`, `activity_logs`, `sms_logs`.

### Resident Management

- **Description**: Maintains approved beneficiary records, sector assignments, contact details, IDs, and password resets.
- **Main files**: `app/admin/residents/page.js`, `app/api/residents/route.js`, `app/api/residents/[id]/route.js`, `lib/residents.js`, `lib/sectorAccess.js`.
- **API endpoints**: `GET /api/residents`, `GET /api/residents/:id`, `PATCH /api/residents/:id`, `POST /api/residents/:id/reset-password`, `GET /api/residents/check-contact`.
- **Database tables used**: `residents`, `account_requests`, `beneficiary_cards`, `assistance_requests`.

### Assistance Request Processing

- **Description**: Handles assistance request submission, document uploads, eligibility checks, review, release, rejection, deletion, and beneficiary resubmission.
- **Main files**: `app/admin/assistance/page.js`, `app/admin/assistance/requests/page.js`, `app/beneficiary/requests/page.js`, `app/beneficiary/history/page.js`, `app/api/assistance-requests/route.js`, `app/api/assistance-requests/[id]/route.js`, `app/api/beneficiary/assistance-requests/[id]/route.js`.
- **API endpoints**: `GET /api/assistance-requests`, `POST /api/assistance-requests`, `PATCH /api/assistance-requests/:id`, `DELETE /api/assistance-requests/:id`, `GET /api/assistance-requests/eligibility`, `PATCH /api/beneficiary/assistance-requests/:id`.
- **Database tables used**: `assistance_requests`, `residents`, `account_requests`, `assistance_budgets`, `users`, `notifications`, `activity_logs`.

### Assistance Budget and Guidelines

- **Description**: Manages assistance types, ceilings, eligibility requirements, and document checklists.
- **Main files**: `app/admin/assistance/guidelines/page.js`, `app/admin/registration/page.js`, `app/api/assistance-budgets/route.js`, `lib/assistanceRequirements.js`, `lib/assistanceAmounts.mjs`.
- **API endpoints**: `POST /api/assistance-budgets`.
- **Database tables used**: `assistance_budgets`.

### Beneficiary Portal

- **Description**: Provides dashboard, profile, assistance request, history, card status, and renewal features for beneficiaries.
- **Main files**: `app/beneficiary/layout.js`, `app/beneficiary/BeneficiaryShell.js`, `app/beneficiary/dashboard/page.js`, `app/beneficiary/profile/page.js`, `app/beneficiary/requests/page.js`, `app/beneficiary/history/page.js`.
- **API endpoints**: `GET /api/beneficiary-cards/me`, `GET /api/beneficiary/id-renewal`, `POST /api/beneficiary/id-renewal`, `POST /api/beneficiary/upload-valid-id`.
- **Database tables used**: `residents`, `assistance_requests`, `assistance_budgets`, `beneficiary_cards`, `beneficiary_id_renewal_requests`.

### Beneficiary ID Cards and QR Verification

- **Description**: Issues QR-based beneficiary cards, verifies signed QR payloads, checks eligibility, and tracks card expiration.
- **Main files**: `app/admin/beneficiary-id/page.js`, `lib/beneficiaryCards.server.js`, `lib/beneficiaryIdCard.client.js`, `lib/beneficiaryIdStatus.server.js`, `lib/hmacTokens.server.js`.
- **API endpoints**: `POST /api/beneficiary-cards/issue`, `GET /api/beneficiary-cards/me`, `POST /api/beneficiary-cards/verify`.
- **Database tables used**: `beneficiary_cards`, `residents`, `account_requests`, `assistance_requests`.

### Beneficiary ID Renewal

- **Description**: Allows beneficiaries to request ID renewal and lets administrators process renewal submissions.
- **Main files**: `app/admin/renewal-requests/page.js`, `app/api/beneficiary/id-renewal/route.js`, `app/api/admin/renewal-requests/route.js`, `app/api/admin/renewal-requests/[id]/route.js`.
- **API endpoints**: `GET /api/admin/renewal-requests`, `PATCH /api/admin/renewal-requests/:id`, `GET /api/beneficiary/id-renewal`, `POST /api/beneficiary/id-renewal`.
- **Database tables used**: `beneficiary_id_renewal_requests`, `beneficiary_cards`, `residents`, `users`, `notifications`.

### User Management

- **Description**: Manages admin and coordinator accounts, roles, statuses, and password resets.
- **Main files**: `app/admin/users/page.js`, `app/api/users/route.js`, `app/api/users/[id]/route.js`, `app/api/users/[id]/reset-password/route.js`, `lib/users.js`, `lib/userRoles.js`.
- **API endpoints**: `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`, `POST /api/users/:id/reset-password`.
- **Database tables used**: `users`, Supabase `auth.users`.

### Reports and Analytics

- **Description**: Produces dashboard analytics, summaries, and report outputs for released assistance and resident data.
- **Main files**: `app/admin/analytics/page.js`, `app/admin/reports/page.js`, `app/api/admin/analytics/route.js`, `app/api/reports/route.js`.
- **API endpoints**: `GET /api/admin/analytics`, `GET /api/reports`, `POST /api/reports`.
- **Database tables used**: `residents`, `account_requests`, `assistance_requests`, `assistance_budgets`.

### Notifications and Activity Logs

- **Description**: Records audit trail events and delivers user-specific notifications.
- **Main files**: `components/NotificationPanel.js`, `app/api/notifications/route.js`, `app/api/activity/route.js`, `app/api/admin/staff-activity/route.js`, `lib/activityLogger.server.js`.
- **API endpoints**: `GET /api/notifications`, `PATCH /api/notifications`, `GET /api/activity`, `GET /api/admin/staff-activity`.
- **Database tables used**: `notifications`, `activity_logs`, `users`, `assistance_requests`.

### Documents and Uploads

- **Description**: Validates, uploads, and securely views valid IDs and requirement files.
- **Main files**: `components/FileUpload.js`, `components/DocumentPreviewModal.js`, `app/api/documents/view/route.js`, `lib/uploadDocument.server.js`, `lib/cloudinary.server.js`, `lib/documentUrls.server.js`.
- **API endpoints**: `GET /api/documents/view`, `POST /api/admin/upload-valid-id`, `POST /api/beneficiary/upload-valid-id`, `POST /api/account-requests/upload-valid-id`, `POST /api/account-requests/resubmission/upload-valid-id`.
- **Database tables used**: `residents`, `account_requests`, `assistance_requests`, `beneficiary_id_renewal_requests`.

### Scheduled Jobs

- **Description**: Performs scheduled checks for ID renewal status and eligibility reminders.
- **Main files**: `app/api/cron/beneficiary-id-renewals/route.js`, `app/api/cron/eligibility-reminders/route.js`.
- **API endpoints**: `POST /api/cron/beneficiary-id-renewals`, `POST /api/cron/eligibility-reminders`.
- **Database tables used**: `beneficiary_cards`, `residents`, `assistance_requests`, `sms_logs`.

## 6. Database Documentation

### Tables and Columns

#### `residents`

- **Primary key**: `id`.
- **Important columns**: `control_number`, `last_name`, `first_name`, `middle_name`, `contact_number`, `email`, `verification_method`, `contact_verified`, `email_verified`, `password_hash`, `house_no`, `purok`, `street`, `barangay`, `city`, `birthday`, `birthplace`, `age`, `sex`, `citizenship`, `civil_status`, `valid_id_url`, `profile_photo_url`, `is_pwd`, `is_senior_citizen`, `is_solo_parent`, `primary_sector`, `secondary_sector`, `representative_name`, `representative_contact`, `representative_relationship`, `representative_valid_id_url`, `account_request_id`, `status`, `created_at`, `updated_at`.
- **Unique constraints/indexes**: `control_number`, contact number when present, email when present.

#### `account_requests`

- **Primary key**: `id`.
- **Important columns**: `first_name`, `middle_name`, `last_name`, `birthday`, `contact_number`, `email`, `verification_method`, `contact_verified`, `email_verified`, `password_hash`, address fields, sector flags, `primary_sector`, `secondary_sector`, valid ID URLs, `selfie_url`, face verification fields, OCR fields, representative fields, demographic fields, `status`, `notes`, `processed_by`, `processed_at`, resubmission token fields, `created_at`, `updated_at`.
- **Status values**: `Pending`, `Incomplete`, `Resubmitted`, `Approved`, `Rejected`.
- **Unique constraints/indexes**: contact number, email when present, resubmission token hash.

#### `users`

- **Primary key**: `id`, referencing Supabase `auth.users(id)`.
- **Important columns**: `full_name`, `email`, `contact_number`, `role`, `sector_access`, `status`, `last_login`, `created_at`, `updated_at`.
- **Role values**: `Admin`, `PWD Coordinator`, `Solo Parent Coordinator`, `Senior Citizen Coordinator`, `Staff`.
- **Status values**: `Active`, `Inactive`.

#### `assistance_requests`

- **Primary key**: `id`.
- **Foreign key**: `resident_id` references `residents(id)` with `ON DELETE SET NULL`.
- **Important columns**: `control_number`, requester fields, beneficiary fields, `assistance_type`, `amount`, `status`, `request_source`, `processed_by`, `decision_remarks`, `valid_id_url`, `requirements_urls`, `requirements_files`, `requirements_checklist`, `requirements_completed`, `request_date`, `created_at`, `updated_at`.
- **Status values**: `Pending`, `Resubmitted`, `Approved`, `Released`, `Rejected`.
- **Request source values**: `online`, `walk-in`.
- **Unique constraint/index**: assistance type and control number.

#### `assistance_budgets`

- **Primary key**: `id`.
- **Important columns**: `assistance_type`, `ceiling`, `requirements`, `created_at`, `updated_at`.
- **Unique constraint**: `assistance_type`.

#### `beneficiary_cards`

- **Primary key**: `id`.
- **Foreign key**: `resident_id` references `residents(id)` with `ON DELETE CASCADE`.
- **Important columns**: `resident_id`, `issued_at`, `expires_at`, `revoked_at`, `status`, `created_at`, `updated_at`.
- **Status values**: `Active`, `Expiring Soon`, `Expired`.

#### `beneficiary_id_renewal_requests`

- **Primary key**: `id`.
- **Foreign keys**: `resident_id` references `residents(id)` with `ON DELETE CASCADE`; `card_id` references `beneficiary_cards(id)` with `ON DELETE SET NULL`.
- **Important columns**: `current_expires_at`, `updated_valid_id_url`, `remarks`, `status`, `admin_remarks`, `processed_by`, `processed_at`, `created_at`, `updated_at`.
- **Status values**: `Pending`, `Incomplete`, `Approved`.

#### `notifications`

- **Primary key**: `id`.
- **Foreign key**: `user_id` references `users(id)` with `ON DELETE CASCADE`.
- **Important columns**: `title`, `message`, `type`, `is_read`, `link`, `created_at`.
- **Type values**: `info`, `success`, `warning`, `error`.

#### `activity_logs`

- **Primary key**: `id`.
- **Foreign keys**: `actor_user_id` references `users(id)`, `audience_user_id` references `users(id)`.
- **Important columns**: `actor_resident_id`, `actor_name`, `actor_role`, `action`, `message`, `entity_type`, `entity_id`, `reference_number`, `link`, `audience_resident_id`, `created_at`.
- **Actor roles**: `Admin`, `PWD Coordinator`, `Solo Parent Coordinator`, `Senior Citizen Coordinator`, `Staff`, `Beneficiary`, `System`.

#### `sms_otps`

- **Primary key**: `id`.
- **Important columns**: `contact_number`, `purpose`, `otp_hash`, `expires_at`, `verified_at`, `consumed_at`, `attempts`, `last_sent_at`, `created_at`.

#### `sms_logs`

- **Primary key**: `id`.
- **Important columns**: `contact_number`, `message`, `status`, `provider`, `provider_id`, `error`, `reference_type`, `reference_id`, `reference_key`, `created_at`.
- **Status values**: `sent`, `failed`.

### Textual ERD

```text
auth.users 1 ── 1 public.users

residents 1 ── many assistance_requests
residents 1 ── many beneficiary_cards
residents 1 ── many beneficiary_id_renewal_requests

beneficiary_cards 1 ── many beneficiary_id_renewal_requests

users 1 ── many notifications
users 1 ── many activity_logs as actor_user
users 1 ── many activity_logs as audience_user

account_requests may become residents after approval through copied profile data.
assistance_budgets defines assistance types, ceilings, and requirements used by assistance_requests.
sms_otps and sms_logs support verification and notifications by contact number.
```

## 7. API Documentation

| Method | Route | Request | Response | Authorization |
|---|---|---|---|---|
| GET | `/api/public/stats` | None | Public dashboard counts | Public |
| POST | `/api/admin/session` | Admin email/password session request | Session/profile result | Public login, validates Supabase credentials |
| DELETE | `/api/admin/session` | None | Logout result | Admin session |
| POST | `/api/beneficiary/login` | Contact/email and password | Signed beneficiary session cookie | Public login |
| POST | `/api/beneficiary/oauth-login` | OAuth-authenticated email context | Beneficiary session result | Supabase OAuth context |
| POST | `/api/beneficiary/logout` | None | Clears beneficiary session | Beneficiary |
| POST | `/api/signup/email-verification` | Email verification payload | Verification result | Public |
| POST | `/api/sms/otp/send` | Contact number and purpose | OTP send status | Public |
| POST | `/api/sms/otp/verify` | Contact number, purpose, OTP | Verification status | Public |
| GET | `/api/account-requests` | Query filters | Account request list | Staff/Admin roles |
| POST | `/api/account-requests` | Signup form data | Created account request | Public with verification checks |
| GET | `/api/account-requests/check-contact` | Contact query | Availability result | Public |
| GET | `/api/account-requests/check-email` | Email query | Availability result | Public |
| POST | `/api/account-requests/upload-valid-id` | Multipart file | Cloudinary URL | Public signup |
| POST | `/api/account-requests/verify-face` | Valid ID/selfie images | Face verification result | Public signup |
| POST | `/api/account-requests/verify-id-ocr` | Valid ID file/data | OCR verification result | Public signup |
| GET | `/api/account-requests/:id` | Request ID | Account request detail | Staff/Admin roles |
| POST | `/api/account-requests/:id` | Decision/status payload | Updated request/resident result | Staff/Admin roles |
| GET | `/api/account-requests/resubmission` | Resubmission token | Request data for resubmission | Public with signed token |
| POST | `/api/account-requests/resubmission` | Updated requirements | Resubmitted request result | Public with signed token |
| POST | `/api/account-requests/resubmission/upload-valid-id` | Multipart file | Cloudinary URL | Public with signed token |
| GET | `/api/residents` | Query filters | Resident list | Staff/Admin roles |
| GET | `/api/residents/check-contact` | Contact query | Availability result | Staff/Admin roles |
| GET | `/api/residents/:id` | Resident ID | Resident detail | Staff/Admin roles or beneficiary-owned access |
| PATCH | `/api/residents/:id` | Resident update payload | Updated resident | Staff/Admin roles |
| POST | `/api/residents/:id/reset-password` | New password payload | Password reset result | Staff/Admin roles |
| GET | `/api/assistance-requests` | Query filters | Assistance request list | Staff/Admin roles |
| POST | `/api/assistance-requests` | Assistance request data and files | Created request | Beneficiary or Staff/Admin roles |
| GET | `/api/assistance-requests/eligibility` | Current beneficiary session | Eligibility result | Beneficiary |
| PATCH | `/api/assistance-requests/:id` | Status/update payload | Updated assistance request | Staff/Admin roles |
| DELETE | `/api/assistance-requests/:id` | Request ID | Delete result | Staff/Admin roles |
| PATCH | `/api/beneficiary/assistance-requests/:id` | Resubmission payload | Updated request | Beneficiary owner |
| POST | `/api/assistance-budgets` | Budget/requirements payload | Updated budget | Admin |
| GET | `/api/beneficiary-cards/me` | Beneficiary session | Current card status | Beneficiary |
| POST | `/api/beneficiary-cards/issue` | Resident/card data | Issued card | Staff/Admin roles |
| POST | `/api/beneficiary-cards/verify` | QR token/card token | Verification result | Public or staff scanner |
| GET | `/api/beneficiary/id-renewal` | Beneficiary session | Renewal status | Beneficiary |
| POST | `/api/beneficiary/id-renewal` | Renewal data and valid ID URL | Renewal request result | Beneficiary |
| GET | `/api/admin/renewal-requests` | Query filters | Renewal request list | Staff/Admin roles |
| PATCH | `/api/admin/renewal-requests/:id` | Decision/status payload | Updated renewal request | Staff/Admin roles |
| POST | `/api/admin/upload-valid-id` | Multipart file | Cloudinary URL | Staff/Admin roles |
| POST | `/api/beneficiary/upload-valid-id` | Multipart file | Cloudinary URL | Beneficiary |
| GET | `/api/users` | Query filters | User list | Admin |
| POST | `/api/users` | User profile and credentials | Created user | Admin |
| PATCH | `/api/users/:id` | User update payload | Updated user | Admin |
| DELETE | `/api/users/:id` | User ID | Deleted user | Admin |
| POST | `/api/users/:id/reset-password` | New password payload | Password reset result | Admin |
| GET | `/api/admin/profile` | Bearer token | Current admin profile | Staff/Admin roles |
| GET | `/api/admin/analytics` | Query filters | Analytics summary | Staff/Admin roles |
| GET | `/api/reports` | Report filters | Report data | Staff/Admin roles |
| POST | `/api/reports` | Report generation request | Generated report data/export payload | Staff/Admin roles |
| GET | `/api/notifications` | Bearer token | User notifications | Authenticated admin/coordinator |
| PATCH | `/api/notifications` | Read-state payload | Updated notifications | Authenticated admin/coordinator |
| GET | `/api/activity` | Query filters | Activity log feed | Authenticated user |
| GET | `/api/admin/staff-activity` | Query filters | Staff activity feed | Admin |
| GET | `/api/documents/view` | Cloudinary URL/path query | Document stream/proxy response | Staff/Admin roles |
| POST | `/api/cron/beneficiary-id-renewals` | Cron secret | Renewal status processing result | Cron secret |
| POST | `/api/cron/eligibility-reminders` | Cron secret | Reminder processing result | Cron secret |

## 8. Security Features

### Password Hashing

Beneficiary passwords are hashed with Node.js `crypto.scrypt`. The hash format stores algorithm, cost parameters, salt, and derived hash. A server-side `PASSWORD_PEPPER` may be added through environment variables. Password verification uses `crypto.timingSafeEqual`.

### Authentication

Admin and coordinator accounts authenticate through Supabase Auth. Beneficiary accounts authenticate through stored resident password hashes and receive signed HMAC session cookies.

### Authorization

API helpers require bearer tokens for staff/admin access. The system checks that the Supabase user exists in `public.users`, has an `Active` status, and belongs to an allowed role. Admin-only endpoints restrict user management and budget management.

### Role Permissions

The main portal roles are Admin, PWD Coordinator, Senior Citizen Coordinator, Solo Parent Coordinator, and legacy Staff. Coordinator access is mapped to fixed beneficiary sectors through `lib/userRoles.js` and `lib/sectorAccess.js`.

### Input Validation

Routes validate required fields, status values, roles, contact number uniqueness, email uniqueness, password minimum length, allowed sectors, and request ownership. SQL-level check constraints also validate statuses, roles, sector values, request source values, and notification types.

### File Upload Validation

Document uploads validate MIME type. General uploads allow PDF, JPG, JPEG, and PNG. Image-only uploads allow JPG, JPEG, and PNG. Files are uploaded to Cloudinary and stored as HTTPS URLs.

### SQL Injection Prevention

Database operations use the Supabase client query builder instead of raw SQL string concatenation in application routes. Migration scripts are static SQL files executed manually in Supabase SQL Editor.

### XSS Protection

Next.js escapes rendered text by default. Uploaded documents are viewed through controlled routes, and security headers include `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.

### CSRF Protection

The application primarily uses bearer-token authorization for admin API routes and signed beneficiary session cookies for beneficiary routes. No dedicated CSRF token implementation was found. Cookie-based beneficiary routes should be reviewed for CSRF risk if they accept state-changing requests from browsers.

### Environment Variables

Important environment variables include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QR_CARD_SECRET`
- `BENEFICIARY_SESSION_SECRET`
- `PASSWORD_PEPPER`
- `CLOUDINARY_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `UNISMS_API_KEY`
- `UNISMS_SENDER_ID`
- `UNISMS_API_URL`
- `UNISMS_LINK_API_KEY`
- `UNISMS_LINK_API_URL`
- `ACCOUNT_RESUBMISSION_BASE_URL`
- `SMS_OTP_SECRET`
- `SMS_DEV_MODE`
- `SMS_CRON_SECRET`
- `OCR_SPACE_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_DEV_MODE`

## 9. Development Tools

- **IDE**: Visual Studio Code is indicated by the `.vscode/` folder.
- **Version control**: Git, indicated by `.git/` and `.gitignore`.
- **Package manager**: pnpm 11.7.0, enforced by the `preinstall` script and `.npmrc`.
- **Build tool**: Next.js build pipeline using `next build`.
- **Development server**: `pnpm dev` running `next dev`.
- **Linting**: ESLint 9 with Next.js config.
- **Formatting**: Prettier 3.8.1.
- **Database tools**: Supabase SQL Editor and setup scripts.
- **Testing tools**: A local OCR parsing test file exists at `lib/identityOcrParsing.test.mjs`; no full test framework script is defined in `package.json`.
- **Design tools**: No design tool configuration was found in the repository.

## 10. UI Documentation

### Public Pages

| Page | Purpose | Role Access | Main Components | Connected Services |
|---|---|---|---|---|
| `/` | Landing page and public information | Public | Navbar, cards, public stats sections | `/api/public/stats` |
| `/login` | Unified login for beneficiary/admin pathways | Public | `UnifiedLoginForm` | Supabase Auth, beneficiary login API |
| `/admin-login` | Admin/coordinator login page | Public | Login form | `/api/admin/session`, Supabase Auth |
| `/signup` | Beneficiary registration | Public | Signup form, file upload, OTP/email verification, face/OCR checks | Account request, SMS, email verification, upload, OCR, face APIs |
| `/auth/callback` | OAuth callback handling | Public OAuth redirect | Callback page | Supabase Auth, beneficiary OAuth API |
| `/account-requests/resubmit` | Resubmit incomplete account request requirements | Public with token | Resubmission form, file upload | Resubmission APIs, Cloudinary |

### Admin and Coordinator Pages

| Page | Purpose | Role Access | Main Components | Connected Services |
|---|---|---|---|---|
| `/admin` | Dashboard overview | Admin, coordinators, staff | KPI cards, charts, activity/notification panels | Supabase data helpers, notifications |
| `/admin/account-requests` | Review signup applications | Admin, coordinators, staff | Tables, modals, action menus, document previews | Account request APIs |
| `/admin/analytics` | View system analytics and trends | Admin, coordinators, staff | Charts, filters, KPI cards | `/api/admin/analytics` |
| `/admin/assistance` | Assistance overview and budgets | Admin, coordinators, staff | Assistance cards, budget controls | Assistance budgets and requests |
| `/admin/assistance/guidelines` | Manage requirements and assistance guidelines | Admin | Forms, requirement lists | Assistance budget API |
| `/admin/assistance/requests` | Process assistance requests | Admin, coordinators, staff | Data tables, status controls, document previews | Assistance request APIs |
| `/admin/beneficiary-id` | Issue and manage beneficiary ID cards | Admin, coordinators, staff | QR/card controls, resident lookup | Beneficiary card APIs |
| `/admin/registration` | Register walk-in or assisted records | Admin, coordinators, staff | Forms, assistance settings | Residents, assistance budgets |
| `/admin/renewal-requests` | Review ID renewal requests | Admin, coordinators, staff | Tables, action modals | Renewal APIs |
| `/admin/reports` | Generate administrative reports | Admin, coordinators, staff | Report filters, export controls | `/api/reports` |
| `/admin/residents` | Manage beneficiary residents | Admin, coordinators, staff | Tables, forms, sector filters | Resident APIs |
| `/admin/users` | Manage admin/coordinator accounts | Admin | User tables, role forms, reset password controls | User APIs |

### Beneficiary Pages

| Page | Purpose | Role Access | Main Components | Connected Services |
|---|---|---|---|---|
| `/beneficiary` | Beneficiary portal entry | Beneficiary | Beneficiary shell/navigation | Beneficiary session |
| `/beneficiary/dashboard` | Shows beneficiary summary and card/request status | Beneficiary | Cards, status chips, notifications | Beneficiary card and assistance data |
| `/beneficiary/profile` | Displays resident profile information | Beneficiary | Profile sections, document preview | Residents table |
| `/beneficiary/requests` | Submit assistance requests | Beneficiary | Assistance form, file upload, eligibility display | Assistance request APIs, Cloudinary |
| `/beneficiary/history` | View previous assistance requests | Beneficiary | Request history table, status chips | Assistance request data |

## 11. Libraries

- **Next.js**: Full-stack React framework for pages, routing, API routes, headers, and deployment.
- **React and React DOM**: UI rendering and state-driven components.
- **Supabase JS**: Database queries, authentication, admin service-role operations, and realtime subscriptions.
- **next-pwa**: Adds service worker and PWA support.
- **Cloudinary**: Uploads and stores valid IDs and requirement documents.
- **TensorFlow.js, TFJS WASM, face-api, canvas**: Detects and compares faces for ID/selfie verification.
- **ZXing Browser**: Reads QR or barcode data in the browser.
- **QRCode**: Generates QR codes for beneficiary cards.
- **ExcelJS**: Creates spreadsheet-compatible reports.
- **jsPDF and jsPDF AutoTable**: Creates PDF reports and tabular PDF outputs.
- **dotenv**: Loads environment variables for local scripts.
- **ESLint and eslint-config-next**: Enforces code quality rules.
- **Prettier**: Formats code consistently.

## 12. Deployment

### Hosting

The application is prepared for deployment on **Vercel**. Vercel hosts the Next.js frontend and serverless API routes. Supabase hosts the PostgreSQL database and admin/coordinator authentication. Cloudinary hosts uploaded documents and images.

### Environment Variables

Production deployment requires the Supabase URL, Supabase anon key, Supabase service role key, Cloudinary credentials, UniSMS credentials, SMS hashing/cron secrets, QR/session secrets, OCR.Space API key, and optional Resend email configuration.

Sensitive variables such as `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_URL`, `UNISMS_API_KEY`, `SMS_OTP_SECRET`, `QR_CARD_SECRET`, `BENEFICIARY_SESSION_SECRET`, `OCR_SPACE_API_KEY`, and `RESEND_API_KEY` must remain server-side and must not be prefixed with `NEXT_PUBLIC_`.

### Build Process

```bash
pnpm install
pnpm build
pnpm start
```

For local development:

```bash
pnpm dev
```

Before production use, run the database schema files in Supabase SQL Editor, configure Supabase Auth providers, copy environment variables into Vercel Project Settings, and redeploy.

## 13. Recommendations

- Add a formal automated test suite for API routes, authentication flows, signup verification, assistance workflows, and database helper functions.
- Add CSRF protection or same-site cookie hardening review for beneficiary cookie-authenticated state-changing routes.
- Consolidate incremental SQL migration files into a versioned migration system to simplify deployment and auditing.
- Document exact request/response schemas per API route using OpenAPI or a maintained API contract file.
- Add centralized runtime validation with a schema library to standardize API input validation.
- Add file size limits and image dimension checks to document upload validation.
- Add rate limiting for login, OTP sending, OTP verification, OCR, face verification, and public signup endpoints.
- Add monitoring and error tracking for production API failures.
- Add backup and restore documentation for Supabase data and Cloudinary assets.
- Add seed data and demo reset scripts specifically for capstone presentation use.
- Add stricter RLS policies where public read/update policies are broader than the application’s role model.
- Add deployment runbook steps for Vercel, Supabase migrations, Cloudinary setup, UniSMS setup, OCR.Space, and Resend domain verification.
