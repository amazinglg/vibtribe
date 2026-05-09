// @ts-nocheck
import React, { useState } from 'react';
import { Plus, Camera, Type, Music, Sparkles, Globe, Users, UserCheck, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


type VisibilityOption = 'all' | 'contacts' | 'selected';

const VISIBILITY_OPTIONS: { value: VisibilityOption; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All Users', desc: 'Everyone on VibeTribe', icon: Globe },
  { value: 'contacts', label: 'My Contacts', desc: 'Only people in your contacts', icon: Users },
  { value: 'selected', label: 'Selected Users', desc: 'Choose specific people', icon: UserCheck },
];

export default function StatusHero() {
  const [uploading, setUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityOption>('all');
  const { profile } = useAuth();

  const displayName = profile?.full_name || 'You';
  const avatarLetter = displayName[0]?.toUpperCase() || 'V';

  const handleUpload = async (type: string) => {
    setUploading(true);
    setShowOptions(false);
    await new Promise(r => setTimeout(r, 1000));
    setUploading(false);
  };

  const currentVisibility = VISIBILITY_OPTIONS.find(o => o.value === visibility)!;
  const VisibilityIcon = currentVisibility.icon;

  return (
    <div className="relative px-4 lg:px-8 pt-6 pb-4">
      {/* Subheading */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">Stories disappear after 24 hours</p>
        <div className="px-2.5 py-1 glass rounded-full flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles size={11} className="text-primary" />
          <span>Active</span>
        </div>
      </div>

      {/* My Status Card */}
      <div className="glass rounded-3xl border border-border p-5 mb-6 card-3d relative overflow-hidden">
        {/* Background gradient blob */}
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-32 h-32 gradient-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 gradient-cyan rounded-full blur-3xl" />
        </div>

        <div className="relative flex items-center gap-4">
          {/* My Status Ring */}
          <div className="relative flex-shrink-0">
            <div className="status-ring-active p-0.5 rounded-full">
              <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-xl border-2 border-background">
                {avatarLetter}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 gradient-primary rounded-full flex items-center justify-center border-2 border-background">
              <Plus size={12} className="text-white" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-base text-foreground">My Status</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tap to add a new status</p>

            {/* Visibility Selector */}
            <div className="relative mt-2">
              <button
                onClick={() => setShowVisibility(!showVisibility)}
                className="flex items-center gap-1.5 px-2.5 py-1 glass rounded-lg border border-border hover:border-primary/40 transition-all text-xs"
              >
                <VisibilityIcon size={11} className="text-primary" />
                <span className="text-foreground font-medium">{currentVisibility.label}</span>
                <ChevronDown size={11} className="text-muted-foreground" />
              </button>

              {showVisibility && (
                <div className="absolute left-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 w-52 max-h-[60vh] overflow-y-auto glass-strong rounded-xl border border-border shadow-card py-1 z-[100] float-up">
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Who can see this status?
                  </p>
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setVisibility(opt.value); setShowVisibility(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors ${
                          visibility === opt.value ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        <Icon size={15} className={visibility === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                        <div className="text-left">
                          <p className="text-xs font-semibold">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                        </div>
                        {visibility === opt.value && (
                          <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Add Status Button */}
          <div className="relative">
            <button
              onClick={() => setShowOptions(!showOptions)}
              disabled={uploading}
              className="gradient-primary text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-semibold text-sm hover:opacity-90 transition-all glow-primary disabled:opacity-60"
            >
              {uploading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Plus size={16} />
              )}
              <span>{uploading ? 'Posting...' : 'Add Status'}</span>
            </button>

            {showOptions && (
              <div className="absolute right-0 top-full mt-2 w-44 glass-strong rounded-xl border border-border shadow-card py-1 z-20 float-up">
                {[
                  { icon: Camera, label: 'Photo / Video', type: 'media' },
                  { icon: Type, label: 'Text Status', type: 'text' },
                  { icon: Music, label: 'Music Status', type: 'music' },
                  { icon: Sparkles, label: 'AI Status', type: 'ai' },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={`status-opt-${opt.type}`}
                      onClick={() => handleUpload(opt.type)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Icon size={16} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}