// VibTribe Exclusive image emoji collection.
// Glossy 3D yellow-faced characters with big anime sparkle eyes — see
// project memory `mem://design/vibtribe-emoji-style` for the style spec
// that future emoji generations must match.

import queen from '@/assets/emojis/vibtribe/queen.png.asset.json';
import gamer from '@/assets/emojis/vibtribe/gamer.png.asset.json';
import gentleman from '@/assets/emojis/vibtribe/gentleman.png.asset.json';
import superhero from '@/assets/emojis/vibtribe/superhero.png.asset.json';
import chef from '@/assets/emojis/vibtribe/chef.png.asset.json';
import detective from '@/assets/emojis/vibtribe/detective.png.asset.json';
import astronaut from '@/assets/emojis/vibtribe/astronaut.png.asset.json';
import rockstar from '@/assets/emojis/vibtribe/rockstar.png.asset.json';
import wizard from '@/assets/emojis/vibtribe/wizard.png.asset.json';
import ninja from '@/assets/emojis/vibtribe/ninja.png.asset.json';
import pirate from '@/assets/emojis/vibtribe/pirate.png.asset.json';
import graduate from '@/assets/emojis/vibtribe/graduate.png.asset.json';
import doctor from '@/assets/emojis/vibtribe/doctor.png.asset.json';
import artist from '@/assets/emojis/vibtribe/artist.png.asset.json';
import photographer from '@/assets/emojis/vibtribe/photographer.png.asset.json';
import dj from '@/assets/emojis/vibtribe/dj.png.asset.json';
import boxer from '@/assets/emojis/vibtribe/boxer.png.asset.json';
import scientist from '@/assets/emojis/vibtribe/scientist.png.asset.json';
import king from '@/assets/emojis/vibtribe/king.png.asset.json';
import cowboy from '@/assets/emojis/vibtribe/cowboy.png.asset.json';
import yoga from '@/assets/emojis/vibtribe/yoga.png.asset.json';
import vampire from '@/assets/emojis/vibtribe/vampire.png.asset.json';
import angel from '@/assets/emojis/vibtribe/angel.png.asset.json';

export interface VibTribeEmoji {
  id: string;        // stable id used in shortcode
  name: string;      // human label, VibTribe-themed
  url: string;       // CDN url
  collection: string;
}

export const VIBTRIBE_EMOJIS: VibTribeEmoji[] = [
  // The original 3 kept from launch batch
  { id: 'queen',        name: 'Tribe Queen',       url: queen.url,        collection: 'vibtribe' },
  { id: 'gamer',        name: 'Vibe Gamer',        url: gamer.url,        collection: 'vibtribe' },
  { id: 'gentleman',    name: 'Tribe Gentleman',   url: gentleman.url,    collection: 'vibtribe' },
  // The 20 new VibTribe Exclusive characters
  { id: 'superhero',    name: 'Vibe Hero',         url: superhero.url,    collection: 'vibtribe' },
  { id: 'chef',         name: 'Tribe Chef',        url: chef.url,         collection: 'vibtribe' },
  { id: 'detective',    name: 'Vibe Sleuth',       url: detective.url,    collection: 'vibtribe' },
  { id: 'astronaut',    name: 'Cosmic Tribe',      url: astronaut.url,    collection: 'vibtribe' },
  { id: 'rockstar',     name: 'Rockstar Vibe',     url: rockstar.url,     collection: 'vibtribe' },
  { id: 'wizard',       name: 'Vibe Wizard',       url: wizard.url,       collection: 'vibtribe' },
  { id: 'ninja',        name: 'Tribe Ninja',       url: ninja.url,        collection: 'vibtribe' },
  { id: 'pirate',       name: 'Vibe Pirate',       url: pirate.url,       collection: 'vibtribe' },
  { id: 'graduate',     name: 'Tribe Grad',        url: graduate.url,     collection: 'vibtribe' },
  { id: 'doctor',       name: 'Tribe Doc',         url: doctor.url,       collection: 'vibtribe' },
  { id: 'artist',       name: 'Vibe Artist',       url: artist.url,       collection: 'vibtribe' },
  { id: 'photographer', name: 'Vibe Snap',         url: photographer.url, collection: 'vibtribe' },
  { id: 'dj',           name: 'Tribe DJ',          url: dj.url,           collection: 'vibtribe' },
  { id: 'boxer',        name: 'Vibe Fighter',      url: boxer.url,        collection: 'vibtribe' },
  { id: 'scientist',    name: 'Vibe Scientist',    url: scientist.url,    collection: 'vibtribe' },
  { id: 'king',         name: 'Tribe King',        url: king.url,         collection: 'vibtribe' },
  { id: 'cowboy',       name: 'Vibe Cowboy',       url: cowboy.url,       collection: 'vibtribe' },
  { id: 'yoga',         name: 'Zen Tribe',         url: yoga.url,         collection: 'vibtribe' },
  { id: 'vampire',      name: 'Night Vibe',        url: vampire.url,      collection: 'vibtribe' },
  { id: 'angel',        name: 'Angel Vibe',        url: angel.url,        collection: 'vibtribe' },
];

// Lookup map: id -> emoji (for fast shortcode rendering).
export const VIBTRIBE_EMOJI_MAP: Record<string, VibTribeEmoji> =
  Object.fromEntries(VIBTRIBE_EMOJIS.map(e => [e.id, e]));

// Shortcode used inside message text. Kept short + namespaced so it's
// unmistakable in plain-text fallbacks (notifications, search, exports).
export const vibtribeShortcode = (id: string) => `:vt:${id}:`;

// Matches :vt:<id>: tokens anywhere in a string.
export const VIBTRIBE_SHORTCODE_RE = /:vt:([a-z0-9_-]+):/g;
