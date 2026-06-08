import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Delete every chat the caller has marked as secured.
 * - Removes the user's user_secure_chats rows
 * - Deletes the underlying chats (cascades messages, members) so the
 *   database stays clean. This affects the other participant too.
 * - For group chats, only the user's chat_members row is removed.
 */
export const deleteAllSecuredChats = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // 1) Get all chats the user has secured
    const { data: marks, error: marksErr } = await supabase
      .from('user_secure_chats')
      .select('chat_id')
      .eq('user_id', userId)
    if (marksErr) throw new Error(marksErr.message)
    const chatIds = (marks ?? []).map((m: any) => m.chat_id as string)
    if (chatIds.length === 0) return { deleted: 0 }

    // 2) Inspect each chat — fully delete 1:1, leave for groups
    const { data: chatRows } = await supabaseAdmin
      .from('chats')
      .select('id, is_group')
      .in('id', chatIds)

    const oneToOne = (chatRows ?? []).filter((c: any) => !c.is_group).map((c: any) => c.id)
    const groups   = (chatRows ?? []).filter((c: any) =>  c.is_group).map((c: any) => c.id)

    // 3) Drop the secure marks first (any chats, including stale ones)
    await supabaseAdmin
      .from('user_secure_chats')
      .delete()
      .eq('user_id', userId)
      .in('chat_id', chatIds)

    // 4) Delete 1:1 chats entirely (cascades messages/members)
    if (oneToOne.length > 0) {
      await supabaseAdmin.from('chats').delete().in('id', oneToOne)
    }

    // 5) For groups, just remove the user's membership
    if (groups.length > 0) {
      await supabaseAdmin
        .from('chat_members')
        .delete()
        .eq('user_id', userId)
        .in('chat_id', groups)
    }

    return { deleted: chatIds.length, oneToOne: oneToOne.length, groups: groups.length }
  })