import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // Preserve the project's owner-maintained AGENTS.md during next dev.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default config;
