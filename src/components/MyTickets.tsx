import React, { useState, useEffect } from 'react';
import { Ticket, Clock, CheckCircle2, AlertCircle, ChevronDown, MessageSquare, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SupportTicket {
  id: string;
  name: string;
  email: string;
  issue_title: string;
  issue_description: string;
  ticket_status: 'open' | 'inprocess' | 'solved';
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400', icon: <AlertCircle size={12} /> },
  inprocess: { label: 'In Process', color: 'bg-vt-amber/20 text-vt-amber', icon: <Clock size={12} /> },
  solved: { label: 'Solved', color: 'bg-vt-green/20 text-vt-green', icon: <CheckCircle2 size={12} /> },
};

export default function MyTickets() {
  const { user } = useAuth();
  const supabase = createClient();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadTickets();
  }, [user]);

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setTickets(data || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="glass rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <Ticket size={16} className="text-primary" />
          My Support Tickets
        </h3>
        <button onClick={loadTickets} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-6">
          <Ticket size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No support tickets yet</p>
          <p className="text-xs text-muted-foreground mt-1">Use the Help button to submit a request</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const cfg = STATUS_CONFIG[ticket.ticket_status] || STATUS_CONFIG.open;
            const isExpanded = expanded === ticket.id;
            return (
              <div key={ticket.id} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : ticket.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{ticket.issue_title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ticket.admin_reply && (
                      <span className="flex items-center gap-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        <MessageSquare size={9} />Reply
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Your Issue</p>
                      <p className="text-sm text-foreground bg-muted/50 rounded-lg p-2.5">{ticket.issue_description}</p>
                    </div>
                    {ticket.admin_reply && (
                      <div>
                        <p className="text-xs text-primary mb-1 font-medium">Admin Reply</p>
                        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5">
                          <p className="text-sm text-foreground">{ticket.admin_reply}</p>
                          {ticket.replied_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(ticket.replied_at).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
