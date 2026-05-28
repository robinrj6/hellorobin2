// @ts-check
import { defineConfig, sessionDrivers } from "astro/config";

import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://hellorobin.cc",
  integrations: [react()],
  session: {
    driver: sessionDrivers.lruCache(),
  },
  adapter: cloudflare(),
});
