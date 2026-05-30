-- SMS performance maintenance
-- Run this in Supabase SQL Editor.

-- Speeds up OTP resend limit checks:
--   where contact_number = ?
--     and purpose = ?
--     and last_sent_at >= ?
--   order by last_sent_at desc
create index if not exists idx_sms_otps_contact_purpose_last_sent_at
on public.sms_otps (contact_number, purpose, last_sent_at desc);

-- Speeds up OTP verification lookup:
--   where contact_number = ?
--     and purpose = ?
--   order by created_at desc
create index if not exists idx_sms_otps_contact_purpose_created_at
on public.sms_otps (contact_number, purpose, created_at desc);

-- Keeps SMS log screens/reports fast when ordered by newest first.
create index if not exists idx_sms_logs_created_at
on public.sms_logs (created_at desc);

-- Optional cleanup: removes expired/old OTP rows.
-- Keeping recent rows preserves rate-limit history while preventing long-term table growth.
delete from public.sms_otps
where created_at < now() - interval '30 days'
   or expires_at < now() - interval '7 days';
