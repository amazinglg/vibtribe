import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * DPDP §11 "Right to access" — generates a JSON export of the signed-in
 * user's personal data and emails it to their account email via Resend.
 * Rate-limited to one successful export per 30 days per user.
 */
export const requestDataExport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    // Rate-limit: 1 successful export per 30 days
    const { data: recent } = await supabase
      .from('data_export_requests')
      .select('id, created_at, status')
      .eq('user_id', userId)
      .in('status', ['queued', 'sent'])
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      throw new Error(
        'You already requested a data export in the last 30 days. Please check your inbox or try again later.',
      );
    }

    // Use service role for read+write across multiple tables
    const { supabaseAdmin: _admin } = await import('@/integrations/supabase/client.server');
    const supabaseAdmin: any = _admin;

    // Create queued row first so we always have an audit record
    const { data: reqRow, error: insErr } = await supabaseAdmin
      .from('data_export_requests')
      .insert({ user_id: userId, status: 'queued' })
      .select('id')
      .single();
    if (insErr || !reqRow) throw new Error(insErr?.message || 'Could not queue export');
    const reqId = reqRow.id as string;

    try {
      // Pull account email
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (!email) throw new Error('No email on file for this account');

      // Collect personal data (best-effort — missing tables don't fail the export)
      async function safeSelect(table: string, query: (q: any) => any) {
        try {
          const { data } = await query(supabaseAdmin.from(table).select('*'));
          return data || [];
        } catch {
          return [];
        }
      }

      const [profile, consents, consentHistory, contacts, blocked, sessions, fcm, push, supportTickets, notifications] = await Promise.all([
        safeSelect('user_profiles', q => q.eq('id', userId)),
        safeSelect('user_consents', q => q.eq('user_id', userId)),
        safeSelect('consent_log', q => q.eq('user_id', userId)),
        safeSelect('contacts', q => q.eq('owner_id', userId)),
        safeSelect('blocked_users', q => q.eq('blocker_id', userId)),
        safeSelect('user_sessions', q => q.eq('user_id', userId)),
        safeSelect('fcm_tokens', q => q.eq('user_id', userId)),
        safeSelect('push_subscriptions', q => q.eq('user_id', userId)),
        safeSelect('support_tickets', q => q.eq('user_id', userId)),
        safeSelect('notifications', q => q.eq('user_id', userId)),
      ]);

      const exportPayload = {
        export_metadata: {
          generated_at: new Date().toISOString(),
          user_id: userId,
          email,
          notice:
            'This file contains personal data we store about your VibTribe account. Message bodies are end-to-end encrypted and can only be read on your authorised devices, so they are not included here in plaintext.',
        },
        profile,
        consents,
        consent_history: consentHistory,
        saved_contacts: contacts,
        blocked_users: blocked,
        sessions,
        push_tokens: { fcm, web_push: push },
        support_tickets: supportTickets,
        notifications,
      };

      const json = JSON.stringify(exportPayload, null, 2);
      const bytes = new TextEncoder().encode(json);
      // base64 for Resend attachment
      let b64 = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        b64 += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
      }
      const base64 = (typeof btoa === 'function' ? btoa(b64) : Buffer.from(b64, 'binary').toString('base64'));

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error('Email provider not configured');

      const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0F172A;color:#E2E8F0;padding:24px">
        <h2 style="color:#fff">Your VibTribe data export</h2>
        <p>Hi there,</p>
        <p>Attached is a JSON export of the personal data we store about your VibTribe account, as required by India's Digital Personal Data Protection Act, 2023.</p>
        <p>If you didn't request this, please contact us at <a href="mailto:help.vibtribe.in@gmail.com" style="color:#60A5FA">help.vibtribe.in@gmail.com</a> immediately.</p>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px">Request ID: ${reqId}</p>
      </body></html>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: 'VibTribe <promotions@news.vibtribe.in>',
          to: [email],
          subject: 'Your VibTribe data export (DPDP request)',
          html,
          attachments: [
            { filename: `vibtribe-data-export-${reqId}.json`, content: base64 },
          ],
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Email send failed: ${res.status} ${txt.slice(0, 200)}`);
      }

      await supabaseAdmin
        .from('data_export_requests')
        .update({
          status: 'sent',
          delivered_to_email: email,
          byte_size: bytes.length,
          completed_at: new Date().toISOString(),
        })
        .eq('id', reqId);

      return { ok: true, email, bytes: bytes.length };
    } catch (err: any) {
      await supabaseAdmin
        .from('data_export_requests')
        .update({ status: 'failed', error: String(err?.message || err).slice(0, 500) })
        .eq('id', reqId);
      throw err;
    }
  });