import { createFileRoute } from "@tanstack/react-router";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
const TITLE = "Reset your password — VibTribe";
const DESCRIPTION = "Forgot your VibTribe password? Reset it securely and get back to your private chats, calls and encrypted vault.";
const URL = "https://www.vibtribe.in/forgot-password";
export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
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
