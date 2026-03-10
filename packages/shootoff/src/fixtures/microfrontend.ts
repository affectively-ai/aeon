/**
 * Microfrontend Site
 *
 * Simulates a modern frontend app with aggressive code splitting:
 * - Lots of tiny JS/CSS modules (Vite/Rollup chunks)
 * - Lazy-loaded route chunks, component chunks, utility chunks
 * - Many small assets (icons, micro-images)
 * - This is where HTTP/2 multiplexing shines — or does Aeon beat it?
 *
 * Total: ~1.8 MB across 95 resources
 */

import type { SiteManifest } from '../types';

function jsChunk(name: string, size: number, priority: number, blocking = false): import('../types').SiteResource {
  return { path: `/js/${name}.js`, contentType: 'application/javascript', size, renderBlocking: blocking, priority };
}

function cssChunk(name: string, size: number, priority: number): import('../types').SiteResource {
  return { path: `/css/${name}.css`, contentType: 'text/css', size, renderBlocking: priority > 5, priority };
}

function icon(name: string, size: number): import('../types').SiteResource {
  return { path: `/icons/${name}.svg`, contentType: 'image/svg+xml', size, renderBlocking: false, priority: 1 };
}

export const microfrontendSite: import('../types').SiteManifest = {
  name: 'microfrontend',
  description: 'Modern SPA: aggressive code-splitting, 95 resources, lots of tiny modules (~1.8 MB)',
  resources: [
    // HTML shell
    { path: '/index.html', contentType: 'text/html', size: 3_500, renderBlocking: true, priority: 10 },

    // Entry point chunks (critical path)
    jsChunk('entry', 8_200, 10, true),
    jsChunk('runtime', 2_100, 10, true),
    jsChunk('framework', 45_000, 9, true),   // React/Preact/Solid
    jsChunk('vendor-core', 32_000, 9, true),  // router, state mgmt

    // Route chunks (lazy loaded)
    jsChunk('route-home', 12_000, 7),
    jsChunk('route-dashboard', 18_000, 6),
    jsChunk('route-settings', 9_500, 5),
    jsChunk('route-profile', 11_000, 5),
    jsChunk('route-analytics', 22_000, 4),
    jsChunk('route-billing', 14_000, 4),
    jsChunk('route-admin', 16_000, 3),
    jsChunk('route-docs', 8_000, 3),

    // Shared component chunks
    jsChunk('chunk-button', 1_800, 7),
    jsChunk('chunk-modal', 3_200, 6),
    jsChunk('chunk-form', 5_500, 6),
    jsChunk('chunk-table', 7_800, 5),
    jsChunk('chunk-chart', 28_000, 4),
    jsChunk('chunk-editor', 35_000, 3),
    jsChunk('chunk-calendar', 12_000, 3),
    jsChunk('chunk-notification', 2_400, 5),
    jsChunk('chunk-avatar', 1_200, 5),
    jsChunk('chunk-dropdown', 2_800, 5),
    jsChunk('chunk-tooltip', 1_500, 4),
    jsChunk('chunk-tabs', 2_100, 4),
    jsChunk('chunk-accordion', 1_900, 4),
    jsChunk('chunk-breadcrumb', 900, 4),
    jsChunk('chunk-pagination', 1_600, 3),
    jsChunk('chunk-sidebar', 3_800, 6),
    jsChunk('chunk-header', 4_200, 7),
    jsChunk('chunk-footer', 2_000, 2),

    // Utility chunks
    jsChunk('util-date', 3_200, 4),
    jsChunk('util-format', 1_800, 4),
    jsChunk('util-validate', 2_500, 4),
    jsChunk('util-i18n', 8_000, 5),
    jsChunk('util-analytics', 4_500, 3),
    jsChunk('util-auth', 3_000, 6),
    jsChunk('util-api', 5_200, 6),
    jsChunk('util-storage', 1_500, 4),
    jsChunk('util-theme', 2_200, 5),
    jsChunk('util-crypto', 6_000, 3),

    // Vendor chunks (split by usage)
    jsChunk('vendor-icons', 15_000, 3),
    jsChunk('vendor-chart', 42_000, 2),
    jsChunk('vendor-markdown', 18_000, 2),
    jsChunk('vendor-syntax', 25_000, 2),
    jsChunk('vendor-dnd', 12_000, 2),

    // CSS modules
    cssChunk('critical', 4_500, 10),
    cssChunk('layout', 3_200, 8),
    cssChunk('components', 8_500, 7),
    cssChunk('utilities', 5_800, 6),
    cssChunk('theme-light', 2_200, 5),
    cssChunk('theme-dark', 2_400, 5),
    cssChunk('route-home', 1_800, 4),
    cssChunk('route-dashboard', 3_500, 4),
    cssChunk('route-settings', 1_200, 3),
    cssChunk('route-analytics', 2_800, 3),
    cssChunk('route-admin', 2_000, 3),
    cssChunk('chart', 1_500, 2),
    cssChunk('editor', 2_800, 2),
    cssChunk('calendar', 1_600, 2),
    cssChunk('animations', 900, 2),
    cssChunk('print', 800, 1),

    // Icons (individual SVGs — common in modern apps)
    icon('home', 450),
    icon('settings', 380),
    icon('user', 320),
    icon('chart', 520),
    icon('bell', 280),
    icon('search', 350),
    icon('menu', 200),
    icon('close', 180),
    icon('arrow-left', 220),
    icon('arrow-right', 220),
    icon('check', 200),
    icon('warning', 380),
    icon('info', 350),
    icon('edit', 300),
    icon('trash', 280),
    icon('download', 340),
    icon('upload', 320),
    icon('copy', 290),
    icon('link', 250),
    icon('external', 310),

    // Micro-assets
    { path: '/fonts/inter-var.woff2', contentType: 'font/woff2', size: 110_000, renderBlocking: true, priority: 8 },
    { path: '/favicon.svg', contentType: 'image/svg+xml', size: 1_200, renderBlocking: false, priority: 1 },
    { path: '/manifest.json', contentType: 'application/json', size: 450, renderBlocking: false, priority: 1 },
    { path: '/robots.txt', contentType: 'text/plain', size: 80, renderBlocking: false, priority: 0 },
  ],
};
