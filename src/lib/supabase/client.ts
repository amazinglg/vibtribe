// Compat wrapper preserving the original `createClient()` API used across pages.
import { supabase } from '@/integrations/supabase/client';

export function createClient() {
  return supabase;
}