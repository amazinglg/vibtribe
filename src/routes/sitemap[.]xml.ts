import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://www.vibtribe.in";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const paths: Array<{ path: string; changefreq: string; priority: string }> = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/features", changefreq: "monthly", priority: "0.9" },
          { path: "/security", changefreq: "monthly", priority: "0.9" },
          { path: "/faq", changefreq: "monthly", priority: "0.8" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/data-notice", changefreq: "monthly", priority: "0.5" },
          { path: "/subprocessors", changefreq: "monthly", priority: "0.4" },
          { path: "/child-safety", changefreq: "monthly", priority: "0.6" },
          { path: "/help/reporting", changefreq: "monthly", priority: "0.5" },
          { path: "/download/android", changefreq: "weekly", priority: "0.8" },
          { path: "/download/ios", changefreq: "weekly", priority: "0.6" },
          { path: "/blog/vibtribe-vs-signal-vs-telegram", changefreq: "monthly", priority: "0.7" },
          { path: "/blog/whatsapp-alternatives-india", changefreq: "monthly", priority: "0.7" },
          { path: "/blog/end-to-end-encryption-explained", changefreq: "monthly", priority: "0.7" },
          { path: "/blog/self-destructing-messages-guide", changefreq: "monthly", priority: "0.7" },
          { path: "/blog/private-vault-messaging", changefreq: "monthly", priority: "0.7" },
        ];
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...paths.map((e) => [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            `    <lastmod>${today}</lastmod>`,
            `    <changefreq>${e.changefreq}</changefreq>`,
            `    <priority>${e.priority}</priority>`,
            `  </url>`,
          ].join("\n")),
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});