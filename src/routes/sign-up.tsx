import { createFileRoute } from "@tanstack/react-router";
import SignUpPage from "@/pages/SignUpPage";
const TITLE = "Create your VibTribe account — Sign Up";
const DESCRIPTION = "Create a free VibTribe account to start secure messaging, voice & video calls, 24-hour status updates and a private encrypted vault.";
const URL = "https://www.vibtribe.in/sign-up";
export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});
