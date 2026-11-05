import type { NextConfig } from "next";

const noCache = [
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
  },
  {
    key: 'Pragma',
    value: 'no-cache',
  },
  {
    key: 'Expires',
    value: '0',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Tutti i service worker (sw-v4.js, sw-v10.js, sw-v11.js, ...): mai in cache,
        // altrimenti il browser continua a servire la versione vecchia dell'app.
        source: '/:swfile(sw-.*\\.js)',
        headers: noCache,
      },
      {
        source: '/sw.js',
        headers: noCache,
      },
      {
        source: '/manifest.json',
        headers: noCache,
      },
      {
        source: '/manifest-dark.json',
        headers: noCache,
      },
    ];
  },
};

export default nextConfig;
