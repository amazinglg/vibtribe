import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: () => <Outlet />,
  head: () => ({
    meta: [
      { title: "Admin — VibTribe" },
      { name: "description", content: "Private VibTribe administration area." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin — VibTribe" },
      { property: "og:description", content: "Private VibTribe administration area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
