// Best-effort cleanup of prior avatar versions after a successful new upload.
// Lists the folder in the `profile-photos` bucket, keeps only the file just
// uploaded, and removes any other object whose name starts with `avatar-`.
// Silent by design — failures never surface to the user since the new avatar
// is already live.
import { supabase } from '@/integrations/supabase/client';

export async function pruneOldAvatars(
  folder: string,
  keepFilename: string,
  bucket: string = 'profile-photos',
): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: 100 });
    if (error || !data?.length) return;
    const stale = data
      .filter(
        (f) =>
          f?.name &&
          f.name !== keepFilename &&
          /^avatar-.*\.(jpg|jpeg|png|webp)$/i.test(f.name),
      )
      .map((f) => `${folder}/${f.name}`);
    if (stale.length === 0) return;
    await supabase.storage.from(bucket).remove(stale);
  } catch {
    // best-effort; never block the upload flow
  }
}