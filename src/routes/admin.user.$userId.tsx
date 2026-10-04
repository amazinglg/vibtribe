import { createFileRoute } from "@tanstack/react-router";
import AdminUserDetailPage from "@/pages/AdminUserDetailPage";

export const Route = createFileRoute("/admin/user/$userId")({
  component: AdminUserDetailPage,
  head: () => ({
    meta: [
      { title: "User Admin — VibTribe" },
      { name: "description", content: "Private VibTribe user administration area." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "User Admin — VibTribe" },
      { property: "og:description", content: "Private VibTribe user administration area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});