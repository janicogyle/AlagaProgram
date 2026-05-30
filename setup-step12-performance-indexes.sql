-- General performance indexes
-- Run this in Supabase SQL Editor.
--
-- This script uses table/column checks before creating indexes, so it is safe
-- to run even if an optional table or column is not present yet.

do $$
begin
  if to_regclass('public.residents') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'residents' and column_name = 'created_at'
     ) then
    create index if not exists idx_residents_created_at_desc
      on public.residents (created_at desc);
  end if;

  if to_regclass('public.residents') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'residents' and column_name = 'contact_number'
     ) then
    create index if not exists idx_residents_contact_number
      on public.residents (contact_number);
  end if;

  if to_regclass('public.assistance_requests') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'assistance_requests' and column_name = 'resident_id'
     ) then
    create index if not exists idx_assistance_requests_resident_id
      on public.assistance_requests (resident_id);
  end if;

  if to_regclass('public.assistance_requests') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'assistance_requests' and column_name = 'status'
     ) then
    create index if not exists idx_assistance_requests_status
      on public.assistance_requests (status);
  end if;

  if to_regclass('public.assistance_requests') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'assistance_requests' and column_name = 'request_date'
     ) then
    create index if not exists idx_assistance_requests_request_date_desc
      on public.assistance_requests (request_date desc);
  end if;

  if to_regclass('public.assistance_requests') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'assistance_requests' and column_name = 'resident_id'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'assistance_requests' and column_name = 'status'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'assistance_requests' and column_name = 'request_date'
     ) then
    create index if not exists idx_assistance_requests_resident_status_request_date
      on public.assistance_requests (resident_id, status, request_date desc);
  end if;

  if to_regclass('public.beneficiary_cards') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'beneficiary_cards' and column_name = 'resident_id'
     ) then
    create index if not exists idx_beneficiary_cards_resident_id
      on public.beneficiary_cards (resident_id);
  end if;

  if to_regclass('public.beneficiary_cards') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'beneficiary_cards' and column_name = 'issued_at'
     ) then
    create index if not exists idx_beneficiary_cards_issued_at_desc
      on public.beneficiary_cards (issued_at desc);
  end if;

  if to_regclass('public.beneficiary_cards') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'beneficiary_cards' and column_name = 'resident_id'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'beneficiary_cards' and column_name = 'issued_at'
     ) then
    create index if not exists idx_beneficiary_cards_resident_issued_at
      on public.beneficiary_cards (resident_id, issued_at desc);
  end if;

  if to_regclass('public.sms_otps') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sms_otps' and column_name = 'contact_number'
     ) then
    create index if not exists idx_sms_otps_contact_number
      on public.sms_otps (contact_number);
  end if;

  if to_regclass('public.sms_otps') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sms_otps' and column_name = 'purpose'
     ) then
    create index if not exists idx_sms_otps_purpose
      on public.sms_otps (purpose);
  end if;

  if to_regclass('public.sms_otps') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sms_otps' and column_name = 'last_sent_at'
     ) then
    create index if not exists idx_sms_otps_last_sent_at_desc
      on public.sms_otps (last_sent_at desc);
  end if;

  if to_regclass('public.sms_otps') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sms_otps' and column_name = 'contact_number'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sms_otps' and column_name = 'purpose'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sms_otps' and column_name = 'last_sent_at'
     ) then
    create index if not exists idx_sms_otps_contact_purpose_last_sent_at_desc
      on public.sms_otps (contact_number, purpose, last_sent_at desc);
  end if;
end $$;
