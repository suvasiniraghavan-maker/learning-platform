// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// Update `site` once you know your production URL (helps with sitemaps/SEO).
// Cloudflare Pages preview URLs also work without this.
export default defineConfig({
  // site: "https://your-domain.example",
  output: "static",
  integrations: [react()],
});
