
-- 1) Force-delete all draft email campaigns and any orphaned recipient rows
DELETE FROM public.email_campaign_recipients
  WHERE campaign_id IN (SELECT id FROM public.email_campaigns WHERE status = 'draft');
DELETE FROM public.email_campaigns WHERE status = 'draft';

-- 2) Restore / expand the permission catalog with proper segments.
--    Each category gets at least one .view key (drives the View toggle)
--    and one or more write keys (drives the Write toggle).
DELETE FROM public.role_permissions
  WHERE permission_key NOT IN (SELECT key FROM public.permission_keys);

INSERT INTO public.permission_keys (key, label, category, sort_order, description) VALUES
  -- Overview / Dashboard
  ('overview.view',           'View dashboard',           'Overview',     10, 'See the admin dashboard with KPIs and recent activity'),
  ('overview.export',         'Export reports',           'Overview',     20, 'Download CSV / PDF exports of dashboard data'),

  -- Users
  ('users.view',              'View users',               'Users',        10, 'Browse the user directory'),
  ('users.edit',              'Edit users',               'Users',        20, 'Edit user profiles, usernames and details'),
  ('users.suspend',           'Suspend users',            'Users',        30, 'Temporarily suspend accounts'),
  ('users.block',             'Block users',              'Users',        40, 'Permanently block accounts from signing in'),
  ('users.delete',            'Delete users',             'Users',        50, 'Permanently delete user accounts'),
  ('users.reset_password',    'Reset passwords',          'Users',        60, 'Trigger a password reset for a user'),
  ('users.force_logout',      'Force logout',             'Users',        70, 'Sign a user out of every active device'),
  ('users.impersonate',       'Impersonate users',        'Users',        80, 'Sign in as a user for support investigation'),

  -- Tribes
  ('tribes.view',             'View tribes',              'Tribes',       10, 'Browse all tribes (public and private)'),
  ('tribes.edit',             'Edit tribes',              'Tribes',       20, 'Edit tribe name, description, privacy and avatar'),
  ('tribes.manage_members',   'Manage members',           'Tribes',       30, 'Add or remove members and change member roles'),
  ('tribes.delete',           'Delete tribes',            'Tribes',       40, 'Delete a tribe and its messages'),

  -- Broadcasts
  ('broadcasts.view',         'View broadcasts',          'Broadcasts',   10, 'View broadcast history and reactions'),
  ('broadcasts.post',         'Post broadcasts',          'Broadcasts',   20, 'Publish a new broadcast to all users'),
  ('broadcasts.edit',         'Edit broadcasts',          'Broadcasts',   30, 'Edit existing broadcast content'),
  ('broadcasts.delete',       'Delete broadcasts',        'Broadcasts',   40, 'Remove a broadcast'),

  -- Support
  ('support.view',            'View tickets',             'Support',      10, 'Open and read support tickets'),
  ('support.reply',           'Reply to tickets',         'Support',      20, 'Respond to users on tickets'),
  ('support.assign',          'Assign tickets',           'Support',      30, 'Assign tickets to other admins'),
  ('support.close',           'Close tickets',            'Support',      40, 'Mark tickets as resolved or closed'),
  ('support.delete',          'Delete tickets',           'Support',      50, 'Permanently remove tickets'),

  -- Marketing
  ('marketing.view',          'View marketing',           'Marketing',    10, 'See marketing campaigns and reports'),
  ('marketing.create',        'Create campaigns',         'Marketing',    20, 'Compose new marketing email drafts'),
  ('marketing.send',          'Send campaigns',           'Marketing',    30, 'Send a marketing campaign to the audience'),
  ('marketing.delete',        'Delete campaigns',         'Marketing',    40, 'Delete drafts or sent campaigns'),

  -- Notifications
  ('notifications.view',      'View notifications',       'Notifications',10, 'See system notifications log'),
  ('notifications.send',      'Send notifications',       'Notifications',20, 'Push notifications to one or many users'),

  -- Sessions & devices
  ('sessions.view',           'View sessions',            'Sessions',     10, 'See logged-in devices for any user'),
  ('sessions.revoke',         'Revoke sessions',          'Sessions',     20, 'Force a device to sign out'),

  -- Permissions & roles
  ('permissions.view',        'View permissions',         'Permissions',  10, 'Open the permissions matrix'),
  ('permissions.manage',      'Manage permissions',       'Permissions',  20, 'Create roles and change role permissions'),

  -- App settings
  ('settings.view',           'View app settings',        'Settings',     10, 'Open the app settings screen'),
  ('settings.edit',           'Edit app settings',        'Settings',     20, 'Change branding, limits and feature flags')
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      description = EXCLUDED.description;

-- 3) Grant Admin role everything by default (matches current "admin = full access" reality).
INSERT INTO public.role_permissions (role_key, permission_key, allowed, updated_at)
SELECT 'admin', pk.key, true, now()
FROM public.permission_keys pk
ON CONFLICT (role_key, permission_key) DO UPDATE
  SET allowed = true, updated_at = now();
