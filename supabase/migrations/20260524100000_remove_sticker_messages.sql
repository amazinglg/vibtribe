-- Remove image-sticker messages created by the previous boys/girls sticker picker.
DELETE FROM public.messages WHERE content LIKE '%/stickers/%';
