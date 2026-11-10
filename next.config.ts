import type { NextConfig } from "next";

/**
 * Header keamanan untuk halaman aplikasi.
 * /api/preview sengaja dikecualikan: route itu memasang CSP sandbox sendiri.
 * CSP di sini hanya membatasi pembingkaian, plugin, dan <base>; skrip inline Next.js
 * (theme boot, hydration) tidak terpengaruh.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/((?!api/preview).*)", headers: securityHeaders }];
  },
};

export default nextConfig;
