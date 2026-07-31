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
          "@type": "WebPage",
          "@id": "https://www.vibtribe.in/#webpage",
          url: "https://www.vibtribe.in/",
          name: TITLE,
          description: DESCRIPTION,
          inLanguage: "en",
          isPartOf: { "@id": "https://www.vibtribe.in/#organization" },
          primaryImageOfPage: OG_IMAGE,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "VibTribe",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Android, Web",
          url: "https://www.vibtribe.in/",
          downloadUrl: "https://play.google.com/store/apps/details?id=app.vibtribe.app",
          installUrl: "https://play.google.com/store/apps/details?id=app.vibtribe.app",
          image: OG_IMAGE,
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: [
            "End-to-end encrypted chat",
            "Private vault",
            "24-hour status",
            "Voice and video calls",
            "Tribes (private groups)",
            "Self-destructing messages",
          ],
        }),
      },
    ],
  }),
});
