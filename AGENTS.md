# Project architecture rules

- Password recovery verifies the emailed code before revealing password fields; the code is consumed only when the password reset succeeds, preventing invalid-code password entry while retaining one-time use.
- Public release checks use a safe-field latest-marker RPC instead of direct release-table access, so update prompts remain available without exposing full release records.
- Private profile files require a matching storage owner; shared broadcast and tribe files use separate audience-scoped read policies so shared images still render.