// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MessageCircle, Phone, AtSign, Mail, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from '@tanstack/react-router';
import { useChatStore } from '@/store/chatStore';

interface SearchUser {
  id: string;
  full_name: string;
  username?: string;
  mobile_number?: string;
  email?: string;
  is_online?: boolean;
}

export default function GlobalSearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const supabase = createClient();
  const router = useNavigate();
  const { setSelectedChatId } = useChatStore();

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Only search when the user enters a complete identifier:
  //   - a 10+ digit phone number, or
  //   - a username/handle (e.g. starting with @, or 3+ alphanumeric chars matched exactly)
  const isCompleteQuery = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return false;
    const digits = trimmed.replace(/\D/g, '');
    // Phone: at least 10 digits
    if (digits.length >= 10) return true;
    // Username: starts with @ and has 3+ chars, OR is a clean alphanumeric handle of 3+ chars
    if (trimmed.startsWith('@') && trimmed.length >= 4) return true;
    return false;
  };

  useEffect(() => {
    if (!isCompleteQuery(query)) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => searchUsers(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchUsers = async (q: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const digits = q.replace(/\D/g, '');
      const handle = q.startsWith('@') ? q.slice(1) : q;

      let filter = '';
      if (digits.length >= 10) {
        // Match phone exactly (last 10 digits) or by suffix
        filter = `mobile_number.ilike.%${digits}%`;
      } else {
        // Exact username match (case-insensitive)
        filter = `username.eq.${handle},username.ilike.${handle}`;
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, mobile_number, is_online')
        .neq('id', user.id)
        .or(filter)
        .limit(10);
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (targetUser: SearchUser) => {
    if (!user) return;
    setStartingChat(targetUser.id);
    try {
      // Check if chat already exists
      const { data: existing } = await supabase
        .from('chats')
        .select('id')
        .or(
          `and(participant_one.eq.${user.id},participant_two.eq.${targetUser.id}),and(participant_one.eq.${targetUser.id},participant_two.eq.${user.id})`
        )
        .single();

      let chatId: string;
      if (existing) {
        chatId = existing.id;
      } else {
        const { data: newChat } = await supabase
          .from('chats')
          .insert({ participant_one: user.id, participant_two: targetUser.id, chat_type: 'normal' })
          .select()
          .single();
        chatId = newChat?.id;
      }

      if (chatId) {
        setSelectedChatId(chatId);
        router({ to: '/' });
      }
      setOpen(false);
      setQuery('');
      setResults([]);
    } catch {}
    setStartingChat(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 glass rounded-xl text-muted-foreground hover:text-foreground transition-all text-sm sm:min-w-[120px]"
        title="Search users"
      >
        <Search size={18} className="sm:w-4 sm:h-4" />
        <span className="hidden md:inline">Search users...</span>
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-md glass-strong rounded-2xl border border-border shadow-card z-50 float-up overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, username, phone, email..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); }} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin text-primary" />
              </div>
            )}

            {!loading && isCompleteQuery(query) && results.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No users found for "{query}"</p>
              </div>
            )}

            {!loading && !isCompleteQuery(query) && (
              <div className="py-6 text-center">
                <Search size={20} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Enter a full 10-digit phone number<br/>or an exact @username</p>
                <p className="text-xs text-muted-foreground mt-1">For privacy, partial name searches are disabled</p>
              </div>
            )}

            {!loading && results.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {(u.full_name || 'U')[0].toUpperCase()}
                  </div>
                  {u.is_online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-vt-green rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.full_name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {u.username && (
                      <span className="text-xs text-primary flex items-center gap-0.5">
                        <AtSign size={10} />
                        {u.username}
                      </span>
                    )}
                    {u.mobile_number && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Phone size={10} />
                        {u.mobile_number}
                      </span>
                    )}
                    {u.email && !u.email.endsWith('@vibetribe.app') && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Mail size={10} />
                        {u.email}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleStartChat(u)}
                  disabled={startingChat === u.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 gradient-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-60 flex-shrink-0"
                >
                  {startingChat === u.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <MessageCircle size={12} />
                  )}
                  Chat
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
