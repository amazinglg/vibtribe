import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type GatewayRow = {
  device_id: string
  label: string
  status: 'active' | 'revoked'
  created_at: string
  last_seen_at: string | null
}

async function assertMasterAdmin(context: { supabase: any; userId: string }) {
  const { data: prof } = await context.supabase
    .from('user_profiles')
    .select('is_master_admin, role')
    .eq('id', context.userId)
    .maybeSingle()
  const allowed = !!prof && (prof.is_master_admin === true || prof.role === 'master_admin')
  if (!allowed) throw new Error('Forbidden')
}

/** Master-admin only: list provisioned gateway devices (never returns secrets). */
export const listGateways = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMasterAdmin(context as any)
    const { adminClient } = await import('@/lib/sms-gateway.server')
    const { data, error } = await adminClient().rpc('sms_gw_list_gateways')
    if (error) throw new Error(error.message)
    return (data as GatewayRow[]) ?? []
  })

/**
 * Master-admin only: provision a new gateway device.
 * The plaintext secret is generated here and returned exactly once —
 * only its hash is persisted.
 */
export const provisionGateway = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ label: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context as any)
    const { adminClient, generateDeviceId, generateDeviceSecret, hashDeviceSecret } = await import(
      '@/lib/sms-gateway.server'
    )
    const deviceId = generateDeviceId()
    const secret = generateDeviceSecret()
    const secretHash = await hashDeviceSecret(secret)

    const { data: res, error } = await adminClient().rpc('sms_gw_register_gateway', {
      _device_id: deviceId,
      _secret_hash: secretHash,
      _label: data.label,
      _created_by: context.userId,
    })
    if (error) throw new Error(error.message)
    const out = res as any
    if (!out?.ok) throw new Error(out?.error || 'provision_failed')

    // Returned once. Never persisted or logged in plaintext.
    return { device_id: deviceId, device_secret: secret, signing_key: secretHash, label: data.label }
  })

/** Master-admin only: revoke or re-activate a device. */
export const setGatewayStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ deviceId: z.string().min(1).max(64), status: z.enum(['active', 'revoked']) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context as any)
    const { adminClient } = await import('@/lib/sms-gateway.server')
    const { data: res, error } = await adminClient().rpc('sms_gw_set_gateway_status', {
      _device_id: data.deviceId,
      _status: data.status,
    })
    if (error) throw new Error(error.message)
    const out = res as any
    if (!out?.ok) throw new Error(out?.error || 'update_failed')
    return { ok: true as const }
  })

/** Master-admin only: permanently delete a provisioned device. */
export const deleteGateway = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ deviceId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context as any)
    const { adminClient } = await import('@/lib/sms-gateway.server')
    const { data: res, error } = await adminClient().rpc('sms_gw_delete_gateway', {
      _device_id: data.deviceId,
    })
    if (error) throw new Error(error.message)
    const out = res as any
    if (!out?.ok) throw new Error(out?.error || 'delete_failed')
    return { ok: true as const }
  })
