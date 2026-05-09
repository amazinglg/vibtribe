// @ts-nocheck
import React from 'react';
import { Mic, Camera, Bell, HardDrive, ShieldCheck } from 'lucide-react';

interface PermissionItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  status: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'idle';
}

interface PermissionPromptProps {
  title: string;
  subtitle?: string;
  permissions: PermissionItem[];
  onAllow: () => void;
  onDeny: () => void;
  allowLabel?: string;
  denyLabel?: string;
}

export default function PermissionPrompt({
  title,
  subtitle,
  permissions,
  onAllow,
  onDeny,
  allowLabel = 'Allow',
  denyLabel = 'Not Now',
}: PermissionPromptProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl glass-strong border border-border p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Permission list */}
        <div className="flex flex-col gap-3 mb-6">
          {permissions.map((perm, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                {perm.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{perm.label}</span>
                  {perm.status === 'granted' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Granted</span>
                  )}
                  {perm.status === 'denied' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">Denied</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onDeny}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            {denyLabel}
          </button>
          <button
            onClick={onAllow}
            className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all glow-primary"
          >
            {allowLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { Mic, Camera, Bell, HardDrive };
