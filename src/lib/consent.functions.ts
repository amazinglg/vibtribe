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
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const mod: any = await import('@tanstack/react-start');
      const getHeader = mod.getRequestHeader;
      if (typeof getHeader === 'function') {
        const xff = (getHeader('x-forwarded-for') as string | undefined) || '';
        ip = (xff.split(',')[0] || (getHeader('cf-connecting-ip') as string | undefined) || '').trim() || null;
        userAgent = ((getHeader('user-agent') as string | undefined) || '').slice(0, 512) || null;
      }
    } catch { /* best-effort */ }

    const supabase = context.supabase;
    const written: Array<{ type: 'terms' | 'privacy'; version: string }> = [];

    if (data.terms) {
      const { error } = await supabase.rpc('record_consent' as any, {
        _consent_type: 'terms',
        _policy_version: data.terms.version,
        _ip: ip,
        _user_agent: userAgent,
      });
      if (error) throw new Error(error.message);
      written.push({ type: 'terms', version: data.terms.version });
    }
    if (data.privacy) {
      const { error } = await supabase.rpc('record_consent' as any, {
        _consent_type: 'privacy',
        _policy_version: data.privacy.version,
        _ip: ip,
        _user_agent: userAgent,
      });
      if (error) throw new Error(error.message);
      written.push({ type: 'privacy', version: data.privacy.version });
    }

    return { ok: true, written };
  });