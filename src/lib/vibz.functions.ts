import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const id = z.string().uuid()
const ensure = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

export const getVibzFeed = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((value: { cursor?: string; creatorId?: string }) => z.object({ cursor: z.string().datetime().optional(), creatorId: id.optional() }).parse(value))
  .handler(async ({ data, context }) => {
    if (data.creatorId) {
      const { data: posts, error } = await context.supabase.from('vibz_posts').select('id,creator_id,media_path,caption,created_at,status,likes_count,comments_count,shares_count').eq('creator_id',data.creatorId).order('created_at',{ascending:false}).limit(40)
      ensure(error)
      return posts ?? []
    }
    const { data: posts, error } = await context.supabase.rpc('vibz_feed', { _cursor: data.cursor, _limit: 20 })
    ensure(error)
    return posts ?? []
  })

export const getVibzProfile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((value: { id: string }) => z.object({ id }).parse(value))
  .handler(async ({ data, context }) => { const { data: profile, error } = await context.supabase.rpc('vibz_profile',{ _id: data.id }); ensure(error); return profile?.[0] ?? null })

export const searchVibzPeople = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((value: { query: string }) => z.object({ query: z.string().trim().max(80) }).parse(value))
  .handler(async ({ data, context }) => { const { data: profiles, error } = await context.supabase.rpc('vibz_search',{ _q: data.query }); ensure(error); return profiles ?? [] })

export const vibzMediaUrl = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((value: { postId: string }) => z.object({ postId: id }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: post, error } = await context.supabase.from('vibz_posts').select('media_path').eq('id',data.postId).single()
    ensure(error)
    if (!post) throw new Error('Video is not available')
    const { data: signed, error: signError } = await context.supabase.storage.from('vibz-media').createSignedUrl(post.media_path, 600)
    ensure(signError)
    return signed?.signedUrl ?? ''
  })

export const createVibz = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((value: { mediaPath: string; duration: number; caption: string }) => z.object({mediaPath:z.string().max(240),duration:z.number().positive().lt(120),caption:z.string().max(500)}).parse(value))
  .handler(async ({ data, context }) => {
    if (!data.mediaPath.startsWith(`${context.userId}/`)) throw new Error('Invalid media owner')
    const { data: object, error: objectError } = await context.supabase.storage.from('vibz-media').info(data.mediaPath)
    ensure(objectError)
    if (!object || Number(object.metadata?.size ?? 0) > 50 * 1024 * 1024) throw new Error('Video file is unavailable or too large')
    const mediaType = String(object.metadata?.mimetype ?? 'video/mp4')
    if (!mediaType.startsWith('video/')) throw new Error('Please choose a video file')
    const { data: post, error } = await context.supabase.from('vibz_posts').insert({ creator_id:context.userId, media_path:data.mediaPath, media_type:mediaType, duration_seconds:data.duration,caption:data.caption,status:'pending' }).select('id').single()
    ensure(error)
    return post?.id
  })

export const moderateVibz = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((value: { postId:string; action:'keep'|'delete'|'quarantine'; reason?:string }) => z.object({postId:id,action:z.enum(['keep','delete','quarantine']),reason:z.enum(['Nudity Content','Sexual Content','Soft Porn Content','CSAM Content','Unfit Content']).optional()}).parse(value))
  .handler(async ({data,context}) => {
    const {data: allowed,error: permissionError} = await context.supabase.rpc('is_admin_user')
    ensure(permissionError)
    if (!allowed) throw new Error('Admin access required')
    if (data.action === 'delete' && !data.reason) throw new Error('Select a deletion reason')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const {data: post,error: fetchError} = await supabaseAdmin.from('vibz_posts').select('id,creator_id,created_at,status').eq('id',data.postId).single()
    ensure(fetchError)
    if (!post || post.status === 'deleted') throw new Error('This VibZ is no longer available')
    const status = data.action === 'keep' ? 'published' : data.action === 'delete' ? 'deleted' : 'quarantined'
    const {data: changed,error: updateError} = await supabaseAdmin.from('vibz_posts').update({status,reviewed_at:new Date().toISOString(),deleted_at: status === 'deleted' ? new Date().toISOString() : null}).eq('id',data.postId).eq('status',post.status).select('id').maybeSingle()
    ensure(updateError)
    if (!changed) throw new Error('This VibZ was already reviewed. Refresh and try again.')
    const {data: record,error: logError} = await supabaseAdmin.from('vibz_moderation').insert({post_id:data.postId,actor_id:context.userId,action:data.action,categories:data.reason?[data.reason]:[],details:data.reason ?? null}).select('id').single()
    ensure(logError)
    if (data.action === 'delete' && record) {
      const { data: creator } = await supabaseAdmin.from('user_profiles').select('full_name,username,real_email,email').eq('id',post.creator_id).single()
      const address = creator?.real_email || creator?.email
      if (address) {
        const {enqueueTransactionalEmail} = await import('@/lib/email-enqueue.server')
        const result = await enqueueTransactionalEmail({templateName:'vibz-removed',recipientEmail:address,idempotencyKey:`vibz-removed-${record.id}`,templateData:{name:creator?.full_name || creator?.username || 'there',postedAt:new Date(post.created_at).toLocaleString('en-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata'}),reason:data.reason}})
        await supabaseAdmin.from('vibz_moderation').update({email_status:result.status}).eq('id',record.id)
      }
    }
    return {status}
  })
