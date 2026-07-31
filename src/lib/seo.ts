/**
 * Shared SEO constants and structured-data helpers.
 * Keep every canonical / og:url / schema URL derived from SITE_URL so the
 * site never emits mismatched or relative absolute URLs.
 */
export const SITE_URL = 'https://www.vibtribe.in';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/icon-512x512.png`;

type Crumb = { name: string; path: string };

/** BreadcrumbList JSON-LD. "Home" is prepended automatically. */
export function breadcrumbLd(trail: Crumb[]) {
  return {
    type: 'application/ld+json',
    children: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        ...trail.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 2,
          name: c.name,
          item: `${SITE_URL}${c.path}`,
        })),
      ],
    }),
  };
}

/** og:image + twitter:image pair. */
export function socialImageMeta(image: string = DEFAULT_OG_IMAGE) {
  return [
    { property: 'og:image', content: image },
    { property: 'og:image:alt', content: 'VibTribe — private messaging app' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: image },
  ];
}