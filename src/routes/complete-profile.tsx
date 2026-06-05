import { createFileRoute } from "@tanstack/react-router";
import CompleteProfilePage from "@/pages/CompleteProfilePage";
const TITLE = "Complete your profile — VibTribe";
const DESCRIPTION = "Finish setting up your VibTribe profile to start chatting, calling and sharing status with your tribe.";
const URL = "https://www.vibtribe.in/complete-profile";
export const Route = createFileRoute("/complete-profile")({
  component: CompleteProfilePage,
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
