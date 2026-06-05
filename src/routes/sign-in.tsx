import { createFileRoute } from "@tanstack/react-router";
import SignInPage from "@/pages/SignInPage";
const TITLE = "Sign In — VibTribe";
const DESCRIPTION = "Sign in to VibTribe to access secure chats, voice & video calls, status updates and your private encrypted vault.";
const URL = "https://www.vibtribe.in/sign-in";
export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
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
