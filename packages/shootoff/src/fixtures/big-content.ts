/**
 * Big Content Site
 *
 * Simulates a content-heavy site like a blog or news portal:
 * - Few resources but individually large
 * - Big JS bundle, big CSS, hero images, web fonts
 * - Sequential dependency chain (CSS blocks render, JS blocks interaction)
 *
 * Total: ~2.5 MB across 12 resources
 */

import type { SiteManifest } from '../types';

export const bigContentSite: SiteManifest = {
  name: 'big-content',
  description: 'Content-heavy site: blog with hero images, big bundles, web fonts (~2.5 MB, 12 resources)',
  resources: [
    // HTML — the document itself
    {
      path: '/index.html',
      contentType: 'text/html',
      size: 45_000,       // 45 KB HTML
      renderBlocking: true,
      priority: 10,
    },
    // Critical CSS
    {
      path: '/css/main.css',
      contentType: 'text/css',
      size: 185_000,      // 185 KB CSS (Tailwind-like)
      renderBlocking: true,
      priority: 9,
    },
    // JS bundle
    {
      path: '/js/app.bundle.js',
      contentType: 'application/javascript',
      size: 750_000,      // 750 KB JS bundle
      renderBlocking: true,
      priority: 8,
    },
    // Vendor JS
    {
      path: '/js/vendor.bundle.js',
      contentType: 'application/javascript',
      size: 420_000,      // 420 KB vendor libs
      renderBlocking: false,
      priority: 5,
    },
    // Hero image
    {
      path: '/img/hero.webp',
      contentType: 'image/webp',
      size: 280_000,      // 280 KB hero
      renderBlocking: false,
      priority: 7,
    },
    // Article images
    {
      path: '/img/article-1.webp',
      contentType: 'image/webp',
      size: 150_000,
      renderBlocking: false,
      priority: 4,
    },
    {
      path: '/img/article-2.webp',
      contentType: 'image/webp',
      size: 180_000,
      renderBlocking: false,
      priority: 3,
    },
    {
      path: '/img/article-3.webp',
      contentType: 'image/webp',
      size: 120_000,
      renderBlocking: false,
      priority: 2,
    },
    // Web fonts
    {
      path: '/fonts/inter-var.woff2',
      contentType: 'font/woff2',
      size: 110_000,      // Variable font
      renderBlocking: true,
      priority: 8,
    },
    {
      path: '/fonts/fira-code.woff2',
      contentType: 'font/woff2',
      size: 85_000,       // Code font
      renderBlocking: false,
      priority: 3,
    },
    // Favicon + manifest
    {
      path: '/favicon.svg',
      contentType: 'image/svg+xml',
      size: 2_000,
      renderBlocking: false,
      priority: 1,
    },
    {
      path: '/manifest.json',
      contentType: 'application/json',
      size: 500,
      renderBlocking: false,
      priority: 1,
    },
  ],
};
