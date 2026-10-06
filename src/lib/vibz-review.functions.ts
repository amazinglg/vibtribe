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
      const response = await fetch('https://ai.gateway.lovable.dev/v1/responses',{
        method:'POST',
        headers:{'Lovable-API-Key':apiKey,'X-Lovable-AIG-SDK':'fetch','Content-Type':'application/json'},
        body:JSON.stringify({
          model:'openai/gpt-6-astra',stream:true,store:false,
          reasoning:{effort:'low',summary:'auto'},include:['reasoning.encrypted_content'],
          text:{format:{type:'json_schema',name:'vibz_safety_review',strict:true,schema:{type:'object',additionalProperties:false,required:['decision','categories','confidence','notes'],properties:{decision:{type:'string',enum:['safe','flagged','quarantined']},categories:{type:'array',items:{type:'string'},maxItems:8},confidence:{type:'number',minimum:0,maximum:1},notes:{type:'string',maxLength:500}}}}},
          input:[
            {role:'system',content:[{type:'input_text',text:'You are a conservative content-safety screener. Inspect sampled video frames for nudity, sexual content, soft pornography, suspected child sexual abuse material, violence, and clearly unsafe material. Never claim to have inspected unsampled frames or audio. If a minor appears in sexual context, use quarantined. If uncertain, use flagged. Mark safe ONLY if all frames are clearly appropriate.'}]},
            {role:'user',content:[{type:'input_text',text:'Screen these frames sampled from a short video. These are incomplete evidence, so be conservative and return the required JSON.'},...data.frames.map(frame=>({type:'input_image',image_url:frame}))]},
          ],
        }),
      })
      if (!response.ok || !response.body) throw new Error('Screening service unavailable')
      const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';let text=''
      while(true){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});const lines=pending.split('\n');pending=lines.pop()??'';for(const line of lines){if(!line.startsWith('data: '))continue;const value=line.slice(6);if(value==='[DONE]')continue;try{const event=JSON.parse(value) as {type?:string;delta?:string;error?:{message?:string}};if(event.type==='response.output_text.delta'&&typeof event.delta==='string')text+=event.delta;if(event.type==='error')throw new Error(event.error?.message||'Screening failed')}catch(error){if(error instanceof SyntaxError)continue;throw error}}}
      if(!text.trim())throw new Error('Screening returned no result')
      const parsed = JSON.parse(text) as {decision?:string;categories?:string[];confidence?:number;notes?:string}
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
