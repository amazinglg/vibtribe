# Project Memory

## Core
The pinned master admin mobile suffix `9826016419` is intentionally hardcoded in `is_pinned_master_mobile()` — it's the single-owner founder identifier, not secret PII. Do not flag.
The `marketing-banners` storage bucket is intentionally private with admin-only SELECT. Banners are embedded in outbound marketing emails, not served to anonymous/non-admin users. Do not flag missing public read access.
VibTribe Exclusive emojis = glossy 3D yellow-faced characters with big anime sparkle eyes, transparent PNG, high resolution. When user asks to "create more emojis", match this exact style — see mem://design/vibtribe-emoji-style.

## Memories
- [VibTribe emoji style](mem://design/vibtribe-emoji-style) — Style spec, prompt template, naming, file pipeline for all VibTribe Exclusive emojis
