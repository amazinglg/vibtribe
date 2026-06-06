DELETE FROM public.role_permissions WHERE role_key IN ('moderator','support');
DELETE FROM public.app_roles WHERE key IN ('moderator','support');