// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import {
  ArrowLeft, Mail, Plus, Send, Eye, Loader2, Trash2,
  Smartphone, Monitor, Image as ImageIcon, Users, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, ExternalLink, Pencil,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import {
  listCampaigns, saveCampaign, sendTestEmail, sendCampaign,
  previewAudienceSize, deleteCampaign, getCampaign,
} from '@/lib/marketing.functions'
import RichTextEditor from '@/components/RichTextEditor'
import { supabase } from '@/integrations/supabase/client'

type AudienceType = 'opted_in'

const BRAND_LOGO_URL = '/assets/images/app_logo.png'
const BRAND_SITE_URL = 'https://www.vibtribe.in/'
const BRAND_HELP_EMAIL = 'help.vibtribe.in@gmail.com'

export default function MarketingPage() {
  const router = useNavigate()
  const { user, profile, loading, isAdmin } = useAuth()
  const canAccess = !!profile?.is_master_admin || profile?.role === 'admin' || !!isAdmin

  const listFn = useServerFn(listCampaigns)
  const saveFn = useServerFn(saveCampaign)
  const sendTestFn = useServerFn(sendTestEmail)
  const sendFn = useServerFn(sendCampaign)
  const audienceFn = useServerFn(previewAudienceSize)
  const deleteFn = useServerFn(deleteCampaign)
  const getFn = useServerFn(getCampaign)

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [view, setView] = useState<'list' | 'compose' | 'report'>('list')
  const [activeCampaign, setActiveCampaign] = useState<any | null>(null)
  const [recipients, setRecipients] = useState<any[]>([])

  // Composer state
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [contentHtml, setContentHtml] = useState('<p>Hi there,</p>\n<p>Write your update here.</p>')
  const [bannerUrl, setBannerUrl] = useState('')
  const [audience, setAudience] = useState<AudienceType>('opted_in')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmDeleteCampaign, setConfirmDeleteCampaign] = useState<any | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  async function handleBannerFile(file: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please pick an image file'); return }
    if (file.size > 4 * 1024 * 1024) { toast.error('Image too large (max 4 MB)'); return }
    setUploadingBanner(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${user?.id || 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('marketing-banners')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr
      // 10-year signed URL (long enough that emails stay valid indefinitely)
      const { data: signed, error: sErr } = await supabase.storage
        .from('marketing-banners')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)
      if (sErr || !signed?.signedUrl) throw sErr || new Error('Could not generate URL')
      setBannerUrl(signed.signedUrl)
      toast.success('Banner uploaded')
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally { setUploadingBanner(false) }
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router({ to: '/sign-in', replace: true }); return }
    if (!canAccess) { router({ to: '/admin', replace: true }); return }
    refresh()
  }, [user, loading, profile])

  async function refresh() {
    setLoadingList(true)
    try {
      const r = await listFn()
      setCampaigns(r.campaigns)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load campaigns')
    } finally { setLoadingList(false) }
  }

  function startNew() {
    setEditingId(null)
    setSubject(''); setPreheader(''); setContentHtml('<p>Hi there,</p>\n<p>Write your update here.</p>')
    setBannerUrl(''); setAudience('opted_in'); setAudienceCount(null)
    setView('compose')
  }

  async function editDraft(c: any) {
    // Always fetch the latest version from the server so we don't open a
    // stale (already-deleted) draft and then fail on send with "Campaign not found".
    try {
      const r = await getFn({ data: { id: c.id } })
      const fresh = r.campaign
      setEditingId(fresh.id)
      setSubject(fresh.subject || '')
      setPreheader(fresh.preheader || '')
      setContentHtml(fresh.content_html || '')
      setBannerUrl(fresh.banner_image_url || '')
      setAudience((fresh.audience_filter?.type as AudienceType) || 'opted_in')
      setAudienceCount(null)
      setView('compose')
    } catch (e: any) {
      toast.error(e?.message || 'Could not open draft — it may have been deleted')
      await refresh()
    }
  }

  async function refreshAudience() {
    try {
      const r = await audienceFn({ data: { audienceFilter: { type: audience } } })
      setAudienceCount(r.count)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to count audience')
    }
  }

  useEffect(() => { if (view === 'compose') refreshAudience() }, [audience, view])

  async function handleSave(silent = false): Promise<string | null> {
    if (!subject.trim()) { toast.error('Subject is required'); return null }
    if (!contentHtml.trim()) { toast.error('Email body is required'); return null }
    setSaving(true)
    try {
      const r = await saveFn({ data: {
        id: editingId || undefined,
        subject: subject.trim(),
        preheader: preheader.trim() || null,
        contentHtml,
        bannerImageUrl: bannerUrl.trim() || null,
        audienceFilter: { type: audience },
      } })
      setEditingId(r.campaign.id)
      if (!silent) toast.success('Draft saved')
      return r.campaign.id
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save')
      return null
    } finally { setSaving(false) }
  }

  async function handleSendTest() {
    const id = editingId || await handleSave(true)
    if (!id) return
    const adminEmail = (profile as any)?.real_email || (profile as any)?.email
    if (!adminEmail) { toast.error('No email on your profile to test-send to'); return }
    setSending(true)
    try {
      const r = await sendTestFn({ data: { campaignId: id, toEmail: adminEmail } })
      toast.success(`Test sent to ${adminEmail} from ${r.from}`)
    } catch (e: any) {
      toast.error(e?.message || 'Test send failed')
    } finally { setSending(false) }
  }

  async function handleSendAll() {
    const id = editingId || await handleSave(true)
    if (!id) return
    setSending(true); setConfirmSend(false)
    try {
      const r = await sendFn({ data: { campaignId: id } })
      toast.success(`Campaign sent: ${r.sent} delivered, ${r.failed} failed, ${r.skipped} skipped`)
      setView('list'); refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Send failed')
    } finally { setSending(false) }
  }

  async function openReport(c: any) {
    setActiveCampaign(c); setView('report')
    try {
      const r = await getFn({ data: { id: c.id } })
      setActiveCampaign(r.campaign); setRecipients(r.recipients)
    } catch (e: any) { toast.error(e?.message || 'Failed to load report') }
  }

  async function handleDelete(c: any) {
    const prev = campaigns
    setCampaigns(cs => cs.filter(x => x.id !== c.id)) // optimistic
    setConfirmDeleteCampaign(null)
    try {
      const r = await deleteFn({ data: { id: c.id } })
      if (!r?.deleted) throw new Error('Campaign was not deleted. Please refresh and try again.')
      toast.success('Deleted')
      await refresh()
    } catch (e: any) {
      setCampaigns(prev)
      toast.error(e?.message || 'Delete failed')
    }
  }

  const previewHtml = useMemo(() => {
    return `<!doctype html><html><body style="margin:0;padding:32px 16px;font-family:-apple-system,sans-serif;background:#f5f0e8;color:#1f1d1a;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="padding:0 4px 18px 4px;display:flex;align-items:center;gap:10px;">
          <img src="${BRAND_LOGO_URL}" alt="VibTribe logo" style="width:34px;height:34px;border-radius:10px;display:block;" />
          <span style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1f1d1a;">VibTribe</span>
        </div>
        <div style="background:#ffffff;border:1px solid #e8e1d5;border-radius:14px;overflow:hidden;">
          ${bannerUrl ? `<img src="${bannerUrl}" style="display:block;width:100%;" />` : ''}
          <div style="padding:36px;font-size:16px;line-height:1.7;">
            ${contentHtml}
            <div style="margin-top:32px;padding-top:24px;border-top:1px solid #efe7dc;">
              <p style="margin:0 0 14px 0;font-family:Georgia,serif;font-size:22px;line-height:1.25;font-weight:700;color:#1f1d1a;">Thanks,</p>
              <div style="display:flex;align-items:center;gap:14px;">
                <img src="${BRAND_LOGO_URL}" alt="VibTribe logo" style="width:46px;height:46px;border-radius:13px;display:block;" />
                <div>
                  <p style="margin:0;font-size:18px;line-height:1.2;font-weight:800;color:#1f1d1a;">VibTribe</p>
                  <p style="margin:4px 0 0 0;font-size:13px;line-height:1.4;color:#7a7468;">Where your vibe finds its tribe</p>
                </div>
              </div>
              <p style="margin:16px 0 0 0;font-size:13px;line-height:1.8;color:#7a7468;">
                <a href="${BRAND_SITE_URL}" style="color:#1f1d1a;text-decoration:none;font-weight:700;">www.vibtribe.in</a><br />
                Email - <a href="mailto:${BRAND_HELP_EMAIL}" style="color:#1f1d1a;text-decoration:none;font-weight:700;">${BRAND_HELP_EMAIL}</a>
              </p>
            </div>
          </div>
        </div>
        <div style="padding:22px 8px 0 8px;font-size:12px;line-height:1.7;color:#7a7468;">
          <p style="margin:0 0 6px 0;">You're receiving this because you opted in to product updates from VibTribe.</p>
          <p style="margin:0 0 10px 0;">VibTribe · India</p>
          <p style="margin:0;"><a href="#" style="color:#1f1d1a;text-decoration:underline;">Unsubscribe in one click</a> · <a href="#" style="color:#1f1d1a;text-decoration:underline;">Privacy</a></p>
        </div>
      </div>
    </body></html>`
  }, [contentHtml, bannerUrl])

  if (loading) {
    return <AppLayout><div className="p-12 text-center text-muted-foreground">Loading…</div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router({ to: '/admin' })} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center">
              <Mail size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-foreground">Marketing Emails</h1>
              <p className="text-xs text-muted-foreground">Promotional campaigns via Resend · news.vibtribe.in</p>
            </div>
          </div>
          <button onClick={refresh} className="ml-auto p-2 glass rounded-xl text-muted-foreground hover:text-foreground">
            <RefreshCw size={18} />
          </button>
        </div>

        {view === 'list' && (() => {
          const drafts = campaigns.filter(c => c.status === 'draft')
          const sent = campaigns.filter(c => c.status !== 'draft')
          const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-end gap-2">
                <button onClick={startNew} className="gradient-primary text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 glow-primary">
                  <Plus size={16} /> New Campaign
                </button>
              </div>

              {/* DRAFTS */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Pencil size={14} className="text-muted-foreground" />
                  <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">Drafts</h2>
                  <span className="text-xs text-muted-foreground">({drafts.length})</span>
                </div>
                <div className="glass rounded-2xl border border-border overflow-hidden">
                  {loadingList ? (
                    <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
                  ) : drafts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No drafts. Click "New Campaign" to start one.</div>
                  ) : drafts.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-4 border-b border-border/30 hover:bg-muted/40">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.subject || '(no subject)'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Last edited {fmt(c.updated_at || c.created_at)} · by {c.created_by_name}
                        </p>
                      </div>
                      <button onClick={() => editDraft(c)} title="Edit & send"
                        className="p-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25" aria-label="Edit draft">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(c)} className="p-2 text-muted-foreground hover:text-red-400" aria-label="Delete draft">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* SENT */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Send size={14} className="text-muted-foreground" />
                  <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">Sent Campaigns</h2>
                  <span className="text-xs text-muted-foreground">({sent.length})</span>
                </div>
                <div className="glass rounded-2xl border border-border overflow-hidden">
                  {loadingList ? null : sent.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No campaigns sent yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="text-left px-4 py-2 font-semibold">Subject</th>
                            <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">Sent</th>
                            <th className="text-left px-4 py-2 font-semibold">Audience</th>
                            <th className="text-left px-4 py-2 font-semibold">Sent by</th>
                            <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">Recipients</th>
                            <th className="text-left px-4 py-2 font-semibold">Status</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sent.map(c => (
                            <tr key={c.id} className="border-t border-border/30 hover:bg-muted/30">
                              <td className="px-4 py-3 max-w-[260px] truncate font-medium text-foreground">{c.subject}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(c.sent_at || c.updated_at || c.created_at)}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">Opted-in</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{c.created_by_name}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {c.sent_count}/{c.total_recipients}
                                {c.failed_count > 0 && <span className="text-red-400"> · {c.failed_count} failed</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  c.status === 'sent' ? 'bg-vt-green/20 text-vt-green' :
                                  c.status === 'sending' ? 'bg-vt-amber/20 text-vt-amber' :
                                  c.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                  'bg-muted text-muted-foreground'
                                }`}>{c.status}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button onClick={() => openReport(c)} className="px-2 py-1 text-xs rounded-lg bg-muted hover:bg-primary/20 hover:text-primary inline-flex items-center gap-1">
                                  <Eye size={12} /> Report
                                </button>
                                <button onClick={() => handleDelete(c)} className="p-1.5 ml-1 text-muted-foreground hover:text-red-400 align-middle">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )
        })()}

        {view === 'compose' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <button onClick={() => setView('list')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft size={12} /> Back to campaigns
              </button>

              <div className="glass rounded-2xl border border-border p-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Subject</span>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="VibTribe — what's new this week"
                    className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-lg text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Preheader (preview text)</span>
                  <input value={preheader} onChange={e => setPreheader(e.target.value)} placeholder="A short summary shown in the inbox"
                    className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-lg text-sm" />
                </label>
                <div className="block">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <ImageIcon size={12} /> Banner image (optional)
                  </span>
                  {bannerUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-border">
                      <img src={bannerUrl} alt="banner" className="w-full h-32 object-cover" />
                      <button onClick={() => setBannerUrl('')} type="button"
                        className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded-md hover:bg-black/90 flex items-center gap-1">
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition">
                      <ImageIcon size={20} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {uploadingBanner ? 'Uploading…' : 'Click to upload from your device (max 4 MB)'}
                      </span>
                      <input type="file" accept="image/*" className="hidden"
                        disabled={uploadingBanner}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerFile(f); e.target.value = '' }} />
                    </label>
                  )}
                </div>
                <div className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Email body</span>
                  <div className="mt-1 bg-input border border-border rounded-lg overflow-hidden">
                    <RichTextEditor value={contentHtml} onChange={setContentHtml} />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Format using the toolbar — bold, italic, headings, lists, links, images, alignment, colors. The branded VibTribe wrapper and footer are added automatically.
                  </span>
                </div>
              </div>

              <div className="glass rounded-2xl border border-border p-4 space-y-2">
                <div className="flex items-center gap-2"><Users size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Audience</span></div>
                <div className="w-full px-3 py-2 bg-input/60 border border-border rounded-lg text-sm text-foreground flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-vt-green" />
                  Opted-in users only
                </div>
                <p className="text-xs text-muted-foreground">
                  {audienceCount === null
                    ? 'Counting…'
                    : <>This will send to <strong className="text-foreground">{audienceCount.toLocaleString()}</strong> recipients.</>}
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl text-sm font-semibold">
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button onClick={handleSendTest} disabled={sending}
                  className="flex-1 px-4 py-2.5 bg-vt-cyan/20 text-vt-cyan border border-vt-cyan/40 hover:bg-vt-cyan/30 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Test to Me
                </button>
                <button onClick={() => setConfirmSend(true)} disabled={sending || audienceCount === 0}
                  className="flex-1 gradient-primary text-white rounded-xl text-sm font-semibold glow-primary py-2.5 flex items-center justify-center gap-2">
                  <Send size={14} /> Send to All
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
                <div className="flex gap-1 bg-muted p-1 rounded-lg">
                  <button onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded ${previewDevice === 'desktop' ? 'bg-background text-foreground' : 'text-muted-foreground'}`}>
                    <Monitor size={14} /></button>
                  <button onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded ${previewDevice === 'mobile' ? 'bg-background text-foreground' : 'text-muted-foreground'}`}>
                    <Smartphone size={14} /></button>
                </div>
              </div>
              <div className="glass rounded-2xl border border-border p-3 flex justify-center">
                <iframe title="preview" srcDoc={previewHtml}
                  className="bg-background rounded-lg border border-border"
                  style={{ width: previewDevice === 'mobile' ? 375 : '100%', height: 600 }} />
              </div>
            </div>
          </div>
        )}

        {view === 'report' && activeCampaign && (
          <div className="space-y-4">
            <button onClick={() => setView('list')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft size={12} /> Back
            </button>
            <div className="glass rounded-2xl border border-border p-5">
              <h2 className="font-bold text-lg text-foreground">{activeCampaign.subject}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'Total', value: activeCampaign.total_recipients, icon: Users },
                  { label: 'Sent', value: activeCampaign.sent_count, icon: CheckCircle2, color: 'text-vt-green' },
                  { label: 'Failed', value: activeCampaign.failed_count, icon: AlertTriangle, color: 'text-red-400' },
                  { label: 'Sent at', value: activeCampaign.sent_at ? new Date(activeCampaign.sent_at).toLocaleString('en-IN') : '—', icon: Clock },
                ].map((s: any) => (
                  <div key={s.label} className="bg-muted/50 rounded-xl p-3">
                    <s.icon size={14} className={s.color || 'text-muted-foreground'} />
                    <p className="text-lg font-bold text-foreground mt-1">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl border border-border overflow-hidden">
              <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                Recipients ({recipients.length})
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {recipients.map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-4 py-2 border-b border-border/20 text-xs">
                    <span className="flex-1 truncate text-foreground">{r.email}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${
                      r.status === 'sent' ? 'bg-vt-green/20 text-vt-green' :
                      r.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      r.status === 'skipped_suppressed' ? 'bg-vt-amber/20 text-vt-amber' :
                      'bg-muted text-muted-foreground'
                    }`}>{r.status}</span>
                    {r.error_message && <span className="text-muted-foreground/70 truncate max-w-[200px]" title={r.error_message}>{r.error_message}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {confirmSend && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmSend(false)}>
            <div className="glass-strong rounded-2xl border border-border p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle size={24} className="text-vt-amber" />
                <h3 className="font-bold text-lg text-foreground">Send to {audienceCount?.toLocaleString() || '?'} recipients?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This will send the email to all matching users via Resend. Sending takes ~{Math.ceil((audienceCount || 0) / 10)} seconds.
                You cannot recall messages once sent.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSend(false)} className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm font-semibold">Cancel</button>
                <button onClick={handleSendAll} disabled={sending} className="flex-1 gradient-primary text-white rounded-xl text-sm font-semibold py-2 glow-primary">
                  {sending ? 'Sending…' : 'Send Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteCampaign && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDeleteCampaign(null)}>
            <div className="glass-strong rounded-2xl border border-border p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <Trash2 size={24} className="text-vt-red" />
                <h3 className="font-bold text-lg text-foreground">Delete this campaign?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                “{confirmDeleteCampaign.subject || '(no subject)'}” will be permanently removed. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteCampaign(null)} className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm font-semibold">Cancel</button>
                <button onClick={() => handleDelete(confirmDeleteCampaign)} className="flex-1 bg-vt-red/20 text-vt-red border border-vt-red/40 hover:bg-vt-red/30 rounded-xl text-sm font-semibold py-2">
                  Delete forever
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}