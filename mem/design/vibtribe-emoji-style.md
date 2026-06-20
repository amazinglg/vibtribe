---
name: vibtribe-emoji-style
description: Visual style, prompt template, naming convention, and pipeline for creating new VibTribe Exclusive image emojis. Use whenever the user asks to create or add more VibTribe emojis.
type: design
---
# VibTribe Exclusive Emoji Style

All VibTribe Exclusive emojis must match this exact look — never iOS-flat, never 2D cartoon, never cropped from reference images.

## Visual style (non-negotiable)
- Glossy 3D rendered character, soft studio lighting with specular highlights and subtle shadow underneath
- Painterly / semi-realistic finish (similar to premium 3D Disney/Pixar style stickers), NOT flat Apple/Google emoji style
- Round yellow emoji face/head as the base (rich saturated yellow with warm gradient shading)
- Large expressive anime-style eyes with bright white sparkle/star highlights — eyes are the focal point
- Each emoji has ONE clear persona / role (profession, archetype, mood) expressed through props, costume, accessories
- Square framing with the character centered, fully transparent PNG background
- High resolution (1024x1024 preferred), no watermarks, no text, no background scenery
- Subtle drop accents (hearts, sparkles, small props) allowed but must not dominate the character

## Prompt template (use imagegen `standard` or `premium`, transparent_background=true)
"Glossy 3D rendered emoji character, round yellow face/head with warm gradient shading and soft specular highlights, large expressive anime eyes with bright white star/sparkle highlights, [PERSONA + PROPS + COSTUME], painterly semi-realistic 3D sticker style, centered square composition, on a clean transparent background, high resolution, no text, no watermark"

Replace [PERSONA + PROPS + COSTUME] with the new character concept (e.g. "wearing a chef hat and double-breasted white coat, holding a wooden spoon").

## File pipeline
1. Generate each PNG to `/mnt/documents/vt-emojis-vN/` (next N), one file per emoji, transparent background.
2. Show the user the batch and get approval/edit requests before uploading.
3. Upload approved ones via `lovable-assets create` SERIALLY (parallel uploads hit a mount cache race and produce empty JSON files). Stage to /tmp first.
4. Write the `.asset.json` pointer to `src/assets/emojis/vibtribe/<id>.png.asset.json`.
5. Register in `src/lib/vibtribe-emojis.ts` — add an import + a `VIBTRIBE_EMOJIS` entry with a VibTribe-themed name (use words like "Tribe", "Vibe", "Vibe X", "X Vibe", "Cosmic Tribe", "Zen Tribe", etc — never plain literal labels like "Doctor").
6. They appear automatically in the "VibTribe Exclusive" tab of the emoji picker (sourced from `VIBTRIBE_EMOJIS` via `EMOJI_CATEGORIES` in `src/lib/emojis.ts`).
7. Shortcode in messages is `:vt:<id>:` — already wired in `ChatWindowPanel` rendering.

## Naming convention for new emojis
- VibTribe-themed display name (Tribe / Vibe / Tribe X / Vibe X / X Tribe)
- Short lowercase id matching the persona (`superhero`, `chef`, `astronaut`)
- CDN filename = `<id>.png`
