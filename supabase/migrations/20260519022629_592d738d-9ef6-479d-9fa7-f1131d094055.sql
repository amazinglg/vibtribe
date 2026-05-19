CREATE OR REPLACE FUNCTION public.cleanup_expired_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.statuses
  WHERE expires_at <= now();
END;
$$;

SELECT cron.schedule(
  'cleanup-expired-statuses',
  '*/30 * * * *',
  $$SELECT public.cleanup_expired_statuses();$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-statuses'
);