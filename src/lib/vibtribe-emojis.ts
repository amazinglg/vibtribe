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
import princess from '@/assets/emojis/vibtribe/princess.png.asset.json';
import ballerina from '@/assets/emojis/vibtribe/ballerina.png.asset.json';
import fairy from '@/assets/emojis/vibtribe/fairy.png.asset.json';
import mermaid from '@/assets/emojis/vibtribe/mermaid.png.asset.json';
import unicorngirl from '@/assets/emojis/vibtribe/unicorngirl.png.asset.json';
import cheerleader from '@/assets/emojis/vibtribe/cheerleader.png.asset.json';
import nurse from '@/assets/emojis/vibtribe/nurse.png.asset.json';
import teacher from '@/assets/emojis/vibtribe/teacher.png.asset.json';
import florist from '@/assets/emojis/vibtribe/florist.png.asset.json';
import baker from '@/assets/emojis/vibtribe/baker.png.asset.json';
import barista from '@/assets/emojis/vibtribe/barista.png.asset.json';
import fashionista from '@/assets/emojis/vibtribe/fashionista.png.asset.json';
import bride from '@/assets/emojis/vibtribe/bride.png.asset.json';
import witch from '@/assets/emojis/vibtribe/witch.png.asset.json';
import cupid from '@/assets/emojis/vibtribe/cupid.png.asset.json';
import butterflygirl from '@/assets/emojis/vibtribe/butterflygirl.png.asset.json';
import snowqueen from '@/assets/emojis/vibtribe/snowqueen.png.asset.json';
import popstar from '@/assets/emojis/vibtribe/popstar.png.asset.json';
import journalist from '@/assets/emojis/vibtribe/journalist.png.asset.json';
import pilot from '@/assets/emojis/vibtribe/pilot.png.asset.json';
import policewoman from '@/assets/emojis/vibtribe/policewoman.png.asset.json';
import firefighter from '@/assets/emojis/vibtribe/firefighter.png.asset.json';
import soccerstar from '@/assets/emojis/vibtribe/soccerstar.png.asset.json';
import tennisstar from '@/assets/emojis/vibtribe/tennisstar.png.asset.json';
import swimmer from '@/assets/emojis/vibtribe/swimmer.png.asset.json';
import vet from '@/assets/emojis/vibtribe/vet.png.asset.json';
import lawyer from '@/assets/emojis/vibtribe/lawyer.png.asset.json';
import ceo from '@/assets/emojis/vibtribe/ceo.png.asset.json';
import dancer from '@/assets/emojis/vibtribe/dancer.png.asset.json';
import skater from '@/assets/emojis/vibtribe/skater.png.asset.json';

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
  { id: 'princess',     name: 'Tribe Princess',    url: princess.url,     collection: 'vibtribe' },
  { id: 'ballerina',    name: 'Ballet Vibe',       url: ballerina.url,    collection: 'vibtribe' },
  { id: 'fairy',        name: 'Fairy Vibe',        url: fairy.url,        collection: 'vibtribe' },
  { id: 'mermaid',      name: 'Ocean Vibe',        url: mermaid.url,      collection: 'vibtribe' },
  { id: 'unicorngirl',  name: 'Dreamy Tribe',      url: unicorngirl.url,  collection: 'vibtribe' },
  { id: 'cheerleader',  name: 'Hype Tribe',        url: cheerleader.url,  collection: 'vibtribe' },
  { id: 'nurse',        name: 'Care Vibe',         url: nurse.url,        collection: 'vibtribe' },
  { id: 'teacher',      name: 'Wise Tribe',        url: teacher.url,      collection: 'vibtribe' },
  { id: 'florist',      name: 'Bloom Vibe',        url: florist.url,      collection: 'vibtribe' },
  { id: 'baker',        name: 'Sweet Tribe',       url: baker.url,        collection: 'vibtribe' },
  { id: 'barista',      name: 'Brew Vibe',         url: barista.url,      collection: 'vibtribe' },
  { id: 'fashionista',  name: 'Glam Tribe',        url: fashionista.url,  collection: 'vibtribe' },
  { id: 'bride',        name: 'Bride Tribe',       url: bride.url,        collection: 'vibtribe' },
  { id: 'witch',        name: 'Mystic Vibe',       url: witch.url,        collection: 'vibtribe' },
  { id: 'cupid',        name: 'Love Vibe',         url: cupid.url,        collection: 'vibtribe' },
  { id: 'butterflygirl',name: 'Butterfly Tribe',   url: butterflygirl.url,collection: 'vibtribe' },
  { id: 'snowqueen',    name: 'Frost Vibe',        url: snowqueen.url,    collection: 'vibtribe' },
  { id: 'popstar',      name: 'Pop Vibe',          url: popstar.url,      collection: 'vibtribe' },
  { id: 'journalist',   name: 'Voice Tribe',       url: journalist.url,   collection: 'vibtribe' },
  { id: 'pilot',        name: 'Sky Tribe',         url: pilot.url,        collection: 'vibtribe' },
  { id: 'policewoman',  name: 'Guard Vibe',        url: policewoman.url,  collection: 'vibtribe' },
  { id: 'firefighter',  name: 'Brave Tribe',       url: firefighter.url,  collection: 'vibtribe' },
  { id: 'soccerstar',   name: 'Goal Vibe',         url: soccerstar.url,   collection: 'vibtribe' },
  { id: 'tennisstar',   name: 'Ace Tribe',         url: tennisstar.url,   collection: 'vibtribe' },
  { id: 'swimmer',      name: 'Wave Tribe',        url: swimmer.url,      collection: 'vibtribe' },
  { id: 'vet',          name: 'Pet Vibe',          url: vet.url,          collection: 'vibtribe' },
  { id: 'lawyer',       name: 'Justice Tribe',     url: lawyer.url,       collection: 'vibtribe' },
  { id: 'ceo',          name: 'Boss Tribe',        url: ceo.url,          collection: 'vibtribe' },
  { id: 'dancer',       name: 'Dance Vibe',        url: dancer.url,       collection: 'vibtribe' },
  { id: 'skater',       name: 'Skate Tribe',       url: skater.url,       collection: 'vibtribe' },
];

// Lookup map: id -> emoji (for fast shortcode rendering).
export const VIBTRIBE_EMOJI_MAP: Record<string, VibTribeEmoji> =
  Object.fromEntries(VIBTRIBE_EMOJIS.map(e => [e.id, e]));

// Shortcode used inside message text. Kept short + namespaced so it's
// unmistakable in plain-text fallbacks (notifications, search, exports).
export const vibtribeShortcode = (id: string) => `:vt:${id}:`;

// Matches :vt:<id>: tokens anywhere in a string.
export const VIBTRIBE_SHORTCODE_RE = /:vt:([a-z0-9_-]+):/g;

// Render a string that may contain :vt:<id>: shortcodes, replacing each one
// with an inline <img> of the matching VibTribe emoji. Plain text is kept
// as-is so this can be dropped into chat bubbles, reaction chips, chat
// previews, etc.
import * as React from 'react';
export function renderVtEmojis(
  text: string,
  opts?: { imgClassName?: string },
): React.ReactNode[] {
  const src = String(text ?? '');
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(VIBTRIBE_SHORTCODE_RE.source, 'g');
  const cls = opts?.imgClassName || 'inline-block align-[-0.25em] w-[1.25em] h-[1.25em] mx-[1px] select-none';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) nodes.push(src.slice(last, m.index));
    const emoji = VIBTRIBE_EMOJI_MAP[m[1]];
    if (emoji) {
      nodes.push(
        React.createElement('img', {
          key: `vt-${m.index}`,
          src: emoji.url,
          alt: emoji.name,
          draggable: false,
          loading: 'lazy',
          decoding: 'async',
          className: cls,
        }),
      );
    } else {
      nodes.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) nodes.push(src.slice(last));
  return nodes;
}
