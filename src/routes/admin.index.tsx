import { createFileRoute } from "@tanstack/react-router";
import AdminPage from "@/pages/AdminPage";

const TITLE = "Admin dashboard — VibTribe";
const DESCRIPTION = "Internal VibTribe admin dashboard for moderation, analytics and platform management.";
const URL = "https://www.vibtribe.in/admin";
export const Route = createFileRoute("/admin/")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});