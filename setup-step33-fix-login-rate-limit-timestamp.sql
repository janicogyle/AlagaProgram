-- Fix the CURRENT_TIME keyword collision without changing existing attempt records.
BEGIN;
CREATE OR REPLACE FUNCTION public.record_beneficiary_login_failure(
  p_key_hash text,
  p_max_attempts integer,
  p_window_seconds integer DEFAULT 900,
  p_lockout_seconds integer DEFAULT 900
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_row public.beneficiary_login_rate_limits%ROWTYPE;
  inserted_count integer := 0;
  next_attempts integer;
  v_now timestamptz := now();
BEGIN
  INSERT INTO public.beneficiary_login_rate_limits (
    key_hash,
    attempts,
    window_started_at,
    locked_until,
    updated_at
  ) VALUES (p_key_hash, 1, v_now, NULL, v_now)
  ON CONFLICT (key_hash) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN
    RETURN;
  END IF;

  SELECT * INTO current_row
  FROM public.beneficiary_login_rate_limits
  WHERE key_hash = p_key_hash
  FOR UPDATE;

  IF current_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN
    UPDATE public.beneficiary_login_rate_limits
    SET attempts = 1,
        window_started_at = v_now,
        locked_until = NULL,
        updated_at = v_now
    WHERE key_hash = p_key_hash;
    RETURN;
  END IF;

  next_attempts := current_row.attempts + 1;
  UPDATE public.beneficiary_login_rate_limits
  SET attempts = next_attempts,
      locked_until = CASE
        WHEN next_attempts >= p_max_attempts
          THEN v_now + make_interval(secs => p_lockout_seconds)
        ELSE current_row.locked_until
      END,
      updated_at = v_now
  WHERE key_hash = p_key_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.record_beneficiary_login_failure(text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_beneficiary_login_failure(text, integer, integer, integer) TO service_role;

COMMIT;
