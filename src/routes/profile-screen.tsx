import { createFileRoute } from "@tanstack/react-router";
import ProfileScreenPage from "@/pages/ProfileScreenPage";
const TITLE = "Your profile — VibTribe";
const DESCRIPTION = "Manage your VibTribe profile, account settings, privacy preferences and encrypted vault.";
const URL = "https://www.vibtribe.in/profile-screen";
export const Route = createFileRoute("/profile-screen")({
  component: ProfileScreenPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});
