-- =====================================================
-- ALAGA PROGRAM - STEP 7: Remove Supabase Storage (documents)
-- =====================================================
-- Run in Supabase SQL Editor after migrating uploads to Cloudinary.
-- Deletes legacy files, removes storage policies, and clears non-Cloudinary URLs in the DB.

-- 1) Delete all objects in legacy document buckets
DELETE FROM storage.objects
WHERE bucket_id IN ('documents', 'document');

-- 2) Remove public upload/view policies (no longer used)
DROP POLICY IF EXISTS "Anyone can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;

-- 3) Remove buckets (safe after objects are deleted)
DELETE FROM storage.buckets
WHERE id IN ('documents', 'document');

-- 4) Clear legacy Supabase Storage paths from database columns
UPDATE public.account_requests
SET
  valid_id_url = NULL,
  valid_id_urls = '[]'::jsonb
WHERE valid_id_url IS NOT NULL
  AND valid_id_url NOT LIKE 'https://res.cloudinary.com/%';

UPDATE public.account_requests
SET valid_id_urls = COALESCE(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements_text(COALESCE(valid_id_urls, '[]'::jsonb)) AS elem
    WHERE elem LIKE 'https://res.cloudinary.com/%'
  ),
  '[]'::jsonb
)
WHERE valid_id_urls IS NOT NULL
  AND valid_id_urls::text NOT LIKE '%res.cloudinary.com%';

UPDATE public.residents
SET valid_id_url = NULL
WHERE valid_id_url IS NOT NULL
  AND valid_id_url NOT LIKE 'https://res.cloudinary.com/%';

UPDATE public.assistance_requests
SET
  valid_id_url = NULL,
  requirements_urls = COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements_text(COALESCE(requirements_urls, '[]'::jsonb)) AS elem
      WHERE elem LIKE 'https://res.cloudinary.com/%'
    ),
    '[]'::jsonb
  ),
  requirements_files = COALESCE(
    (
      SELECT jsonb_agg(item)
      FROM jsonb_array_elements(COALESCE(requirements_files, '[]'::jsonb)) AS item
      WHERE COALESCE(item->>'file_url', '') LIKE 'https://res.cloudinary.com/%'
    ),
    '[]'::jsonb
  )
WHERE (valid_id_url IS NOT NULL AND valid_id_url NOT LIKE 'https://res.cloudinary.com/%')
   OR (requirements_urls IS NOT NULL AND requirements_urls::text NOT LIKE '%res.cloudinary.com%')
   OR (requirements_files IS NOT NULL AND requirements_files::text NOT LIKE '%res.cloudinary.com%');
