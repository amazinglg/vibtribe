DO $$
DECLARE
  uid uuid := 'af3acbf6-35e8-4167-aca0-929d7e849706';
  synth text := '9755077472@vibetribe.app';
  pw text := '9755077472';
BEGIN
  UPDATE auth.users
    SET email = synth,
        encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = uid;

  UPDATE public.user_profiles
    SET real_email = COALESCE(real_email, email),
        email = synth
    WHERE id = uid;
END $$;