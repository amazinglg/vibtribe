import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/theme-preview')({
  component: ThemePreview,
  head: () => ({
    meta: [
      { title: 'Aurora Glass Theme Previews | VibTribe' },
      { name: 'description', content: 'Preview five purple glass shell directions for the VibTribe Aurora Glass theme.' },
      { property: 'og:title', content: 'Aurora Glass Theme Previews | VibTribe' },
      { property: 'og:description', content: 'Five purple glass shell directions rendered on a real chat layout.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
})

type Variant = {
  n: number
  name: string
  note: string
  page: string
  panel: string
  panelBorder: string
  item: string
  itemActive: string
  header: string
  text: string
  sub: string
  accent: string
  blur: string
}

const VARIANTS: Variant[] = [
  {
    n: 1,
    name: 'Soft Aurora Veil',
    note: 'Gentle violet haze — lifted out of black, subtle tint.',
    page: 'radial-gradient(ellipse at 15% 5%, rgba(217,70,239,.18), transparent 45%), radial-gradient(ellipse at 85% 30%, rgba(168,85,247,.20), transparent 50%), #0a0512',
    panel: 'rgba(140,90,220,0.10)',
    panelBorder: 'rgba(196,132,252,0.18)',
    item: 'rgba(168,85,247,0.07)',
    itemActive: 'rgba(168,85,247,0.18)',
    header: 'linear-gradient(135deg, rgba(217,70,239,.28), rgba(124,58,237,.28))',
    text: '#f5f0ff',
    sub: 'rgba(220,205,250,.62)',
    accent: '#d946ef',
    blur: '20px',
  },
  {
    n: 2,
    name: 'Deep Violet Ribbon',
    note: 'Richer violet body with a diagonal ribbon glow behind panels.',
    page: 'linear-gradient(135deg, #1a0733 0%, #12061f 45%, #0d0418 100%)',
    panel: 'rgba(124,58,237,0.18)',
    panelBorder: 'rgba(196,132,252,0.26)',
    item: 'rgba(168,85,247,0.12)',
    itemActive: 'rgba(217,70,239,0.24)',
    header: 'linear-gradient(135deg, rgba(217,70,239,.42), rgba(124,58,237,.42))',
    text: '#faf5ff',
    sub: 'rgba(226,214,255,.7)',
    accent: '#e879f9',
    blur: '24px',
  },
  {
    n: 3,
    name: 'Frosted Lilac',
    note: 'Brightest, milky frosted glass with white-ish edges. Most "glassy".',
    page: 'radial-gradient(ellipse at 20% 0%, rgba(232,121,249,.30), transparent 50%), radial-gradient(ellipse at 90% 40%, rgba(139,92,246,.30), transparent 55%), #1b1030',
    panel: 'rgba(232,220,255,0.16)',
    panelBorder: 'rgba(255,255,255,0.34)',
    item: 'rgba(255,255,255,0.10)',
    itemActive: 'rgba(255,255,255,0.22)',
    header: 'linear-gradient(135deg, rgba(240,171,252,.45), rgba(167,139,250,.45))',
    text: '#ffffff',
    sub: 'rgba(255,255,255,.72)',
    accent: '#f0abfc',
    blur: '34px',
  },
  {
    n: 4,
    name: 'Neon Glass Edge',
    note: 'Darker glass, glowing magenta borders and inner glow.',
    page: 'radial-gradient(ellipse at 50% -10%, rgba(217,70,239,.22), transparent 55%), #07030f',
    panel: 'rgba(90,40,160,0.14)',
    panelBorder: 'rgba(217,70,239,0.50)',
    item: 'rgba(217,70,239,0.08)',
    itemActive: 'rgba(217,70,239,0.22)',
    header: 'linear-gradient(135deg, rgba(217,70,239,.34), rgba(88,28,135,.34))',
    text: '#fdf4ff',
    sub: 'rgba(232,200,255,.6)',
    accent: '#ff5cf0',
    blur: '18px',
  },
  {
    n: 5,
    name: 'Aurora Curtain',
    note: 'Layered aurora curtain behind floating frosted panels.',
    page: 'linear-gradient(160deg, rgba(217,70,239,.34) 0%, rgba(124,58,237,.28) 30%, rgba(59,7,100,.5) 60%, #0b0518 100%)',
    panel: 'rgba(255,255,255,0.09)',
    panelBorder: 'rgba(255,255,255,0.22)',
    item: 'rgba(255,255,255,0.08)',
    itemActive: 'rgba(196,132,252,0.26)',
    header: 'linear-gradient(135deg, rgba(217,70,239,.5), rgba(124,58,237,.5))',
    text: '#f8f4ff',
    sub: 'rgba(233,222,255,.68)',
    accent: '#c084fc',
    blur: '30px',
  },
]

const CHATS = [
  { name: 'Aarav Sharma', msg: 'See you at 7 tonight 👋', time: '17:42', unread: 2 },
  { name: 'Design Tribe', msg: 'Priya: new mockups are up', time: '16:08', unread: 0 },
  { name: 'Meera', msg: 'Sent a photo', time: '14:20', unread: 5 },
  { name: 'Family', msg: 'Dad: call me when free', time: 'Yesterday', unread: 0 },
]

function Preview({ v }: { v: Variant }) {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: v.page, border: `1px solid ${v.panelBorder}` }}>
      <div className="flex h-[420px]">
        {/* Sidebar / chat list */}
        <div
          className="w-[46%] flex flex-col"
          style={{
            background: v.panel,
            backdropFilter: `blur(${v.blur})`,
            borderRight: `1px solid ${v.panelBorder}`,
          }}
        >
          <div className="px-3 py-3" style={{ background: v.header, borderBottom: `1px solid ${v.panelBorder}` }}>
            <div className="text-[13px] font-bold" style={{ color: v.text }}>Chats</div>
            <div
              className="mt-2 rounded-full px-3 py-1 text-[10px]"
              style={{ background: 'rgba(255,255,255,.12)', color: v.sub, border: `1px solid ${v.panelBorder}` }}
            >
              Search
            </div>
          </div>
          <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
            {CHATS.map((c, i) => (
              <div
                key={c.name}
                className="flex items-center gap-2 rounded-2xl p-2"
                style={{
                  background: i === 0 ? v.itemActive : v.item,
                  border: `1px solid ${v.panelBorder}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div
                  className="h-8 w-8 shrink-0 rounded-full grid place-items-center text-[11px] font-bold"
                  style={{ background: `linear-gradient(135deg, ${v.accent}, #7c3aed)`, color: '#fff' }}
                >
                  {c.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold" style={{ color: v.text }}>{c.name}</div>
                  <div className="truncate text-[10px]" style={{ color: v.sub }}>{c.msg}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px]" style={{ color: v.sub }}>{c.time}</div>
                  {c.unread > 0 && (
                    <div
                      className="ml-auto mt-1 h-4 min-w-4 rounded-full px-1 text-[9px] font-bold grid place-items-center"
                      style={{ background: v.accent, color: '#1a0033' }}
                    >
                      {c.unread}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat window — bubbles are the LOCKED existing theme, unchanged */}
        <div className="flex-1 flex flex-col" style={{ background: 'rgba(8,4,16,0.35)', backdropFilter: `blur(${v.blur})` }}>
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: v.header, borderBottom: `1px solid ${v.panelBorder}` }}>
            <div className="h-7 w-7 rounded-full" style={{ background: `linear-gradient(135deg, ${v.accent}, #7c3aed)` }} />
            <div>
              <div className="text-[11px] font-semibold" style={{ color: v.text }}>Aarav Sharma</div>
              <div className="text-[9px]" style={{ color: v.sub }}>online</div>
            </div>
          </div>
          <div className="flex-1 p-3 space-y-2">
            <div className="flex">
              <div
                className="max-w-[75%] rounded-2xl rounded-tl-sm px-3 py-2 text-[11px]"
                style={{ background: 'rgba(233,213,255,0.22)', border: '1px solid rgba(233,213,255,0.28)', color: '#f3e8ff', backdropFilter: 'blur(14px)' }}
              >
                Hey! Are we still on for tonight?
              </div>
            </div>
            <div className="flex justify-end">
              <div
                className="max-w-[75%] rounded-2xl rounded-tr-sm px-3 py-2 text-[11px]"
                style={{ background: 'linear-gradient(135deg,#7e22ce,#4c1d95)', boxShadow: '0 6px 20px rgba(126,34,206,.45)', color: '#fff' }}
              >
                Absolutely 💜 7pm sharp.
              </div>
            </div>
            <div className="flex">
              <div
                className="max-w-[75%] rounded-2xl rounded-tl-sm px-3 py-2 text-[11px]"
                style={{ background: 'rgba(233,213,255,0.22)', border: '1px solid rgba(233,213,255,0.28)', color: '#f3e8ff', backdropFilter: 'blur(14px)' }}
              >
                Perfect, see you 👋
              </div>
            </div>
          </div>
          <div className="p-2.5">
            <div
              className="rounded-full px-3 py-2 text-[10px]"
              style={{ background: v.panel, border: `1px solid ${v.panelBorder}`, color: v.sub, backdropFilter: 'blur(18px)' }}
            >
              Message…
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemePreview() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <h1 className="text-2xl font-bold text-foreground">Aurora Glass — 5 purple glass directions</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Only the app shell (sidebar, chat list, headers, composer surface) changes. Message bubbles stay exactly as they are today.
      </p>
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        {VARIANTS.map(v => (
          <section key={v.n}>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              {v.n}. {v.name}
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">{v.note}</p>
            <Preview v={v} />
          </section>
        ))}
      </div>
    </main>
  )
}