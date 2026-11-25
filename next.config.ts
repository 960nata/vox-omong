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
  /**
   * Build untuk shell desktop (Electron) butuh server mandiri: `.next/standalone/server.js`
   * yang sudah memuat dependensinya sendiri, sehingga bisa dijalankan Node bawaan Electron
   * tanpa node_modules terpaket. Hanya aktif saat `VOX_DESKTOP=1` agar build web tidak berubah.
   */
  ...(process.env.VOX_DESKTOP === "1" ? { output: "standalone" as const } : {}),
  /**
   * pptxgenjs (dipakai ArtifactCard di browser) punya `import('node:fs')` / `import('node:https')`
   * yang hanya jalan di Node. Webpack menolak skema `node:` sebelum sempat membaca field
   * "browser" milik paket itu, jadi di bundle klien modul-modul ini dikosongkan.
   */
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:(fs|https)$/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false };
    }
    return config;
  },
  async headers() {
    return [{ source: "/((?!api/preview).*)", headers: securityHeaders }];
  },
};

export default nextConfig;
