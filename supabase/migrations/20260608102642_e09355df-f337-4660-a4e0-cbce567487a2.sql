
INSERT INTO public.role_permissions (role_key, permission_key, allowed)
SELECT 'admin', pk.key, true
FROM public.permission_keys pk
WHERE pk.key IN ('system.view','system.force_release','notifications.edit','notifications.delete','chats.view','chats.delete')
ON CONFLICT (role_key, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
