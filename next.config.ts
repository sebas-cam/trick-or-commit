import type { NextConfig } from "next";

const config: NextConfig = {
  // The share card reads these from disk, which file tracing can't see on its own.
  outputFileTracingIncludes: {
    "/api/og/[username]": [
      "./node_modules/@fontsource/creepster/files/creepster-latin-400-normal.woff",
      "./node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff",
    ],
  },
};

export default config;
