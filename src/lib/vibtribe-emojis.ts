// VibTribe custom image emoji collection.
// Add new collections here later (premium, seasonal, event) by exporting
// additional arrays and registering them in `emojis.ts`.

import blowkiss from '@/assets/emojis/vibtribe/blowkiss.png.asset.json';
import starstruck from '@/assets/emojis/vibtribe/starstruck.png.asset.json';
import coolpeace from '@/assets/emojis/vibtribe/coolpeace.png.asset.json';
import gentleman from '@/assets/emojis/vibtribe/gentleman.png.asset.json';
import gifttear from '@/assets/emojis/vibtribe/gifttear.png.asset.json';
import queen from '@/assets/emojis/vibtribe/queen.png.asset.json';
import selfiekiss from '@/assets/emojis/vibtribe/selfiekiss.png.asset.json';
import gamer from '@/assets/emojis/vibtribe/gamer.png.asset.json';
import hug from '@/assets/emojis/vibtribe/hug.png.asset.json';
import giftbox from '@/assets/emojis/vibtribe/giftbox.png.asset.json';

export interface VibTribeEmoji {
  id: string;        // stable id used in shortcode
  name: string;      // human label
  url: string;       // CDN url
  collection: string;
}

export const VIBTRIBE_EMOJIS: VibTribeEmoji[] = [
  { id: 'blowkiss',   name: 'Blow Kiss',     url: blowkiss.url,   collection: 'vibtribe' },
  { id: 'starstruck', name: 'Star Struck',   url: starstruck.url, collection: 'vibtribe' },
  { id: 'coolpeace',  name: 'Cool Peace',    url: coolpeace.url,  collection: 'vibtribe' },
  { id: 'gentleman',  name: 'Gentleman',     url: gentleman.url,  collection: 'vibtribe' },
  { id: 'gifttear',   name: 'Happy Tears',   url: gifttear.url,   collection: 'vibtribe' },
  { id: 'queen',      name: 'Queen',         url: queen.url,      collection: 'vibtribe' },
  { id: 'selfiekiss', name: 'Selfie Kiss',   url: selfiekiss.url, collection: 'vibtribe' },
  { id: 'gamer',      name: 'Gamer',         url: gamer.url,      collection: 'vibtribe' },
  { id: 'hug',        name: 'Warm Hug',      url: hug.url,        collection: 'vibtribe' },
  { id: 'giftbox',    name: 'Gift Box',      url: giftbox.url,    collection: 'vibtribe' },
];

// Lookup map: id -> emoji (for fast shortcode rendering).
export const VIBTRIBE_EMOJI_MAP: Record<string, VibTribeEmoji> =
  Object.fromEntries(VIBTRIBE_EMOJIS.map(e => [e.id, e]));

// Shortcode used inside message text. Kept short + namespaced so it's
// unmistakable in plain-text fallbacks (notifications, search, exports).
export const vibtribeShortcode = (id: string) => `:vt:${id}:`;

// Matches :vt:<id>: tokens anywhere in a string.
export const VIBTRIBE_SHORTCODE_RE = /:vt:([a-z0-9_-]+):/g;
