import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// A sampled-frame screening layer, not a claim to review every frame or the audio track.
// Any inconclusive result stays private pending human review.
export const reviewVibzUpload = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input:{postId:string;frames:string[]}) => z.object({postId:z.string().uuid(),frames:z.array(z.string().regex(/^data:image\/jpeg;base64,/).max(350000)).min(3).max(8)}).parse(input))
  .handler(async ({data,context}) => {
    const {data:post,error} = await context.supabase.from('vibz_posts').select('id,creator_id,status').eq('id',data.postId).single()
    if (error || !post || post.creator_id !== context.userId || post.status !== 'pending') throw new Error('This upload cannot be reviewed')
    let status:'published'|'flagged'|'quarantined' = 'flagged'
    let categories:string[] = []
    let confidence:number|null = null
    let notes = 'Automated screening could not complete. An administrator must review before publication.'
    try {
      const apiKey = process.env['LOVABLE_API_KEY']
      if (!apiKey) throw new Error('Screening unavailable')
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions',{
        method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:'google/gemini-2.5-flash',temperature:0,max_tokens:300,messages:[{role:'system',content:'You are a conservative content-safety screener. Inspect sampled video frames for nudity, sexual content, soft pornography, suspected child sexual abuse material, violence, and clearly unsafe material. Never claim to have inspected unsampled frames or audio. Return ONLY JSON {"decision":"safe"|"flagged"|"quarantined","categories":[],"confidence":0.0,"notes":"brief explanation"}. If a minor appears in sexual context, use quarantined. If uncertain, use flagged. Mark safe ONLY if all frames are clearly appropriate.'},{role:'user',content:[{type:'text',text:'Screen these frames sampled from a short video. These are incomplete evidence, so be conservative.'},...data.frames.map(frame=>({type:'image_url',image_url:{url:frame}}))]}]})})
      if (!response.ok) throw new Error('Screening service unavailable')
      const result = await response.json() as {choices?:{message?:{content?:string}}[]}
      const text = result.choices?.[0]?.message?.content ?? ''
      const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,'')) as {decision?:string;categories?:string[];confidence?:number;notes?:string}
      if (!['safe','flagged','quarantined'].includes(parsed.decision ?? '')) throw new Error('Inconclusive screening')
      status = parsed.decision === 'safe' ? 'published' : parsed.decision === 'quarantined' ? 'quarantined' : 'flagged'
      categories = Array.isArray(parsed.categories) ? parsed.categories.filter(c=>typeof c==='string').slice(0,8).map(c=>c.slice(0,80)) : []
      confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1 ? parsed.confidence : null
      notes = String(parsed.notes ?? '').slice(0,500)
    } catch { /* Fail closed; a human must review it. */ }
    const {supabaseAdmin} = await import('@/integrations/supabase/client.server')
    const {data:updated,error:updateError} = await supabaseAdmin.from('vibz_posts').update({status,categories,confidence,review_notes:notes,reviewed_at:new Date().toISOString()}).eq('id',data.postId).eq('status','pending').eq('creator_id',context.userId).select('id').maybeSingle()
    if (updateError || !updated) throw new Error('Review could not be saved; your VibZ remains private')
    const {error:logError} = await supabaseAdmin.from('vibz_moderation').insert({post_id:data.postId,action:'automated_screening',categories,confidence,details:notes})
    if (logError) console.error('[vibz] failed to record screening',logError.code)
    return {status}
  })
