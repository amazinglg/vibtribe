import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/pages/HomePage";

const OG_IMAGE = "https://www.vibtribe.in/icons/icon-512x512.png";
const TITLE = "VibTribe — Private Messaging, Status & Secure Vault";
const DESCRIPTION =
  "Secure social messaging with real-time chat, voice & video calls, 24-hour status, and an encrypted private vault. Free on Android & web.";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "keywords", content: "secure messaging app, private chat, encrypted messenger, status updates, video call app, voice call app, private vault, VibTribe, social messaging, free chat app" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://www.vibtribe.in/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "512" },
      { property: "og:image:height", content: "512" },
      { property: "og:image:alt", content: "VibTribe app icon" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://www.vibtribe.in/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MobileApplication",
          name: "VibTribe",
          operatingSystem: "ANDROID, WEB",
          applicationCategory: "SocialNetworkingApplication",
          description: DESCRIPTION,
          url: "https://www.vibtribe.in/",
          image: OG_IMAGE,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.8",
            ratingCount: "120",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "VibTribe",
          url: "https://www.vibtribe.in/",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://www.vibtribe.in/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
});
