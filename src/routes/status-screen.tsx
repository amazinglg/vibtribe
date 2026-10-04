import { createFileRoute } from "@tanstack/react-router";
import StatusScreenPage from "@/pages/StatusScreenPage";

const TITLE = "Status Editor — VibTribe";
const DESCRIPTION = "Create and manage your private VibTribe status updates.";
const URL = "https://vibtribe.lovable.app/status-screen";

export const Route = createFileRoute("/status-screen")({
  component: StatusScreenPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});
