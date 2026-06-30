import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Record one or more granular consents (terms / privacy) for the current user.
 * Captures policy version + IP + user-agent server-side so the audit trail
 * cannot be spoofed by the client.
 */
export const recordConsents = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      terms: z.object({ version: z.string().min(1).max(64) }).optional(),
      privacy: z.object({ version: z.string().min(1).max(64) }).optional(),
    })
      .refine(v => v.terms || v.privacy, 'at least one consent required')
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    // IP + user-agent are captured server-side inside the SECURITY DEFINER
    // RPC (from request.headers / inet_client_addr) so the audit trail
    // cannot be spoofed by the caller. We intentionally do not pass them.
    const supabase = context.supabase;
    const written: Array<{ type: 'terms' | 'privacy'; version: string }> = [];

    if (data.terms) {
      const { error } = await supabase.rpc('record_consent' as any, {
        _consent_type: 'terms',
        _policy_version: data.terms.version,
      });
      if (error) throw new Error(error.message);
      written.push({ type: 'terms', version: data.terms.version });
    }
    if (data.privacy) {
      const { error } = await supabase.rpc('record_consent' as any, {
        _consent_type: 'privacy',
        _policy_version: data.privacy.version,
      });
      if (error) throw new Error(error.message);
      written.push({ type: 'privacy', version: data.privacy.version });
    }

    return { ok: true, written };
  });