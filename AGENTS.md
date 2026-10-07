# Project architecture rules

- Password recovery verifies the emailed code before revealing password fields; the code is consumed only when the password reset succeeds, preventing invalid-code password entry while retaining one-time use.
- Public release checks use a safe-field latest-marker RPC instead of direct release-table access, so update prompts remain available without exposing full release records.
- Private profile files require a matching storage owner; shared broadcast and tribe files use separate audience-scoped read policies so shared images still render.
- VibZ uses a separate members-only social graph and private media; pending uploads are inaccessible to other members until safety review, and admin decisions are logged independently from secured chats.
- VibZ presentation gates wrap the interactive experience and profile summary before mounting them, using the existing authenticated admin helper so excluded users trigger no VibZ reads and eligible admins retain existing controls.
- VibZ upload and VibeIn policies use the existing restricted profile guard instead of direct protected-profile reads; uploads retain their real video container and MIME type and validate browser decoding before submission.