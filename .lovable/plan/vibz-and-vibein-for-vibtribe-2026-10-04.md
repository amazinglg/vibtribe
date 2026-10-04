# VibZ and VibeIn for VibTribe

## What will be built
- Add **VibZ** to primary navigation in Chat → Status → VibZ → Profile order, with a distinct VibTribe icon. The first screen is a full-height, swipeable video feed, not a promotional page. Show creator details, caption, reaction, comments, share, creator profile, and VibeIn controls.
- Add a top-left create control for upload and device-supported recording. Preview, caption, duration validation (strictly less than 2 minutes), clear members-only visibility notice, upload progress, cancellation, retry, and duplicate-publish protection. Keep the existing status and chat flows unchanged.
- Add a separate VibeIn relationship, VibeMates/VibeIn counts, user search by display name or username, and social profiles with published VibZ and creator engagement totals. Maintain current profile features and protect private profile fields and conversations.
- Blend posts from VibeIn'd creators with suitable new creators, interest/engagement matches and popular posts. Keep recommendations explainable at a basic level and ensure the feed works when there is little interaction history.
- Add a content-safety review for every upload before it becomes visible. High-risk or uncertain posts stay quarantined for administrators; suspected CSAM is immediately restricted and handled through a dedicated safety escalation path. AI flags are evidence to review, not an automatic permanent deletion decision. Add **Altered VibZ** to the Admin Portal with review context, Keep, and Delete with a required reason, plus a durable moderation history.
- Add a branded, professional removal email using the existing one-to-one app email template system. Add the requested prohibited-content notice to upload and applicable Terms/Community Guidelines surfaces.

## Audience and safety decisions
- Published VibZ is visible **only to signed-in VibTribe members**; keep video storage private and issue time-limited access only for authorized views.
- Accounts with guardian consent can participate on the **same VibZ terms as adults**, without bypassing existing guardian-consent and account gates.
- VibeIn never alters contacts, chats, secured chats or private profile permissions. Creators can remove their own posts; only authorized administrators can make moderation decisions.

## Technical approach
- Add dedicated tables for posts/media metadata, VibeIn relationships, reactions, comments, share events, moderation assessments, decisions/history and notification idempotency; use explicit grants, row-level policies, indexes and database-side aggregate/query functions rather than client-only counters.
- Use private, owner-bound video storage with access constrained to approved posts and admins. Limit file size/type and video duration in the UI and on the server; leave uploads unlisted while safety review is pending. Use an asynchronous review path so uploads do not time out; process sampled video frames and any safely obtainable supporting signals using the available AI service. If review fails or cannot inspect enough content, keep the post unlisted for human review rather than publish unchecked. Never misrepresent sampled-frame review as comprehensive video detection.
- Reuse the existing TanStack routes, auth middleware, design tokens, media helpers, admin permissions, legal content and managed email templates. Add route metadata for each new content page; do not expose members-only media to anonymous crawlers.
- Implement in connected slices: schema and permissions → upload/review pipeline → feed and engagement → search and profiles → admin review and email/policy → mobile and desktop verification.

## Verification
- Test sub-2-minute acceptance and 2-minute rejection, interrupted and duplicate uploads, signed-out access, VibeIn add/remove, search, comments/reactions/shares, review quarantine/approval/deletion and one removal email per decision.
- Check all selectable themes, small phones and desktop, plus a regression pass on chat, status, secured chats, and existing profile settings.
