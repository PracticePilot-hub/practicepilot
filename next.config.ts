// Path: next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/paia/manuals/[manualId]/pdf/route": [
      "node_modules/@sparticuz/chromium/bin/**/*",
    ],
    "/api/paia/manuals/[manualId]/pdf": [
      "node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;