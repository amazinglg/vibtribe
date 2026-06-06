import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

async function assertMaster(userId: string) {
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('is_master_admin')
    .eq('id', userId)
    .maybeSingle()
  if (!data?.is_master_admin) throw new Error('Master admin access required')
}

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('is_master_admin, role')
    .eq('id', userId)
    .maybeSingle()
  if (!data || (!data.is_master_admin && data.role !== 'admin')) {
    throw new Error('Admin access required')
  }
}

export const listPermissionsMatrix = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const [{ data: roles }, { data: keys }, { data: rp }] = await Promise.all([
      supabaseAdmin.from('app_roles').select('*').order('label'),
      supabaseAdmin.from('permission_keys').select('*').order('category').order('sort_order'),
      supabaseAdmin.from('role_permissions').select('*'),
    ])
    return {
      roles: roles ?? [],
      keys: keys ?? [],
      assignments: rp ?? [],
    }
  })

export const setRolePermission = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    roleKey: z.string().min(1).max(64),
    permissionKey: z.string().min(1).max(64),
    allowed: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const { error } = await supabaseAdmin
      .from('role_permissions')
      .upsert(
        {
          role_key: data.roleKey,
          permission_key: data.permissionKey,
          allowed: data.allowed,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'role_key,permission_key' },
      )
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const setRoleGroupPermission = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    roleKey: z.string().min(1).max(64),
    permissionKeys: z.array(z.string().min(1).max(64)).min(1).max(64),
    allowed: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const rows = data.permissionKeys.map(k => ({
      role_key: data.roleKey,
      permission_key: k,
      allowed: data.allowed,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabaseAdmin
      .from('role_permissions')
      .upsert(rows, { onConflict: 'role_key,permission_key' })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const createRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    key: z.string().min(2).max(48).regex(/^[a-z0-9_]+$/, 'lowercase letters, numbers, underscores'),
    label: z.string().min(2).max(64),
    description: z.string().max(200).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const { data: row, error } = await supabaseAdmin
      .from('app_roles')
      .insert({ key: data.key, label: data.label, description: data.description || null, is_system: false })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return { role: row }
  })

export const deleteRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    await supabaseAdmin.from('role_permissions').delete().eq('role_key', data.key)
    const { error } = await supabaseAdmin
      .from('app_roles').delete().eq('key', data.key).eq('is_system', false)
    if (error) throw new Error(error.message)
    return { ok: true }
  })