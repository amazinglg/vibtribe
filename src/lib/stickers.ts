// Sticker catalog. Stickers are sent as a message with the body
// `[STICKER:<section>/<file>]` and rendered as an <img>.
const N = 50;
const make = (section: string) =>
  Array.from({ length: N }, (_, i) => `${section}/${String(i + 1).padStart(2, '0')}.png`);

export const STICKER_SECTIONS = [
  { id: 'boys',  label: 'Boys',  icon: '👦', items: make('boys')  },
  { id: 'girls', label: 'Girls', icon: '👧', items: make('girls') },
] as const;

export const STICKER_PREFIX = '[STICKER:';
export const STICKER_SUFFIX = ']';

export function stickerToken(path: string) {
  return `${STICKER_PREFIX}${path}${STICKER_SUFFIX}`;
}

export function parseStickerPath(text: string | undefined | null): string | null {
  if (!text || typeof text !== 'string') return null;
  if (!text.startsWith(STICKER_PREFIX) || !text.endsWith(STICKER_SUFFIX)) return null;
  const inner = text.slice(STICKER_PREFIX.length, -STICKER_SUFFIX.length);
  // basic guard: only allow known sections + filename
  if (!/^(boys|girls)\/[0-9]{2}\.png$/.test(inner)) return null;
  return `/emojis/${inner}`;
}
