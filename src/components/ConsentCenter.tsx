import React, { useEffect, useState } from 'react';
import { Shield, Loader2, Check, X as XIcon, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { requestDataExport } from '@/lib/data-export.functions';

type Purpose = {
  key: string;
  label: string;
  description: string;
  defaultGranted: boolean;
};

const PURPOSES: Purpose[] = [
  {
    key: 'contacts_matching',
    label: 'Contacts matching',
    description:
      'Allow VibTribe to match your address book against existing users (numbers are hashed on your device first).',
    defaultGranted: true,
  },
  {
    key: 'photo_visibility_public',
    label: 'Public profile photo',
    description: 'Show your profile photo to anyone who can see your profile.',
    defaultGranted: true,
  },
  {
    key: 'last_seen_visible',
    label: 'Show last-seen',
    description: 'Let your contacts see when you were last active.',
    defaultGranted: true,
  },
  {
    key: 'marketing_email',
    label: 'Marketing emails',
    description: 'Receive product updates, tips and announcements by email.',
    defaultGranted: false,
  },
  {
    key: 'marketing_push',
    label: 'Marketing push notifications',
    description: 'Receive product announcements as push notifications.',
    defaultGranted: false,
  },
  {
    key: 'analytics',
    label: 'Anonymised analytics',
    description:
      'Allow anonymised usage analytics to help us improve the app. No message content is ever sent.',
    defaultGranted: false,
  },
  {
    key: 'notification_messages',
    label: 'Message notifications',
    description: 'Get notified when you receive a new direct message.',
    defaultGranted: true,
  },
  {
    key: 'notification_calls',
    label: 'Call notifications',
    description: 'Get notified for incoming voice and video calls.',
    defaultGranted: true,
  },
  {
    key: 'notification_tribes',
    label: 'Tribe notifications',
    description: 'Get notified for new messages in your tribes and broadcasts.',
    defaultGranted: true,
  },
  {
    key: 'notification_status',
    label: 'Status notifications',
    description: 'Get notified when contacts post new status updates.',
    defaultGranted: false,
  },
];

export default function ConsentCenter() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const exportFn = useServerFn(requestDataExport);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('user_consents' as any)
          .select('purpose, granted');
        const map: Record<string, boolean> = {};
        for (const p of PURPOSES) map[p.key] = p.defaultGranted;
        for (const row of (data || []) as any[]) {
          if (row?.purpose in map) map[row.purpose] = !!row.granted;
        }
        setState(map);
      } catch (e) {
        // fall back to defaults
        const map: Record<string, boolean> = {};
        for (const p of PURPOSES) map[p.key] = p.defaultGranted;
        setState(map);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggle(p: Purpose, next: boolean) {
    setSaving(p.key);
    const prev = state[p.key];
    setState(s => ({ ...s, [p.key]: next }));
    try {
      const { error } = await supabase.rpc('set_user_consent' as any, {
        _purpose: p.key,
        _granted: next,
        _source: 'consent_center',
      });
      if (error) throw error;
      toast.success(
        next ? `Enabled "${p.label}"` : `Disabled "${p.label}"`,
      );
    } catch (err: any) {
      setState(s => ({ ...s, [p.key]: prev }));
      toast.error(err?.message || 'Could not save preference');
    } finally {
      setSaving(null);
    }
  }

  async function onExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const res: any = await exportFn();
      toast.success(`Export emailed to ${res?.email || 'your account email'}.`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate export right now.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="glass rounded-2xl border border-border p-5">
      <h3 className="font-semibold text-base text-foreground mb-2 flex items-center gap-2">
        <Shield size={16} className="text-primary" />
        Consent Center
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Granular control over how VibTribe uses your data. Changes apply
        immediately and are logged for compliance with India's DPDP Act, 2023.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {PURPOSES.map(p => {
            const on = !!state[p.key];
            const isSaving = saving === p.key;
            return (
              <div
                key={p.key}
                className="flex items-start justify-between gap-3 p-3 bg-muted/50 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.description}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => toggle(p, !on)}
                  className={`shrink-0 inline-flex items-center justify-center h-7 w-12 rounded-full transition-colors ${
                    on ? 'bg-primary' : 'bg-muted-foreground/30'
                  } ${isSaving ? 'opacity-60' : ''}`}
                  aria-label={`${p.label} ${on ? 'enabled' : 'disabled'}`}
                  aria-pressed={on}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white flex items-center justify-center transition-transform ${
                      on ? 'translate-x-2.5' : '-translate-x-2.5'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 size={12} className="animate-spin text-foreground/60" />
                    ) : on ? (
                      <Check size={12} className="text-primary" />
                    ) : (
                      <XIcon size={12} className="text-muted-foreground" />
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Download size={14} className="text-primary" />
              Download my data
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get a JSON copy of everything VibTribe stores about your account,
              emailed to your registered address. Available once every 30 days.
            </p>
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exporting ? 'Preparing…' : 'Request'}
          </button>
        </div>
      </div>
    </div>
  );
}