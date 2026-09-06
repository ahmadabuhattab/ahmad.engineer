# ahmad.engineer

Ahmad Abu-Hattab’s static portfolio. Vercel builds `public/` from the `main` branch.

## Run

```sh
npm ci
npm run build
npm run dev
```

Run the build before previewing. It regenerates the ignored `public/card/` asset directory, including the portfolio styles, local font declarations, and split JavaScript bundles.

## Experience

- `public/index.html` contains the complete crawlable portfolio, biography, experience, project descriptions, and contact links.
- `src/experience.*` provides layout, motion controls, scroll reveals, and progress. Content remains readable without JavaScript.
- `src/energy-loader.js` upgrades the immediately visible artwork to interactive WebGL on larger screens or a small Canvas 2D geometry renderer on phones. The renderer is selected once per page and resizes in place. Reduced-motion preferences default to static artwork, with an explicit “Enable animation” option; data-saving users retain the lightweight artwork.
- `src/energy-core.*` and `src/energy-mobile.js` animate metallic orbit fragments, nucleus shards, shockwaves, and luminous particles. The shared `src/energy-cycle.js` timeline charges, explodes, suspends, and reconstructs the sculpture every 15 seconds. “Release energy” or a short tap on the sculpture starts the sequence when it is in orbit.
- The motion control freezes the scene at its current position. Rendering also stops outside the viewport and while the page is hidden, and resumes without advancing through the elapsed hidden time. Resolution and frame rate are bounded. Loss of WebGL returns to the artwork and recovery restores the scene. The collector card retains its original independent controls.
- `src/steel-card.js`, `src/steel-card.css`, `src/steelworks.js`, and the collector-card markup are preserved from the existing STELCO experience.
- `public/photos.html` keeps the existing gallery with accurate image metadata. `public/sitemap.xml` lists canonical pages and the gallery images.
- Fonts are the same Google Fonts versions, now served locally. Licenses and exact source URLs are in `public/fonts/README.md`.

The share preview is `public/og-portfolio-2026.jpg` (1200 × 630). The lightweight hero artwork is `public/energy-core-2026.jpg` (900 × 900). Both are rendered from the portfolio’s original orbital scene.

## Release verification — September 6, 2026

- Clean production build passed.
- Browser checks passed at 360, 390, 768, 1024, and 1440px widths with no page errors or failed local asset requests.
- Navigation, project disclosures, FAQs, collector-card flip, scene pause/resume, reduced motion, gallery navigation, and content without JavaScript verified.
- Explosion and reconstruction verified on desktop and mobile, including keyboard activation, unchanged pixels while paused, offscreen suspension, resizing across the breakpoint, and WebGL context loss/recovery. The shared timeline restores exact home positions across 30 sampled cycles.
- Automated WCAG A/AA accessibility scan: zero violations.
- Local Lighthouse mobile audit after the interaction fixes: performance 96, accessibility 100, best practices 100, SEO 100; CLS 0 and total blocking time 60ms. These are lab measurements, not guarantees of field performance or search rankings.

Production verification must also check the canonical domain, Vercel redirects, sitemap, robots, verification files, share image, and real 404 responses.

## Interaction and responsive audit

- Exercised every homepage link, all seven project/FAQ disclosures, and hero controls at 320, 390, 768, and 1440px: 124 checks passed with zero page errors. Email actions were checked without sending mail; external-link targets were verified. LinkedIn blocks automated HTTP checks, while the configured profile link opens correctly.
- All 25 collector-card checks pass, including keyboard, touch, permission-result simulations for phone tilt, reduced motion, renderer fallbacks, and no-JavaScript readability. The card source and markup remain unchanged; a page-level no-script style hides its inactive controls when scripting is disabled.
- All gallery navigation links, seven photos, captions, deep links, and 404 recovery links were checked. Fixed the breadcrumb overlay blocking navigation, low-contrast gallery text, delayed photo reveals, and photo anchor positioning.
- Layout inspection covered 320–1920px widths and landscape. Fixed enlarged-text clipping, wrapping navigation, metric columns, photo heading layout, and zero-width waveform bars on narrow screens. Follow-up checks at 200% text enlargement pass without text overflow.
- Chrome and Edge desktop/mobile checks pass. Gallery and homepage accessibility scans report zero violations. Phone layouts and sensor permission results are emulated; physical sensor calibration depends on the visitor's device.
