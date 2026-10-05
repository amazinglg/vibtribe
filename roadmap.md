# Email update

- [x] Inventory legacy email senders and scaffolds
- [x] Re-render authentication email templates
- [x] Convert transactional app email senders
- [x] Add delivery events receiver
- [x] Remove replaced legacy queue routes
- [x] Preserve the independent promotional email unsubscribe flow
- [x] Remove legacy email setup migrations and unsubscribe scaffold
- [x] Verify the app

# Deleted content and iPhone PWA calls

- [x] Prevent deleted chats and expired messages from flashing from offline storage
- [x] Prune removed chats and messages from encrypted device storage
- [x] Use per-call urgent iPhone notifications with Answer and Decline actions
- [x] Verify type safety and the app rendering

# Project monitoring fixes

- [x] Prevent slow iPhone permission prompts from silently cancelling accepted calls
- [x] Correct chat participation permission errors
- [x] Verify both fixes

# Android call audio and background controls

- [x] Route voice calls through the earpiece by default
- [x] Make the earpiece and speaker control reliably change Android output
- [x] Preserve the ongoing-call service when the app leaves the foreground
- [x] Make active-call notification controls reach the current call
- [x] Verify preview checks
- [ ] Verify Android compilation and physical-device call routing (blocked: Android SDK, Java, and test phone unavailable here)

# Password recovery flow

- [x] Keep all six verification-code boxes inside narrow phone screens
- [x] Verify the code before showing new-password fields
- [x] Reset the password only after successful code verification
- [x] Verify the phone layout and recovery flow

# SEO findings

- [x] Give the internal status editor unique, non-indexable metadata
- [x] Point crawler rules and sitemap entries to the main custom domain
- [x] Complete Google Search Console verification and submit the sitemap
- [x] Verify the updated SEO output

# Main-domain SEO consistency

- [x] Align the sitemap, crawler rules, and remaining page metadata with www.vibtribe.in
- [x] Verify the main-domain sitemap in preview and confirm both domains currently serve pages
- [ ] Confirm the published sitemap updates after publishing (blocked: unpublished changes)
- [ ] Confirm www.vibtribe.in is set as Primary so other addresses redirect there (blocked: domain setting is not exposed by this status check)

# VibZ social video

- [x] Add separate posts, VibeIn, engagement, moderation and private video storage
- [ ] Build the video feed, upload, discovery and creator profiles
- [ ] Connect admin review, removal email and safety policy
- [ ] Check mobile/desktop interactions and deployment readiness
