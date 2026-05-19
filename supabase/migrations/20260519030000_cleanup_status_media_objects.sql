CREATE OR REPLACE FUNCTION public.cleanup_expired_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM storage.objects object_row
  USING (
    SELECT
      split_part(
        substring(media_url from position('/status-media/' in media_url) + length('/status-media/')),
        '?',
        1
      ) AS object_name
    FROM public.statuses
    WHERE expires_at <= now()
      AND media_url IS NOT NULL
      AND position('/status-media/' in media_url) > 0
  ) expired_media
  WHERE object_row.bucket_id = 'status-media'
    AND object_row.name = expired_media.object_name;

  DELETE FROM public.statuses
  WHERE expires_at <= now();
END;
$$;
