REVOKE ALL ON FUNCTION public.messages_write_tombstone() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.messages_touch_updated_at() FROM PUBLIC, anon, authenticated;